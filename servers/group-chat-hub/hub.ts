#!/usr/bin/env bun
// group-chat hub — the one networked process. Many Claude instances connect
// over WebSocket; many named groups live here so multiple projects share one
// hub. v3 adds an identity layer (accounts, aliases, direct messages) and moves
// durable storage to SQLite; v4 unifies handles (group membership is derived, no
// separate member table); v5 adds durable adapter_id reconnect (a per-process id
// + an adapter_sessions lease that re-binds a reconnecting adapter's sessions,
// surviving a hub restart). See protocol.ts for the wire contract,
// group-chat-direct-messages.md for the identity/DM design, and
// group-chat-adapter-reconnect.md for the reconnect design.
//
// Run:  GROUP_CHAT_TOKEN=secret bun servers/group-chat-hub/hub.ts
// Env:
//   GROUP_CHAT_TOKEN  required unless GROUP_CHAT_ALLOW_NO_AUTH=1 — shared secret
//   GROUP_CHAT_PORT   listen port (default 8787)
//   GROUP_CHAT_HOST   bind host (default 127.0.0.1)
//   GROUP_CHAT_DATA   data dir; the SQLite DB lives at <dir>/hub.db (default ./.group-chat-data)
//   GROUP_CHAT_ALLOW_NO_AUTH=1  run open (localhost/tunnel only)
//   GROUP_CHAT_WINDOW  in-memory message window per group for gap re-send (default 500)
//
// STORAGE: a single SQLite DB (bun:sqlite, WAL). Groups, handles (the one
// registry — group membership AND registered aliases are both handle rows), group
// messages, DMs and per-recipient DM delivery cursors are all durable rows. Group
// membership is DERIVED (handles ending `@<group>._group`), not a separate table.
// The hub loads its world from the DB on startup. Group delivery is NOT
// cursored in the DB — group push is online-only with an in-memory brief-
// reconnect gap-resend window; only DMs carry a durable per-recipient cursor.

import { mkdirSync } from "node:fs";
import { join as pathJoin } from "node:path";
import { randomUUID } from "node:crypto";
import { Database } from "bun:sqlite";
import type {
  ServerFrame,
  ClientEnvelope,
  ChatMessage,
  MemberInfo,
  DirectMessage,
  DirectoryEntry,
} from "./protocol.ts";
import { PROTOCOL_VERSION } from "./protocol.ts";

const TOKEN = process.env.GROUP_CHAT_TOKEN ?? "";
const ALLOW_NO_AUTH = process.env.GROUP_CHAT_ALLOW_NO_AUTH === "1";
const PORT = Number(process.env.GROUP_CHAT_PORT ?? 8787);
const HOST = process.env.GROUP_CHAT_HOST ?? "127.0.0.1";
const DATA_DIR = process.env.GROUP_CHAT_DATA ?? ".group-chat-data";
const WINDOW = Number(process.env.GROUP_CHAT_WINDOW ?? 500);
// How long a `send`/`dm` awaits read-receipts from currently-connected members
// before replying. Whoever confirms within this window is "read"; everyone else
// is "sent". 100ms comfortably covers localhost/LAN/tunnel.
const READ_RECEIPT_MS = Number(process.env.GROUP_CHAT_READ_RECEIPT_MS ?? 100);
// How long an account-bound frame waits for its `tool_use_id -> session_id`
// registration (the PreToolUse hook's `map_session`) to arrive when it hasn't
// already. The hook and the adapter frame travel on SEPARATE connections, so the
// frame can race ahead of the registration; we await it up to this bound, then
// honest-error (identity/DM tools) or proceed without a session (group tools).
//
// This is purely a LIVENESS backstop for a signal that may never arrive (hook
// didn't fire, hub was down when it tried, bad token): on the happy path the
// deferred is completed the INSTANT `map_session` lands, so this value is
// irrelevant to throughput and only ever bounds the failure path. Hence a
// generous default — large enough that a congested cold-start hook (a fresh `bun`
// spawn + new socket, several racing in a batch) comfortably beats it, while
// still finite so a genuinely dead hook fails the call in human-patience time
// rather than hanging it forever. Env-overridable for tuning.
const SESSION_MAP_WAIT_MS = Number(process.env.GROUP_CHAT_SESSION_MAP_WAIT_MS ?? 60_000);
// TTL for a resolved `tool_use_id -> session_id` entry. A tool_use_id is used by
// at most the handful of frames of a single call, so a short TTL bounds the map
// without affecting correctness (a late frame for an expired id honest-errors and
// the next call re-registers). Also caps total entries as a hard backstop.
const SESSION_MAP_TTL_MS = Number(process.env.GROUP_CHAT_SESSION_MAP_TTL_MS ?? 60_000);
const SESSION_MAP_MAX = Number(process.env.GROUP_CHAT_SESSION_MAP_MAX ?? 10_000);

if (!TOKEN && !ALLOW_NO_AUTH) {
  console.error(
    "group-chat-hub: refusing to start without GROUP_CHAT_TOKEN. " +
      "Set a token, or GROUP_CHAT_ALLOW_NO_AUTH=1 to run open on a trusted network.",
  );
  process.exit(1);
}

// Group names become a <channel group="..."> attribute downstream, so keep them
// to a safe charset.
const GROUP_NAME_RE = /^[A-Za-z0-9_-]{1,64}$/;
const MEMBER_NAME_RE = /^[A-Za-z0-9_-]{1,64}$/;
// Registered alias names must be DASH-FREE: session ids contain dashes, so
// forbidding them here makes it impossible to register a name shaped like a
// session id and impersonate someone's default alias.
const ALIAS_NAME_RE = /^[A-Za-z0-9_]{1,64}$/;
// The reserved suffix for group-derived addresses: <handle>@<group>._group.
const GROUP_SUFFIX = "._group";

// ---------------------------------------------------------------------------
// SQLite storage. One DB file, WAL journaling, foreign keys on. The DB is the
// durable source of truth; in-memory maps below are the live view rebuilt from
// it on startup plus transient connection bindings.

mkdirSync(DATA_DIR, { recursive: true });
const db = new Database(pathJoin(DATA_DIR, "hub.db"), { create: true });
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

// Versioned schema migrations (the superagent `user_version` pattern). Each entry
// is one version; we apply every entry whose version is newer than the DB's
// current `user_version`, in order, each inside its own transaction, bumping the
// version after each. Adding a future change = append a new entry (an idempotent
// CREATE or an ALTER) — never edit an applied one.
//
// v1 is the UNIFIED schema: ONE `handles` table replaces the old `aliases` AND
// `members` tables. A handle is a name owned by an identity; a group handle is a
// handle whose string ends `@<group>._group`; a registered alias is `<name>@<host>`.
// Group membership is derived (query handles ending in the suffix), not stored
// separately. Clean-slate per design O1: prior aliases/members data is not carried.
const MIGRATIONS: string[] = [
  // v1 — unified handle table + groups/messages/dms/dm_delivery. Clean-slate per
  // design O1: an upgrade from the pre-v1 schema (which booted at user_version 0)
  // drops the old parallel registries so they can't linger as dead tables. A fresh
  // DB no-ops these drops. The handle table is the SINGLE registry going forward.
  `
  DROP TABLE IF EXISTS members;
  DROP TABLE IF EXISTS aliases;
  CREATE TABLE IF NOT EXISTS groups (
    name TEXT PRIMARY KEY,
    created_ts TEXT
  );
  CREATE TABLE IF NOT EXISTS handles (
    handle TEXT PRIMARY KEY,        -- full string, globally unique (e.g. alice@host or al@proj._group)
    owner_session TEXT NOT NULL,    -- the identity that holds it (today == a session id)
    created_ts TEXT
  );
  CREATE TABLE IF NOT EXISTS messages (
    group_name TEXT, seq INTEGER, from_handle TEXT, ts TEXT, msg_id TEXT, text TEXT,
    PRIMARY KEY (group_name, seq)
  );
  CREATE TABLE IF NOT EXISTS dms (
    lo_session TEXT, hi_session TEXT, seq INTEGER,
    from_session TEXT, from_alias TEXT, to_session TEXT, to_alias TEXT,
    ts TEXT, msg_id TEXT, text TEXT,
    state TEXT,
    PRIMARY KEY (lo_session, hi_session, seq)
  );
  CREATE TABLE IF NOT EXISTS dm_delivery (
    lo_session TEXT, hi_session TEXT, recipient_session TEXT, delivered_seq INTEGER,
    PRIMARY KEY (lo_session, hi_session, recipient_session)
  );
  CREATE INDEX IF NOT EXISTS dms_by_pair ON dms (lo_session, hi_session, seq);
  CREATE INDEX IF NOT EXISTS handles_by_owner ON handles (owner_session);
  `,
  // v2 — the durable adapter→session lease. One row per (adapter_id, session)
  // an adapter is currently serving, written by bindSession. On reconnect the
  // hello handler reads this table for the presented adapter_id and re-binds
  // each leased session immediately (no tool call), surviving a hub restart
  // because the lease is on disk. Superseded only by a /resume (bindSession
  // drops the prior session's row); never deleted on disconnect. GC of orphaned
  // rows is out of scope (see docs/group-chat-adapter-reconnect.md).
  `
  CREATE TABLE IF NOT EXISTS adapter_sessions (
    adapter_id TEXT,
    session_id TEXT,
    PRIMARY KEY (adapter_id, session_id)
  );
  `,
];

function runMigrations(): void {
  const cur =
    (db.query("PRAGMA user_version").get() as { user_version: number } | null)?.user_version ?? 0;
  for (let i = 0; i < MIGRATIONS.length; i++) {
    const version = i + 1;
    if (version <= cur) continue;
    const sql = MIGRATIONS[i]!;
    const apply = db.transaction(() => {
      db.exec(sql);
      // PRAGMA user_version can't be parameterized; version is a controlled int.
      db.exec(`PRAGMA user_version = ${version}`);
    });
    apply();
  }
}
runMigrations();

// The reserved suffix that turns a handle into a group handle: <name>@<group>._group.
function groupHandleSuffix(group: string): string {
  return `@${group}${GROUP_SUFFIX}`;
}

// Escape SQL LIKE wildcards (`%`, `_`) and the escape char itself for a literal
// match. Used to build patterns from group/member names (which allow `_`). Paired
// with `ESCAPE '\\'` on the prepared statements.
function likeEscape(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

// LIKE pattern that matches every handle in a group: `%@<group>._group`, with the
// fixed suffix escaped so `_` in names/`_group` is literal, not a wildcard.
function groupHandlePattern(group: string): string {
  return `%${likeEscape(groupHandleSuffix(group))}`;
}

// Strip the `@<group>._group` suffix off a group handle to get the member name.
function handleToMemberName(handle: string, group: string): string {
  const suffix = groupHandleSuffix(group);
  return handle.endsWith(suffix) ? handle.slice(0, -suffix.length) : handle;
}

// Prepared statements (reused; bun:sqlite caches the compiled plan).
const stmt = {
  insertGroup: db.query("INSERT OR IGNORE INTO groups (name, created_ts) VALUES (?, ?)"),
  // handles — the single registry for "a name owned by an identity". A group
  // handle is `<name>@<group>._group`; a registered alias is `<name>@<host>`.
  insertHandle: db.query(
    "INSERT INTO handles (handle, owner_session, created_ts) VALUES (?, ?, ?)",
  ),
  deleteHandle: db.query("DELETE FROM handles WHERE handle = ? AND owner_session = ?"),
  selectHandleOwner: db.query("SELECT owner_session, created_ts FROM handles WHERE handle = ?"),
  // every handle in a group, ordered by name; membership is DERIVED from this.
  selectHandlesInGroup: db.query(
    "SELECT handle, owner_session, created_ts FROM handles WHERE handle LIKE ? ESCAPE '\\' ORDER BY handle ASC",
  ),
  // the caller identity's handle in a group (it owns at most one).
  selectMyHandleInGroup: db.query(
    "SELECT handle, owner_session, created_ts FROM handles WHERE owner_session = ? AND handle LIKE ? ESCAPE '\\' LIMIT 1",
  ),
  // registered aliases (handles NOT ending in the group suffix) owned by a session.
  // The `_` in `._group` is a LIKE wildcard, so the suffix is escaped and matched
  // with `ESCAPE '\\'` — otherwise `'%._group'` would mean "ends `.<any-char>group`"
  // and could mis-classify a host whose name happens to end that way.
  selectAliasesForOwner: db.query(
    "SELECT handle FROM handles WHERE owner_session = ? AND handle NOT LIKE '%.\\_group' ESCAPE '\\'",
  ),
  // whoami shows the owner ALL their handles — including group handles
  // (`<name>@<group>._group`), which are identities/addresses too. (The
  // `aliasesForSession` path above stays `@host`-only for the directory/register
  // replies.)
  selectAllHandlesForOwner: db.query("SELECT handle FROM handles WHERE owner_session = ?"),
  selectAllAliases: db.query(
    "SELECT handle, owner_session FROM handles WHERE handle NOT LIKE '%.\\_group' ESCAPE '\\'",
  ),
  insertMessage: db.query(
    "INSERT INTO messages (group_name, seq, from_handle, ts, msg_id, text) VALUES (?, ?, ?, ?, ?, ?)",
  ),
  selectGroups: db.query("SELECT name FROM groups"),
  selectMaxSeq: db.query("SELECT MAX(seq) AS m FROM messages WHERE group_name = ?"),
  selectWindow: db.query(
    "SELECT group_name, seq, from_handle, ts, msg_id, text FROM messages WHERE group_name = ? ORDER BY seq DESC LIMIT ?",
  ),
  selectHistory: db.query(
    "SELECT group_name, seq, from_handle, ts, msg_id, text FROM messages WHERE group_name = ? ORDER BY seq ASC",
  ),
  insertDm: db.query(
    "INSERT INTO dms (lo_session, hi_session, seq, from_session, from_alias, to_session, to_alias, ts, msg_id, text, state) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ),
  maxDmSeq: db.query("SELECT MAX(seq) AS m FROM dms WHERE lo_session = ? AND hi_session = ?"),
  updateDmState: db.query(
    "UPDATE dms SET state = ? WHERE lo_session = ? AND hi_session = ? AND seq = ? AND to_session = ?",
  ),
  selectDmState: db.query(
    "SELECT state FROM dms WHERE lo_session = ? AND hi_session = ? AND seq = ?",
  ),
  selectUndeliveredDms: db.query(
    "SELECT lo_session, hi_session, seq, from_session, from_alias, to_session, to_alias, ts, msg_id, text, state " +
      "FROM dms d WHERE d.to_session = ? AND d.seq > COALESCE(" +
      "(SELECT delivered_seq FROM dm_delivery dd WHERE dd.lo_session = d.lo_session AND dd.hi_session = d.hi_session AND dd.recipient_session = ?), 0) " +
      "ORDER BY d.lo_session, d.hi_session, d.seq ASC",
  ),
  selectDmThread: db.query(
    "SELECT lo_session, hi_session, seq, from_session, from_alias, to_session, to_alias, ts, msg_id, text, state " +
      "FROM dms WHERE lo_session = ? AND hi_session = ? ORDER BY seq ASC",
  ),
  upsertDelivery: db.query(
    "INSERT INTO dm_delivery (lo_session, hi_session, recipient_session, delivered_seq) VALUES (?, ?, ?, ?) " +
      "ON CONFLICT(lo_session, hi_session, recipient_session) DO UPDATE SET delivered_seq = excluded.delivered_seq " +
      "WHERE excluded.delivered_seq > dm_delivery.delivered_seq",
  ),
  // every session id we have ever observed: as an alias owner, a dm participant,
  // or a member handle is NOT enough (handles aren't session ids), so the
  // directory's session universe is alias owners + dm participants + live conns.
  selectDmSessions: db.query(
    "SELECT from_session AS s FROM dms UNION SELECT to_session AS s FROM dms",
  ),
  // adapter→session lease (migration v2 / protocol v5 reconnect). UPSERT on bind,
  // SELECT on hello to re-bind a reconnecting adapter's sessions, DELETE on
  // resume-supersede.
  upsertAdapterSession: db.query(
    "INSERT OR IGNORE INTO adapter_sessions (adapter_id, session_id) VALUES (?, ?)",
  ),
  selectAdapterSessions: db.query(
    // ORDER BY for a deterministic re-bind order. Under normal operation there is
    // at most ONE row per adapter_id (resume-supersede deletes the prior session's
    // row on every /resume), so this is a singleton in practice; the ordering only
    // matters as defensive determinism should that invariant ever break.
    "SELECT session_id FROM adapter_sessions WHERE adapter_id = ? ORDER BY session_id ASC",
  ),
  deleteAdapterSession: db.query(
    "DELETE FROM adapter_sessions WHERE adapter_id = ? AND session_id = ?",
  ),
};

// Current head seq of a group (0 if none). The DB owns group seq; this is how a
// new member's `delivered` cursor is seeded (start at head = no-backfill on join).
function groupHead(name: string): number {
  return (stmt.selectMaxSeq.get(name) as { m: number | null })?.m ?? 0;
}

// ---------------------------------------------------------------------------
// Atomic seq assignment. `seq` for both groups and DMs is owned solely by the DB
// (no mirrored in-memory counter): assigning it = read MAX(seq)+1 and INSERT in
// ONE transaction, so concurrent writers to the same group/pair can't read the
// same max and collide. db.transaction(fn) commits on return, rolls back on throw.

const assignAndInsertMessage = db.transaction(
  (group_name: string, from: string, ts: string, msg_id: string, text: string): number => {
    const max = (stmt.selectMaxSeq.get(group_name) as { m: number | null })?.m ?? 0;
    const seq = max + 1;
    stmt.insertMessage.run(group_name, seq, from, ts, msg_id, text);
    return seq;
  },
);

const assignAndInsertDm = db.transaction(
  (p: {
    lo: string;
    hi: string;
    fromSession: string;
    fromAlias: string;
    toSession: string;
    toAlias: string;
    ts: string;
    msg_id: string;
    text: string;
  }): number => {
    const max = (stmt.maxDmSeq.get(p.lo, p.hi) as { m: number | null })?.m ?? 0;
    const seq = max + 1;
    stmt.insertDm.run(
      p.lo,
      p.hi,
      seq,
      p.fromSession,
      p.fromAlias,
      p.toSession,
      p.toAlias,
      p.ts,
      p.msg_id,
      p.text,
      "sent",
    );
    return seq;
  },
);

// ---------------------------------------------------------------------------
// In-memory live view. Rebuilt from the DB on startup; transient connection
// bindings are never persisted.

interface Connection {
  id: string;
  authed: boolean;
  // The per-process relay id this socket presented (or was minted) at `hello`.
  // The durable `adapter_sessions` lease is keyed by it: bindSession writes the
  // (adapterId, session) row, and the hello handler re-binds the leased sessions
  // for a reconnecting adapter. Set at hello; "" until then.
  adapterId: string;
  // One adapter socket can serve several Claude SESSIONS (e.g. /resume into a
  // different session over the same adapter). `sessions` is every session id the
  // adapter has asserted on this socket; `sessionId` is the one asserted on the
  // current frame (the account whose identity/DM op we're serving right now).
  sessions: Set<string>;
  sessionId: string | null;
  // The ACTIVE session last established by `bindSession` (the instance's current
  // identity — what a /resume changes). Distinct from `sessionId`, which is the
  // per-FRAME account (and which attribution-only frames like dm_ack/dm_read may
  // transiently set to a DIFFERENT session). The resume-supersede compares a new
  // active bind against THIS, so a DM receipt can't masquerade as a resume and
  // tear down the live session. Null until the first bind. See
  // docs/group-chat-adapter-reconnect.md.
  boundSession: string | null;
  host: string; // the device hostname the adapter reported at hello
  // groups this connection is joined to, keyed by group name -> the member names
  // it joined as on THIS socket. Kept ONLY to attribute spontaneous `ack`/`read`
  // frames (which carry no identity) back to the right member — NOT for `as`
  // selection (that's gone in v4: an identity owns at most one handle per group,
  // and the hub resolves it). It's a Set because one socket can serve several
  // sessions over its lifetime, each contributing its own member name per group.
  joinedAs: Map<string, Set<string>>;
  send(frame: ServerFrame): void;
}

interface Group {
  name: string;
  window: ChatMessage[]; // recent messages kept in memory for gap re-send
  // last group seq each MEMBER NAME has confirmed receiving, for the brief-
  // reconnect gap-resend. In-memory only (reset to head on restart): group
  // delivery is online-only, no durable group cursor. Keyed by member name (the
  // handle's local part), which a session maps to via its one handle in the group.
  delivered: Map<string, number>;
}

const groups = new Map<string, Group>();

// session id -> the set of live connections bound to it. Normally one, but we
// tolerate several (e.g. transient overlap during reconnect). Used to route DMs
// to an online recipient and to compute online state.
const sessionConns = new Map<string, Set<Connection>>();
// session id -> the host last reported for it (its default-alias host).
const sessionHost = new Map<string, string>();

// ---- PreToolUse session correlation ---------------------------------------
// `tool_use_id -> SessionSlot`, the rendezvous between the PreToolUse hook (which
// authoritatively reports `(tool_use_id, session_id)` on its own transient
// connection) and the adapter's account-bound frame (which carries the bare
// `tool_use_id`). Either party may arrive first, so a slot is a single
// CompletableDeferred per tool_use_id: whoever arrives first creates it, the other
// awaits/reads it. `value` is the session id once known (used for synchronous
// reads + TTL pruning); `promise` is what a frame awaits when it raced ahead of
// the registration. `complete(sid)` is idempotent and fired by the hook (real sid)
// or by the slot's own timeout (null = give up). One object replaces the former
// resolved-map + waiter-array pair.
interface SessionSlot {
  value: string | null; // resolved session id; null while pending or after timeout
  ts: number; // creation/refresh time, for TTL pruning
  promise: Promise<string | null>;
  complete(sid: string | null): void; // idempotent; resolves promise + sets value
}
const sessionSlots = new Map<string, SessionSlot>();

// Drop expired slots (and a hard size backstop). Called opportunistically on each
// registration — no background timer needed.
function pruneSessionSlots(): void {
  const cutoff = Date.now() - SESSION_MAP_TTL_MS;
  for (const [id, s] of sessionSlots) {
    if (s.ts < cutoff) sessionSlots.delete(id);
  }
  if (sessionSlots.size > SESSION_MAP_MAX) {
    // oldest-first eviction (Map preserves insertion order; re-set on refresh).
    const over = sessionSlots.size - SESSION_MAP_MAX;
    let i = 0;
    for (const id of sessionSlots.keys()) {
      if (i++ >= over) break;
      sessionSlots.delete(id);
    }
  }
}

// Create a pending slot: a CompletableDeferred with a built-in liveness timeout.
// `complete` is idempotent and clears the timer; if nothing completes it within
// SESSION_MAP_WAIT_MS it self-completes with null (the hook never arrived). The
// timeout lives INSIDE the slot — callers just await `slot.promise`.
function newPendingSlot(): SessionSlot {
  let resolveFn: (sid: string | null) => void;
  const slot: SessionSlot = {
    value: null,
    ts: Date.now(),
    promise: new Promise<string | null>((res) => {
      resolveFn = res;
    }),
    complete(sid) {
      if (this.value !== null) return; // already completed (idempotent)
      this.value = sid;
      clearTimeout(timer);
      resolveFn(sid);
    },
  };
  const timer = setTimeout(() => slot.complete(null), SESSION_MAP_WAIT_MS);
  return slot;
}

// The hook reports a real session for a tool_use_id. If a frame already raced
// ahead and parked a pending slot, complete it (waking the awaiting frame);
// otherwise pre-create a resolved slot so a frame arriving LATER reads it
// synchronously. Refresh `ts` so the TTL window starts at registration.
function registerSessionMapping(toolUseId: string, sessionId: string): void {
  const existing = sessionSlots.get(toolUseId);
  if (existing) {
    existing.ts = Date.now();
    existing.complete(sessionId);
  } else {
    sessionSlots.set(toolUseId, {
      value: sessionId,
      ts: Date.now(),
      promise: Promise.resolve(sessionId),
      complete() {}, // already resolved; nothing to wake
    });
  }
  pruneSessionSlots();
}

// Resolve a tool_use_id to its session id. Returns the resolved value immediately
// if the hook already registered it; otherwise parks a pending slot and awaits it
// up to SESSION_MAP_WAIT_MS, resolving null on timeout (callers decide: identity/
// DM error, group proceed).
function resolveToolSession(toolUseId: string): Promise<string | null> {
  let slot = sessionSlots.get(toolUseId);
  if (!slot) sessionSlots.set(toolUseId, (slot = newPendingSlot()));
  return slot.promise;
}

// Pending GROUP read-receipt collectors, keyed `${group}#${seq}`.
interface ReadCollector {
  awaiting: Set<string>; // recipient names not yet confirmed
  read: Set<string>; // recipient names that confirmed within the window
  done: () => void; // resolve early when awaiting drains
}
const pendingReads = new Map<string, ReadCollector>();

// Pending DM read-receipt collectors, keyed `${pairKey}#${seq}`. A `dm` to an
// online recipient registers one; an inbound `dm_read` resolves it early so the
// sender's `dm_sent` can report `read`.
interface DmReadCollector {
  done: () => void;
  read: boolean;
}
const pendingDmReads = new Map<string, DmReadCollector>();

function nowIso(): string {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Startup recovery: rebuild groups + per-group seq/window from SQLite. Membership
// is NOT rebuilt — it's derived on demand from the durable `handles` table.

function recoverGroups(): void {
  for (const row of stmt.selectGroups.all() as { name: string }[]) {
    const name = row.name;
    if (!GROUP_NAME_RE.test(name)) continue;
    // newest WINDOW messages, ascending for the in-memory window
    const recent = (stmt.selectWindow.all(name, WINDOW) as MsgRow[])
      .map(rowToMsg)
      .reverse();
    groups.set(name, {
      name,
      window: recent,
      delivered: new Map(),
    });
  }
  // Membership is DERIVED from the durable `handles` table — nothing to reload
  // into memory. `delivered` cursors are intentionally empty after restart (group
  // push is online-only; the gap window is in-memory).
}

interface MsgRow {
  group_name: string;
  seq: number;
  from_handle: string;
  ts: string;
  msg_id: string;
  text: string;
}
function rowToMsg(r: MsgRow): ChatMessage {
  return {
    group: r.group_name,
    seq: r.seq,
    from: r.from_handle,
    ts: r.ts,
    msg_id: r.msg_id,
    text: r.text,
  };
}

interface DmRow {
  lo_session: string;
  hi_session: string;
  seq: number;
  from_session: string;
  from_alias: string;
  to_session: string;
  to_alias: string;
  ts: string;
  msg_id: string;
  text: string;
  state: string;
}
function rowToDm(r: DmRow): DirectMessage {
  return {
    seq: r.seq,
    from_session: r.from_session,
    from_alias: r.from_alias,
    to_session: r.to_session,
    to_alias: r.to_alias,
    ts: r.ts,
    msg_id: r.msg_id,
    text: r.text,
    state: r.state as DirectMessage["state"],
  };
}

function getOrCreateGroup(name: string): Group {
  let g = groups.get(name);
  if (!g) {
    g = { name, window: [], delivered: new Map() };
    groups.set(name, g);
    stmt.insertGroup.run(name, nowIso());
  }
  return g;
}

// A derived group member: a `<name>@<group>._group` handle row. `owner` is the
// identity that holds it; `online` is whether that identity has a live connection.
interface GroupMember {
  name: string;
  handle: string;
  owner: string;
  created_ts: string;
}

interface HandleRow {
  handle: string;
  owner_session: string;
  created_ts: string;
}

// Membership derived from the handle table: every `<name>@<group>._group` handle.
function membersOf(group: string): GroupMember[] {
  const rows = stmt.selectHandlesInGroup.all(groupHandlePattern(group)) as HandleRow[];
  return rows.map((r) => ({
    name: handleToMemberName(r.handle, group),
    handle: r.handle,
    owner: r.owner_session,
    created_ts: r.created_ts,
  }));
}

// The caller identity's handle in a group (at most one — one identity per group).
// Returns the member-name part, or null if the identity is not a member.
function myMemberName(sessionId: string, group: string): string | null {
  const row = stmt.selectMyHandleInGroup.get(sessionId, groupHandlePattern(group)) as
    | HandleRow
    | null;
  return row ? handleToMemberName(row.handle, group) : null;
}

// The member names this connection currently participates as in a group — used to
// attribute spontaneous `ack`/`read` frames (which carry no identity) back to the
// right member. Populated by `join` on this conn; falls back to deriving from the
// conn's bound sessions if the live record is empty (e.g. after a reconnect that
// re-bound the session before an explicit re-join).
function connMemberNames(conn: Connection, group: string): Set<string> {
  const live = conn.joinedAs.get(group);
  if (live && live.size > 0) return live;
  const out = new Set<string>();
  for (const sid of conn.sessions) {
    const name = myMemberName(sid, group);
    if (name !== null) out.add(name);
  }
  return out;
}

function memberInfo(m: GroupMember): MemberInfo {
  return {
    name: m.name,
    attached: isOnline(m.owner),
    joined_ts: m.created_ts,
    last_seen_ts: m.created_ts,
  };
}

// ---------------------------------------------------------------------------
// Group broadcast (online-only push + durable log). `to` restricts the live
// PUSH (not the log) to the named group member handles; everyone else still gets
// the message in history.

function broadcast(
  group: Group,
  from: string,
  text: string,
  to?: string[],
): { msg: ChatMessage; recipients: string[] } {
  // seq is DB-owned: assigned as MAX(seq)+1 and inserted in one transaction (no
  // mirrored in-memory counter). 1) durable append first, getting the seq back.
  const ts = nowIso();
  const msg_id = randomUUID();
  const seq = assignAndInsertMessage(group.name, from, ts, msg_id, text);
  const msg: ChatMessage = {
    group: group.name,
    seq,
    from,
    ts,
    msg_id,
    text,
  };
  // 2) keep it in the in-memory window for gap re-send
  group.window.push(msg);
  if (group.window.length > WINDOW) group.window.shift();
  // 3) fan out to every online member EXCEPT the sender, and — when `to` is set
  //    — only to member names listed in `to`. "Online" = the member's OWNING
  //    identity has a live connection (sessionConns); we push to each such conn.
  const filter = to ? new Set(to) : null;
  const recipients: string[] = [];
  for (const m of membersOf(group.name)) {
    if (m.name === from) {
      if (seq > (group.delivered.get(m.name) ?? 0)) group.delivered.set(m.name, seq);
      continue;
    }
    if (filter && !filter.has(m.name)) continue; // push-filtered out (still logged)
    const conns = liveConnsFor(m.owner);
    if (conns.length === 0) continue; // offline member: logged, not pushed
    for (const c of conns) c.send({ t: "message", msg });
    recipients.push(m.name);
    if (seq > (group.delivered.get(m.name) ?? 0)) group.delivered.set(m.name, seq);
  }
  return { msg, recipients };
}

// Re-send the brief-reconnect gap to a returning member: every windowed message
// past the member's in-memory delivered cursor, to that identity's live conns.
function resendGap(memberName: string, owner: string, group: Group): void {
  const delivered = group.delivered.get(memberName) ?? 0;
  const conns = liveConnsFor(owner);
  if (conns.length === 0) return;
  let last = delivered;
  for (const msg of group.window) {
    if (msg.seq > delivered) {
      for (const c of conns) c.send({ t: "message", msg });
      if (msg.seq > last) last = msg.seq;
    }
  }
  if (last > delivered) group.delivered.set(memberName, last);
}

function err(conn: Connection, code: string, message: string, rid?: string): void {
  conn.send({ t: "error", rid, code, message });
}

// ---------------------------------------------------------------------------
// Identity / alias helpers.

// Order a session pair (lo, hi) so a thread has one canonical key regardless of
// direction.
function pairOf(a: string, b: string): { lo: string; hi: string } {
  return a <= b ? { lo: a, hi: b } : { lo: b, hi: a };
}

function isOnline(sessionId: string): boolean {
  const set = sessionConns.get(sessionId);
  return !!set && set.size > 0;
}

function liveConnsFor(sessionId: string): Connection[] {
  const set = sessionConns.get(sessionId);
  return set ? [...set] : [];
}

// Every alias (host-qualified form) owned by a session, including its implicit
// default alias <session-id>@<host>. Registered aliases are handles NOT ending in
// the group suffix (the @host ones); they are already full strings.
function aliasesForSession(sessionId: string, host: string | undefined): string[] {
  const out: string[] = [];
  if (host) out.push(`${sessionId}@${host}`);
  for (const r of stmt.selectAliasesForOwner.all(sessionId) as { handle: string }[]) {
    out.push(r.handle);
  }
  return out;
}

// Resolve an address to a session id. Three forms, all now a single handle table:
//   <session-id>@<host>          default alias (the session itself, implicit)
//   <name>@<host>                registered alias (handle row)
//   <handle>@<group>._group      group handle (handle row) — DURABLE, independent
//                                of connection/attachment.
// Returns null if it doesn't resolve to a known session.
function resolveAddress(address: string): string | null {
  const at = address.lastIndexOf("@");
  if (at < 0) return null;
  const local = address.slice(0, at);
  const domain = address.slice(at + 1);
  if (!local || !domain) return null;

  // group handle: <handle>@<group>._group — a pure durable handle-row lookup. The
  // owning identity resolves whether or not it is currently attached.
  if (domain.endsWith(GROUP_SUFFIX)) {
    const row = stmt.selectHandleOwner.get(address) as HandleRow | null;
    return row ? row.owner_session : null;
  }

  // default alias: local part contains a dash => it's a session id shape. We
  // confirm the session is known (has reported this host), else it's unknown.
  if (local.includes("-")) {
    // it names a session id directly; accept iff we've seen that session.
    if (sessionHost.has(local) || hasAnyTrace(local)) return local;
    return null;
  }

  // registered alias: <name>@<host> — the same handle table.
  const row = stmt.selectHandleOwner.get(address) as HandleRow | null;
  return row ? row.owner_session : null;
}

// Has this session id left any durable trace (owns an alias, or participated in
// a DM)? Lets a default-alias address resolve for a session that's offline but
// known. NOTE: a group handle is deliberately NOT a trace here — a group member
// is addressed via its durable `<name>@<group>._group` handle (resolved directly
// in resolveAddress), not via its session-id default alias, so a session whose
// only durable artifact is a group handle need not be reachable by default alias.
function hasAnyTrace(sessionId: string): boolean {
  const a = stmt.selectAliasesForOwner.all(sessionId) as unknown[];
  if (a.length > 0) return true;
  for (const r of stmt.selectDmSessions.all() as { s: string }[]) {
    if (r.s === sessionId) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Direct messages.

// Persist + route a DM. Returns the stored DirectMessage and whether it was
// pushed live (recipient online).
function storeDm(
  fromSession: string,
  fromAlias: string,
  toSession: string,
  toAlias: string,
  text: string,
): { dm: DirectMessage; pushed: boolean } {
  const { lo, hi } = pairOf(fromSession, toSession);
  const ts = nowIso();
  const msg_id = randomUUID();
  // Assign the per-pair seq and insert atomically: reading MAX(seq) and inserting
  // must be one transaction so two concurrent DMs to the same pair can't read the
  // same max and collide on seq. (Harmless under today's single-threaded Bun, but
  // the foundation is meant to scale — keep the invariant in the DB, not the runtime.)
  const seq = assignAndInsertDm({
    lo,
    hi,
    fromSession,
    fromAlias,
    toSession,
    toAlias,
    ts,
    msg_id,
    text,
  });
  const dm: DirectMessage = {
    seq,
    from_session: fromSession,
    from_alias: fromAlias,
    to_session: toSession,
    to_alias: toAlias,
    ts,
    msg_id,
    text,
    state: "sent",
  };
  // Try a live push if the recipient is online. If pushed, advance the
  // recipient's durable delivery cursor so it isn't re-flushed on reconnect.
  let pushed = false;
  for (const c of liveConnsFor(toSession)) {
    c.send({ t: "dm_message", msg: dm });
    pushed = true;
  }
  if (pushed) {
    stmt.upsertDelivery.run(lo, hi, toSession, seq);
  }
  return { dm, pushed };
}

// Flush a reconnecting session's undelivered DM queue: every DM addressed to it
// past its per-pair delivery cursor, one dm_message each, advancing the cursor.
function flushDmQueue(conn: Connection): void {
  const sid = conn.sessionId;
  if (!sid) return;
  const rows = stmt.selectUndeliveredDms.all(sid, sid) as DmRow[];
  for (const r of rows) {
    conn.send({ t: "dm_message", msg: rowToDm(r) });
    stmt.upsertDelivery.run(r.lo_session, r.hi_session, sid, r.seq);
  }
}

// ---------------------------------------------------------------------------
// Frame handling

function handleFrame(conn: Connection, frame: ClientEnvelope): void {
  const rid = frame.rid;

  if (frame.t === "hello") {
    if (frame.protocol !== PROTOCOL_VERSION) {
      err(conn, "protocol_mismatch", `hub speaks protocol ${PROTOCOL_VERSION}`, rid);
      return;
    }
    if (!ALLOW_NO_AUTH && frame.token !== TOKEN) {
      err(conn, "unauthorized", "bad token", rid);
      return;
    }
    conn.authed = true;
    conn.host = typeof frame.host === "string" && frame.host ? frame.host : "unknown";
    // Mint-or-reuse the per-process relay id. A reconnecting adapter echoes the
    // id the hub gave it; a brand-new one sends none and gets a fresh UUID. We
    // trust the presented id verbatim (the token already authed the socket) —
    // an unknown id simply has no lease rows, so it re-binds nothing.
    conn.adapterId =
      typeof frame.adapter_id === "string" && frame.adapter_id ? frame.adapter_id : randomUUID();
    conn.send({ t: "welcome", protocol: PROTOCOL_VERSION, adapter_id: conn.adapterId });
    // Re-bind every session this adapter was serving (the durable lease). This is
    // what restores `sessionConns` after a reconnect or hub restart with NO tool
    // call: each bindSession re-registers the live route and flushes the session's
    // queued DMs. A first-connect adapter has no lease rows, so this is a no-op.
    //
    // INVARIANT: at most ONE lease row per adapter_id (resume-supersede deletes the
    // prior session on every /resume). So this loop binds exactly one session and
    // never triggers the supersede inside bindSession (conn.boundSession is null on
    // entry). Were two rows ever to coexist (the invariant broken), the second bind
    // would supersede the first — destroying its lease — so the singleton invariant
    // is load-bearing, not incidental.
    const leased = stmt.selectAdapterSessions.all(conn.adapterId) as { session_id: string }[];
    for (const { session_id } of leased) bindSession(conn, session_id);
    return;
  }

  if (!conn.authed) {
    err(conn, "unauthorized", "send hello first", rid);
    return;
  }

  // Account binding happens in dispatchFrame (before this is called): it resolves
  // the frame's `tool_use_id` to the real session via the PreToolUse correlation
  // map (or honors a direct `session`), binds the connection to that account, and
  // flushes its queued DMs on the first binding.

  switch (frame.t) {
    case "ping":
      conn.send({ t: "pong" });
      return;

    case "map_session": {
      // The PreToolUse hook authoritatively reports a call's real session id.
      // Record it and wake any adapter frame already awaiting this tool_use_id.
      // Fire-and-forget: the hook closes right after; no reply is sent.
      if (
        typeof frame.tool_use_id === "string" && frame.tool_use_id &&
        typeof frame.session_id === "string" && frame.session_id
      ) {
        registerSessionMapping(frame.tool_use_id, frame.session_id);
      }
      return;
    }

    case "ack": {
      const g = groups.get(frame.group);
      if (g) {
        for (const as of connMemberNames(conn, frame.group)) {
          if (frame.seq > (g.delivered.get(as) ?? 0)) g.delivered.set(as, frame.seq);
        }
      }
      return;
    }

    case "read": {
      const col = pendingReads.get(`${frame.group}#${frame.seq}`);
      if (col) {
        for (const as of connMemberNames(conn, frame.group)) {
          if (col.awaiting.has(as)) {
            col.awaiting.delete(as);
            col.read.add(as);
          }
        }
        if (col.awaiting.size === 0) col.done();
      }
      return;
    }

    case "list_groups": {
      const list = [...groups.values()].map((g) => ({
        name: g.name,
        members: membersOf(g.name).length,
      }));
      conn.send({ t: "groups", rid, groups: list });
      return;
    }

    case "create_group": {
      if (!GROUP_NAME_RE.test(frame.group)) {
        err(conn, "bad_group_name", "group must match [A-Za-z0-9_-]{1,64}", rid);
        return;
      }
      getOrCreateGroup(frame.group);
      conn.send({ t: "created", rid, group: frame.group });
      return;
    }

    case "join": {
      if (!GROUP_NAME_RE.test(frame.group)) {
        err(conn, "bad_group_name", "group must match [A-Za-z0-9_-]{1,64}", rid);
        return;
      }
      if (!MEMBER_NAME_RE.test(frame.as)) {
        err(conn, "bad_member_name", "name must match [A-Za-z0-9_-]{1,64}", rid);
        return;
      }
      // Group membership is an identity-owned handle; joining REQUIRES a resolved
      // identity. The handle `<as>@<group>._group` is owned by the caller.
      const sid = requireSession(conn, rid);
      if (!sid) return;
      const g = getOrCreateGroup(frame.group);
      const handle = `${frame.as}${groupHandleSuffix(frame.group)}`;
      const existing = stmt.selectHandleOwner.get(handle) as HandleRow | null;
      if (existing && existing.owner_session !== sid) {
        // A DIFFERENT identity holds this handle — genuine collision.
        err(conn, "handle_taken", `'${frame.as}' is already taken in '${frame.group}'`, rid);
        return;
      }
      const isReturning = existing !== null; // same owner re-registering -> idempotent
      if (!isReturning) {
        stmt.insertHandle.run(handle, sid, nowIso());
        // Seed the gap cursor at head: a brand-new member gets NO backfill.
        if (!g.delivered.has(frame.as)) g.delivered.set(frame.as, groupHead(frame.group));
      }
      // Record the live routing handle for ack/read attribution on this conn.
      let names = conn.joinedAs.get(frame.group);
      if (!names) conn.joinedAs.set(frame.group, (names = new Set()));
      names.add(frame.as);
      conn.send({ t: "joined", rid, group: frame.group, as: frame.as });
      // Returning identity: re-send the brief-reconnect gap to its live conns. If
      // the hub has no in-memory cursor for this member (a member durable from
      // before a hub RESTART), seed at head first so the restart causes NO
      // backfill (group push is online-only; only the live in-memory gap replays).
      if (isReturning) {
        if (!g.delivered.has(frame.as)) g.delivered.set(frame.as, groupHead(frame.group));
        resendGap(frame.as, sid, g);
      }
      return;
    }

    case "leave": {
      // Drop the caller identity's handle in the group (at most one — unambiguous,
      // no `as` needed). Requires a resolved identity.
      const sid = requireSession(conn, rid);
      if (!sid) return;
      const g = groups.get(frame.group);
      const name = myMemberName(sid, frame.group);
      if (name !== null) {
        stmt.deleteHandle.run(`${name}${groupHandleSuffix(frame.group)}`, sid);
        const names = conn.joinedAs.get(frame.group);
        if (names) {
          names.delete(name);
          if (names.size === 0) conn.joinedAs.delete(frame.group);
        }
        if (g) g.delivered.delete(name);
      }
      conn.send({ t: "left", rid, group: frame.group });
      return;
    }

    case "send": {
      // The hub resolves the sender's handle from the caller's identity — no `as`
      // on the wire. Sending REQUIRES being a member (owning a group handle).
      const sid = requireSession(conn, rid);
      if (!sid) return;
      const g = groups.get(frame.group);
      const as = g ? myMemberName(sid, frame.group) : null;
      if (!g || as === null) {
        err(conn, "not_in_group", `join '${frame.group}' first before sending`, rid);
        return;
      }
      // `to` push-filter: entries must be CURRENT members of this group. If ANY
      // entry is a non-member, the whole send fails (decision O1) — no partial
      // send. The message is otherwise logged for everyone; `to` filters the
      // push only.
      let toFilter: string[] | undefined;
      const memberNames = new Set(membersOf(g.name).map((x) => x.name));
      if (frame.to !== undefined) {
        if (!Array.isArray(frame.to)) {
          err(conn, "to_non_member", "`to` must be an array of member names", rid);
          return;
        }
        for (const name of frame.to) {
          if (!memberNames.has(name)) {
            err(conn, "to_non_member", `'${name}' is not a member of '${frame.group}'`, rid);
            return;
          }
        }
        toFilter = frame.to;
      }
      const { msg, recipients } = broadcast(g, as, frame.message, toFilter);

      const key = `${g.name}#${msg.seq}`;
      // The set of names a receipt is awaited from: the recipients we pushed to.
      // `sent` reports everyone else the message went to in history terms — when
      // filtered, that's exactly the targeted recipients; unfiltered, the whole
      // group minus sender.
      const others = () => {
        const base = toFilter
          ? toFilter.filter((n) => n !== as)
          : [...memberNames].filter((n) => n !== as);
        return base;
      };

      if (recipients.length === 0) {
        conn.send({ t: "sent", rid, group: g.name, seq: msg.seq, read: [], sent: others() });
        return;
      }

      const col: ReadCollector = {
        awaiting: new Set(recipients),
        read: new Set(),
        done: () => {},
      };
      pendingReads.set(key, col);

      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        pendingReads.delete(key);
        const read = [...col.read];
        const sent = others().filter((n) => !col.read.has(n));
        conn.send({ t: "sent", rid, group: g.name, seq: msg.seq, read, sent });
      };
      col.done = finish;
      const timer = setTimeout(finish, READ_RECEIPT_MS);
      return;
    }

    case "list_members": {
      const g = groups.get(frame.group);
      if (!g) {
        err(conn, "no_such_group", `no group '${frame.group}'`, rid);
        return;
      }
      conn.send({
        t: "members",
        rid,
        group: frame.group,
        members: membersOf(frame.group).map(memberInfo),
      });
      return;
    }

    case "show_member": {
      const g = groups.get(frame.group);
      if (!g) {
        err(conn, "no_such_group", `no group '${frame.group}'`, rid);
        return;
      }
      const m = membersOf(frame.group).find((x) => x.name === frame.member);
      conn.send({
        t: "member",
        rid,
        group: frame.group,
        member: m ? memberInfo(m) : null,
      });
      return;
    }

    case "history": {
      const g = groups.get(frame.group);
      if (!g) {
        err(conn, "no_such_group", `no group '${frame.group}'`, rid);
        return;
      }
      const all = (stmt.selectHistory.all(frame.group) as MsgRow[]).map(rowToMsg);
      const fromEnd = Math.max(0, frame.index_from_end | 0);
      const n = Math.max(0, frame.last_n | 0);
      const end = all.length - fromEnd;
      const start = Math.max(0, end - n);
      conn.send({ t: "history", rid, group: frame.group, messages: all.slice(start, end) });
      return;
    }

    // ---- identity / aliases (v3) ----

    case "register_alias": {
      const sid = requireSession(conn, rid);
      if (!sid) return;
      if (!ALIAS_NAME_RE.test(frame.name)) {
        err(conn, "bad_alias_name", "alias must match [A-Za-z0-9_]{1,64} (no dashes)", rid);
        return;
      }
      // An alias is a handle `<name>@<host>`. First-holder-wins on the handle table.
      const aliasHandle = `${frame.name}@${conn.host}`;
      const existing = stmt.selectHandleOwner.get(aliasHandle) as HandleRow | null;
      if (existing) {
        if (existing.owner_session === sid) {
          // idempotent: re-registering your own alias succeeds.
          conn.send({ t: "aliases", rid, aliases: aliasesForSession(sid, conn.host) });
          return;
        }
        err(conn, "alias_taken", `'${aliasHandle}' is owned by another session`, rid);
        return;
      }
      stmt.insertHandle.run(aliasHandle, sid, nowIso());
      conn.send({ t: "aliases", rid, aliases: aliasesForSession(sid, conn.host) });
      return;
    }

    case "release_alias": {
      const sid = requireSession(conn, rid);
      if (!sid) return;
      const aliasHandle = `${frame.name}@${conn.host}`;
      const existing = stmt.selectHandleOwner.get(aliasHandle) as HandleRow | null;
      if (!existing) {
        err(conn, "no_such_address", `no alias '${aliasHandle}'`, rid);
        return;
      }
      if (existing.owner_session !== sid) {
        err(conn, "not_alias_owner", `you do not own '${aliasHandle}'`, rid);
        return;
      }
      stmt.deleteHandle.run(aliasHandle, sid);
      conn.send({ t: "aliases", rid, aliases: aliasesForSession(sid, conn.host) });
      return;
    }

    case "list_aliases": {
      const sid = requireSession(conn, rid);
      if (!sid) return;
      conn.send({ t: "aliases", rid, aliases: aliasesForSession(sid, conn.host) });
      return;
    }

    case "whoami": {
      const sid = requireSession(conn, rid);
      if (!sid) return;
      // ALL of this session's addresses, merged: the implicit default alias plus
      // every owned handle — registered `<name>@<host>` AND group
      // `<name>@<group>._group` (group handles are addresses too).
      const aliases: string[] = [];
      if (conn.host) aliases.push(`${sid}@${conn.host}`);
      for (const r of stmt.selectAllHandlesForOwner.all(sid) as { handle: string }[]) {
        aliases.push(r.handle);
      }
      conn.send({ t: "whoami", rid, session_id: sid, host: conn.host, aliases });
      return;
    }

    case "resolve_alias": {
      const session = resolveAddress(frame.address);
      conn.send({
        t: "resolved",
        rid,
        address: frame.address,
        session_id: session,
        online: session ? isOnline(session) : false,
      });
      return;
    }

    case "list_directory": {
      conn.send({ t: "directory", rid, entries: buildDirectory() });
      return;
    }

    // ---- direct messages (v3) ----

    case "dm": {
      const sid = requireSession(conn, rid);
      if (!sid) return;
      const toSession = resolveAddress(frame.to);
      if (!toSession) {
        err(conn, "no_such_address", `cannot resolve '${frame.to}'`, rid);
        return;
      }
      // The sender's own alias for this DM: the most specific identity it has on
      // this host — its first registered alias, else its default alias.
      const fromAlias = senderAlias(sid, conn.host);
      const { dm, pushed } = storeDm(sid, fromAlias, toSession, frame.to, frame.message);

      // If pushed to an online recipient, await a read within the window so the
      // reply can report `read`; else reply `sent` immediately (queued).
      if (!pushed) {
        conn.send({ t: "dm_sent", rid, seq: dm.seq, state: "sent" });
        return;
      }
      const { lo, hi } = pairOf(sid, toSession);
      const key = `${lo}|${hi}#${dm.seq}`;
      const col: DmReadCollector = { read: false, done: () => {} };
      pendingDmReads.set(key, col);
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        pendingDmReads.delete(key);
        conn.send({ t: "dm_sent", rid, seq: dm.seq, state: col.read ? "read" : "sent" });
      };
      col.done = finish;
      const timer = setTimeout(finish, READ_RECEIPT_MS);
      return;
    }

    case "dm_ack": {
      // recipient's adapter acked arrival: advance state sent -> received (never
      // downgrade a read).
      const sid = conn.sessionId;
      if (!sid) return;
      const { lo, hi } = pairOf(sid, frame.from_session);
      const cur = stmt.selectDmState.get(lo, hi, frame.seq) as { state: string } | null;
      if (cur && cur.state === "sent") {
        stmt.updateDmState.run("received", lo, hi, frame.seq, sid);
      }
      return;
    }

    case "dm_read": {
      // recipient's display hook surfaced the DM: advance to read and resolve any
      // pending sender wait.
      const sid = conn.sessionId;
      if (!sid) return;
      const { lo, hi } = pairOf(sid, frame.from_session);
      stmt.updateDmState.run("read", lo, hi, frame.seq, sid);
      const col = pendingDmReads.get(`${lo}|${hi}#${frame.seq}`);
      if (col) {
        col.read = true;
        col.done();
      }
      return;
    }

    case "dm_history": {
      const sid = requireSession(conn, rid);
      if (!sid) return;
      const peerSession = resolveAddress(frame.peer) ?? frame.peer; // accept a raw session id too
      const { lo, hi } = pairOf(sid, peerSession);
      const all = (stmt.selectDmThread.all(lo, hi) as DmRow[]).map(rowToDm);
      const fromEnd = Math.max(0, frame.index_from_end | 0);
      const n = Math.max(0, frame.last_n | 0);
      const end = all.length - fromEnd;
      const start = Math.max(0, end - n);
      conn.send({
        t: "dm_history",
        rid,
        peer_session: peerSession,
        messages: all.slice(start, end),
      });
      return;
    }
  }
}

// Session-scoped frames (identity / DM ops) require a bound account. The account
// is bound in dispatchFrame from the session correlated to the frame's
// tool_use_id (via the PreToolUse hook's map_session). If that correlation hasn't
// arrived within SESSION_MAP_WAIT_MS (or the call carried no tool_use_id), the
// account is unbound and these ops honest-error rather than act as the wrong one.
function requireSession(conn: Connection, rid?: string): string | null {
  if (!conn.sessionId) {
    err(
      conn,
      "no_session",
      "could not resolve your session (no account bound to this call)",
      rid,
    );
    return null;
  }
  return conn.sessionId;
}

// The host part of a registered-alias handle `<name>@<host>` (last @ segment).
function aliasHost(handle: string): string {
  const at = handle.lastIndexOf("@");
  return at >= 0 ? handle.slice(at + 1) : "";
}

// The alias the sender presents on an outgoing DM: its first registered alias on
// this host if any, else its default alias.
function senderAlias(sessionId: string, host: string): string {
  const regs = stmt.selectAliasesForOwner.all(sessionId) as { handle: string }[];
  const onHost = regs.find((r) => aliasHost(r.handle) === host);
  if (onHost) return onHost.handle;
  return `${sessionId}@${host}`;
}

// Build the directory: every known session (alias owners + DM participants +
// live connections), with its aliases, group memberships, and online flag.
// Group membership is DERIVED from the durable handle table — a session is in a
// group iff it owns a `@<group>._group` handle (independent of attachment).
function buildDirectory(): DirectoryEntry[] {
  const sessions = new Map<string, { host: string }>();
  // alias owners (registered aliases on the handle table)
  for (const r of stmt.selectAllAliases.all() as { handle: string; owner_session: string }[]) {
    if (!sessions.has(r.owner_session)) {
      sessions.set(r.owner_session, {
        host: sessionHost.get(r.owner_session) ?? aliasHost(r.handle),
      });
    }
  }
  // DM participants
  for (const r of stmt.selectDmSessions.all() as { s: string }[]) {
    if (!sessions.has(r.s)) sessions.set(r.s, { host: sessionHost.get(r.s) ?? "unknown" });
  }
  // live connections
  for (const [sid] of sessionConns) {
    if (!sessions.has(sid)) sessions.set(sid, { host: sessionHost.get(sid) ?? "unknown" });
  }

  // group memberships per session, derived from group handles (durable). Also
  // ensures any session owning ONLY a group handle appears in the directory.
  const groupsForSession = new Map<string, Set<string>>();
  for (const g of groups.values()) {
    for (const m of membersOf(g.name)) {
      if (!sessions.has(m.owner)) {
        sessions.set(m.owner, { host: sessionHost.get(m.owner) ?? "unknown" });
      }
      let set = groupsForSession.get(m.owner);
      if (!set) groupsForSession.set(m.owner, (set = new Set()));
      set.add(g.name);
    }
  }

  const out: DirectoryEntry[] = [];
  for (const [sid, info] of sessions) {
    const aliases = (stmt.selectAliasesForOwner.all(sid) as { handle: string }[]).map(
      (r) => r.handle,
    );
    out.push({
      session_id: sid,
      host: info.host,
      aliases,
      groups: [...(groupsForSession.get(sid) ?? [])],
      online: isOnline(sid),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Account binding. The real session id is correlated per-call by the hub: the
// PreToolUse hook reports `(tool_use_id, session_id)`, the adapter's frame carries
// the bare `tool_use_id`, and dispatchFrame resolves it to `sid` before calling
// this. (A directly-asserted `session` field also binds here, for the in-process/
// test path.) The hub keys all identity/DM ops off the bound account. A socket
// binds one account; if a different id is asserted later (e.g. a /resume into
// another session) we trust the latest, since the per-call correlation is
// authoritative and the adapter serves one instance.

function bindSession(conn: Connection, sid: string): void {
  // RESUME-SUPERSEDE (constraint 2): only the ACTIVE identity receives pushes.
  // `sessionConns` is the historical set (cleared only by onDisconnect), so a
  // socket that bound A then /resumes into B would keep delivering to A. Compare
  // against `boundSession` — the PRIOR ACTIVE session (NOT `sessionId`, which an
  // attribution-only dm_ack/dm_read frame may have transiently set to a different
  // account). If the active session is changing to a DIFFERENT non-null one,
  // detach the prior for THIS adapter — drop the conn from sessionConns[A], drop A
  // from conn.sessions, and delete its lease row — so a resumed-away identity
  // stops receiving pushes and is never re-bound on reconnect.
  const prev = conn.boundSession;
  if (prev && prev !== sid) {
    const prevSet = sessionConns.get(prev);
    if (prevSet) {
      prevSet.delete(conn);
      if (prevSet.size === 0) sessionConns.delete(prev);
    }
    conn.sessions.delete(prev);
    if (conn.adapterId) stmt.deleteAdapterSession.run(conn.adapterId, prev);
  }

  // The session resolved for THIS frame is the account we serve for it, and it is
  // now this conn's ACTIVE (bound) identity for the supersede comparison above.
  conn.sessionId = sid;
  conn.boundSession = sid;
  // Durable lease: record that this adapter serves this session, so a reconnect
  // (even after a hub restart) re-binds it. UPSERT is idempotent. Guard on a set
  // adapterId: it's "" only on a pre-hello conn, and every path that reaches
  // bindSession (the hello re-bind loop sets it first; dispatchFrame requires
  // auth, i.e. a completed hello) has it set — so the guard is a belt-and-braces
  // backstop, never false in practice.
  if (conn.adapterId) stmt.upsertAdapterSession.run(conn.adapterId, sid);
  if (conn.sessions.has(sid)) {
    // already routing for this session over this socket; keep host fresh.
    sessionHost.set(sid, conn.host);
    return;
  }
  // First time this socket asserts this session: register it as a live route and
  // flush any DMs queued for it while it was offline (one dm_message each).
  conn.sessions.add(sid);
  let set = sessionConns.get(sid);
  if (!set) sessionConns.set(sid, (set = new Set()));
  const wasOffline = set.size === 0;
  set.add(conn);
  sessionHost.set(sid, conn.host);
  if (wasOffline) flushDmQueue(conn);
}

// Bind the per-call account (if any) and dispatch one frame. Account binding has
// two sources, tried in order: a directly-asserted `session` (legacy/trusted
// in-process path), then a `tool_use_id` resolved via the PreToolUse correlation
// map. The tool_use_id path may AWAIT the hook's registration (bounded), so this
// is async; the WS message handler fires it without blocking the event loop.
async function dispatchFrame(conn: Connection, frame: ClientEnvelope): Promise<void> {
  try {
    // `hello` is pre-auth; `map_session` is fire-and-forget bookkeeping (it
    // requires auth but carries no per-call account binding). Neither stamps an
    // account, so skip resolution and dispatch directly.
    //
    // Lifetime contract for `conn.sessionId`: it is the CURRENT-FRAME account,
    // stamped here (resolve/bind or clear) immediately before `handleFrame` reads
    // it, and valid only for that synchronous `handleFrame` call. Because this is
    // an `await`ing async function fired with `void`, two frames on one socket can
    // be in-flight at once; each stamps then synchronously hands off to
    // `handleFrame` with no interleaving await, so in single-threaded JS each frame
    // reads its own value. Handlers MUST read `conn.sessionId` synchronously and
    // never cache it across an async boundary.
    if (conn.authed && frame.t !== "hello" && frame.t !== "map_session") {
      // 1) direct `session` assertion binds verbatim (no resolution needed).
      const direct = (frame as { session?: unknown }).session;
      // `dm_ack`/`dm_read` are ATTRIBUTION-ONLY: they assert a `session` purely so
      // the handler attributes a DM receipt to the right account on a multi-session
      // socket. They are NOT a change of the instance's ACTIVE session (a /resume),
      // so they must NOT run bindSession — which would register a push route and,
      // worse, SUPERSEDE the live active session (dropping it from sessionConns and
      // its lease). Stamp `conn.sessionId` for the handler to read, and skip the
      // active-session binding machinery entirely. See group-chat-adapter-reconnect.md.
      if (frame.t === "dm_ack" || frame.t === "dm_read") {
        conn.sessionId = typeof direct === "string" && direct ? direct : null;
      } else if (typeof direct === "string" && direct) {
        bindSession(conn, direct);
      } else if (typeof frame.tool_use_id === "string" && frame.tool_use_id) {
        // 2) resolve the real session from the PreToolUse correlation map. May
        //    await the hook's registration up to SESSION_MAP_WAIT_MS. On null
        //    (timeout): leave conn.sessionId unbound — identity/DM tools then
        //    honest-error via requireSession; group tools proceed without one.
        const sid = await resolveToolSession(frame.tool_use_id);
        if (sid) bindSession(conn, sid);
        else conn.sessionId = null;
      } else {
        // No per-call identity asserted at all: clear any stale current-frame
        // binding so an unbound frame can't ride a prior frame's account.
        conn.sessionId = null;
      }
    }
    handleFrame(conn, frame);
  } catch (e) {
    console.error("group-chat-hub: handler error:", e);
    err(conn, "internal", String(e), frame.rid);
  }
}

function onDisconnect(conn: Connection): void {
  // Membership is durable (handle rows) — nothing to null out on disconnect. The
  // member simply becomes "offline" (its owning identity loses its live conn).
  for (const sid of conn.sessions) {
    const set = sessionConns.get(sid);
    set?.delete(conn);
    if (set && set.size === 0) sessionConns.delete(sid);
  }
}

// ---------------------------------------------------------------------------
// WebSocket server (Bun native)

recoverGroups();

const server = Bun.serve<{ conn: Connection }>({
  port: PORT,
  hostname: HOST,
  fetch(req, srv) {
    // `data` is populated in open(); the upgrade just needs the connection slot.
    if (srv.upgrade(req, { data: {} as { conn: Connection } })) return; // upgraded to WS
    return new Response("group-chat hub: websocket only\n", { status: 426 });
  },
  websocket: {
    open(ws) {
      const conn: Connection = {
        id: randomUUID(),
        authed: false,
        adapterId: "", // assigned in the hello handler (mint-or-reuse)
        sessions: new Set<string>(),
        sessionId: null,
        boundSession: null,
        host: "unknown",
        joinedAs: new Map<string, Set<string>>(),
        send: (frame) => ws.send(JSON.stringify(frame)),
      };
      ws.data = { conn };
    },
    message(ws, raw) {
      const conn = ws.data.conn;
      let frame: ClientEnvelope;
      try {
        frame = JSON.parse(typeof raw === "string" ? raw : raw.toString()) as ClientEnvelope;
      } catch {
        err(conn, "bad_json", "could not parse frame");
        return;
      }
      void dispatchFrame(conn, frame);
    },
    close(ws) {
      onDisconnect(ws.data.conn);
    },
  },
});

console.error(
  `group-chat-hub: listening ws://${HOST}:${PORT}  ` +
    `(auth: ${ALLOW_NO_AUTH ? "OPEN" : "token"}, db: ${pathJoin(DATA_DIR, "hub.db")}, window: ${WINDOW})`,
);
void server;
