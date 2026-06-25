#!/usr/bin/env bun
// group-chat hub — the one networked process. Many Claude instances connect
// over WebSocket; many named groups live here so multiple projects share one
// hub. v3 adds an identity layer (accounts, aliases, direct messages) and moves
// durable storage to SQLite. See protocol.ts for the wire contract and
// group-chat-direct-messages.md for the identity/DM design.
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
// STORAGE: a single SQLite DB (bun:sqlite, WAL). Groups, members, group
// messages, aliases, DMs and per-recipient DM delivery cursors are all durable
// rows. The hub loads its world from the DB on startup. Group delivery is NOT
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
const SESSION_MAP_WAIT_MS = Number(process.env.GROUP_CHAT_SESSION_MAP_WAIT_MS ?? 2000);
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
db.exec(`
  CREATE TABLE IF NOT EXISTS groups (
    name TEXT PRIMARY KEY,
    created_ts TEXT
  );
  CREATE TABLE IF NOT EXISTS members (
    group_name TEXT, handle TEXT, joined_ts TEXT, last_seen_ts TEXT,
    PRIMARY KEY (group_name, handle),
    FOREIGN KEY (group_name) REFERENCES groups(name)
  );
  CREATE TABLE IF NOT EXISTS messages (
    group_name TEXT, seq INTEGER, from_handle TEXT, ts TEXT, msg_id TEXT, text TEXT,
    PRIMARY KEY (group_name, seq)
  );
  CREATE TABLE IF NOT EXISTS aliases (
    name TEXT, host TEXT, owner_session_id TEXT, created_ts TEXT,
    PRIMARY KEY (name, host)
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
`);

// Prepared statements (reused; bun:sqlite caches the compiled plan).
const stmt = {
  insertGroup: db.query("INSERT OR IGNORE INTO groups (name, created_ts) VALUES (?, ?)"),
  insertMember: db.query(
    "INSERT OR REPLACE INTO members (group_name, handle, joined_ts, last_seen_ts) VALUES (?, ?, ?, ?)",
  ),
  deleteMember: db.query("DELETE FROM members WHERE group_name = ? AND handle = ?"),
  touchMember: db.query("UPDATE members SET last_seen_ts = ? WHERE group_name = ? AND handle = ?"),
  insertMessage: db.query(
    "INSERT INTO messages (group_name, seq, from_handle, ts, msg_id, text) VALUES (?, ?, ?, ?, ?, ?)",
  ),
  selectGroups: db.query("SELECT name FROM groups"),
  selectMembers: db.query("SELECT group_name, handle, joined_ts, last_seen_ts FROM members"),
  selectMaxSeq: db.query("SELECT MAX(seq) AS m FROM messages WHERE group_name = ?"),
  selectWindow: db.query(
    "SELECT group_name, seq, from_handle, ts, msg_id, text FROM messages WHERE group_name = ? ORDER BY seq DESC LIMIT ?",
  ),
  selectHistory: db.query(
    "SELECT group_name, seq, from_handle, ts, msg_id, text FROM messages WHERE group_name = ? ORDER BY seq ASC",
  ),
  insertAlias: db.query(
    "INSERT INTO aliases (name, host, owner_session_id, created_ts) VALUES (?, ?, ?, ?)",
  ),
  selectAlias: db.query("SELECT owner_session_id FROM aliases WHERE name = ? AND host = ?"),
  deleteAlias: db.query("DELETE FROM aliases WHERE name = ? AND host = ? AND owner_session_id = ?"),
  selectAliasesForOwner: db.query("SELECT name, host FROM aliases WHERE owner_session_id = ?"),
  selectAllAliases: db.query("SELECT name, host, owner_session_id FROM aliases"),
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
  // One adapter socket can serve several Claude SESSIONS (e.g. /resume into a
  // different session over the same adapter). `sessions` is every session id the
  // adapter has asserted on this socket; `sessionId` is the one asserted on the
  // current frame (the account whose identity/DM op we're serving right now).
  sessions: Set<string>;
  sessionId: string | null;
  host: string; // the device hostname the adapter reported at hello
  // groups this connection is joined to, keyed by group name -> the SET of member
  // names it joined as. One adapter socket can serve several Claude sessions, so
  // it can hold several handles in the SAME group; the per-message `as` selects.
  joinedAs: Map<string, Set<string>>;
  send(frame: ServerFrame): void;
}

interface Member {
  name: string;
  conn: Connection | null; // null => not currently attached (still a member)
  joined_ts: string;
  last_seen_ts: string;
  // last seq this member confirmed receiving. In-memory only (resets to head on
  // restart): group delivery is online-only, no durable group cursor.
  delivered: number;
}

interface Group {
  name: string;
  members: Map<string, Member>; // by member name
  window: ChatMessage[]; // recent messages kept in memory for gap re-send
}

const groups = new Map<string, Group>();

// session id -> the set of live connections bound to it. Normally one, but we
// tolerate several (e.g. transient overlap during reconnect). Used to route DMs
// to an online recipient and to compute online state.
const sessionConns = new Map<string, Set<Connection>>();
// session id -> the host last reported for it (its default-alias host).
const sessionHost = new Map<string, string>();

// ---- PreToolUse session correlation ---------------------------------------
// `tool_use_id -> session_id`, populated by the PreToolUse hook's `map_session`
// frame (its own transient connection). An account-bound adapter frame carries
// the bare `tool_use_id`; the hub resolves the real session from this map and
// binds the account exactly as a directly-asserted `session` would. Entries are
// pruned by TTL (a tool_use_id is short-lived — a single call's frames).
interface MapEntry {
  session_id: string;
  ts: number;
}
const toolSessionMap = new Map<string, MapEntry>();
// `tool_use_id -> waiters` for frames that arrived BEFORE the registration. The
// `map_session` handler resolves every waiter; a per-waiter timer honest-errors
// (or proceeds without a session) on timeout. Several frames of one call may wait.
const pendingSessionWaiters = new Map<string, Array<(sid: string | null) => void>>();

// Drop expired entries (and a hard size backstop). Called opportunistically on
// each registration — no background timer needed.
function pruneToolSessionMap(): void {
  const cutoff = Date.now() - SESSION_MAP_TTL_MS;
  for (const [id, e] of toolSessionMap) {
    if (e.ts < cutoff) toolSessionMap.delete(id);
  }
  if (toolSessionMap.size > SESSION_MAP_MAX) {
    // oldest-first eviction (Map preserves insertion order; re-set on refresh).
    const over = toolSessionMap.size - SESSION_MAP_MAX;
    let i = 0;
    for (const id of toolSessionMap.keys()) {
      if (i++ >= over) break;
      toolSessionMap.delete(id);
    }
  }
}

// Register a resolved mapping and wake any waiting frames for that tool_use_id.
function registerSessionMapping(toolUseId: string, sessionId: string): void {
  toolSessionMap.set(toolUseId, { session_id: sessionId, ts: Date.now() });
  pruneToolSessionMap();
  const waiters = pendingSessionWaiters.get(toolUseId);
  if (waiters) {
    pendingSessionWaiters.delete(toolUseId);
    for (const w of waiters) w(sessionId);
  }
}

// Resolve a tool_use_id to its session id. Returns immediately if already mapped;
// otherwise awaits the `map_session` registration up to SESSION_MAP_WAIT_MS,
// resolving null on timeout (callers decide: identity/DM error, group proceed).
function resolveToolSession(toolUseId: string): Promise<string | null> {
  const e = toolSessionMap.get(toolUseId);
  if (e) return Promise.resolve(e.session_id);
  return new Promise<string | null>((resolve) => {
    let settled = false;
    const settle = (sid: string | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(sid);
    };
    let arr = pendingSessionWaiters.get(toolUseId);
    if (!arr) pendingSessionWaiters.set(toolUseId, (arr = []));
    arr.push(settle);
    const timer = setTimeout(() => {
      const list = pendingSessionWaiters.get(toolUseId);
      if (list) {
        const i = list.indexOf(settle);
        if (i >= 0) list.splice(i, 1);
        if (list.length === 0) pendingSessionWaiters.delete(toolUseId);
      }
      settle(null);
    }, SESSION_MAP_WAIT_MS);
  });
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
// Startup recovery: rebuild groups + members + per-group seq/window from SQLite.

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
      members: new Map(),
      window: recent,
    });
  }
  // reload durable rosters: members return DETACHED (conn=null), delivered reset
  // to head (no-backfill across restart).
  for (const r of stmt.selectMembers.all() as {
    group_name: string;
    handle: string;
    joined_ts: string;
    last_seen_ts: string;
  }[]) {
    const g = groups.get(r.group_name);
    if (!g || !MEMBER_NAME_RE.test(r.handle)) continue;
    g.members.set(r.handle, {
      name: r.handle,
      conn: null,
      joined_ts: r.joined_ts,
      last_seen_ts: r.last_seen_ts,
      delivered: groupHead(r.group_name),
    });
  }
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
    g = { name, members: new Map(), window: [] };
    groups.set(name, g);
    stmt.insertGroup.run(name, nowIso());
  }
  return g;
}

function memberInfo(m: Member): MemberInfo {
  return {
    name: m.name,
    attached: m.conn !== null,
    joined_ts: m.joined_ts,
    last_seen_ts: m.last_seen_ts,
  };
}

// ---------------------------------------------------------------------------
// Group broadcast (online-only push + durable log). `to` restricts the live
// PUSH (not the log) to the named group handles; everyone else still gets the
// message in history.

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
  //    — only to handles named in `to`.
  const filter = to ? new Set(to) : null;
  const recipients: string[] = [];
  for (const m of group.members.values()) {
    if (m.name === from) {
      if (seq > m.delivered) m.delivered = seq;
      continue;
    }
    if (filter && !filter.has(m.name)) continue; // push-filtered out (still logged)
    if (m.conn) {
      m.conn.send({ t: "message", msg });
      recipients.push(m.name);
      if (seq > m.delivered) m.delivered = seq;
    }
  }
  return { msg, recipients };
}

function resendGap(member: Member, group: Group): void {
  for (const msg of group.window) {
    if (msg.seq > member.delivered && member.conn) {
      member.conn.send({ t: "message", msg });
    }
  }
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
// default alias <session-id>@<host>.
function aliasesForSession(sessionId: string, host: string | undefined): string[] {
  const out: string[] = [];
  if (host) out.push(`${sessionId}@${host}`);
  for (const r of stmt.selectAliasesForOwner.all(sessionId) as { name: string; host: string }[]) {
    out.push(`${r.name}@${r.host}`);
  }
  return out;
}

// Resolve an address to a session id. Three forms:
//   <session-id>@<host>          default alias (the session itself)
//   <name>@<host>                registered alias (looked up by owner)
//   <handle>@<group>._group      group-derived (live roster lookup)
// Returns null if it doesn't resolve to a known session.
function resolveAddress(address: string): string | null {
  const at = address.lastIndexOf("@");
  if (at < 0) return null;
  const local = address.slice(0, at);
  const domain = address.slice(at + 1);
  if (!local || !domain) return null;

  // group-derived: <handle>@<group>._group
  if (domain.endsWith(GROUP_SUFFIX)) {
    const groupName = domain.slice(0, -GROUP_SUFFIX.length);
    const g = groups.get(groupName);
    if (!g) return null;
    const m = g.members.get(local);
    if (!m || !m.conn) return null; // must be a CURRENT, attached member to resolve to a session
    return m.conn.sessionId;
  }

  // default alias: local part contains a dash => it's a session id shape. We
  // confirm the session is known (has reported this host), else it's unknown.
  if (local.includes("-")) {
    // it names a session id directly; accept iff we've seen that session.
    if (sessionHost.has(local) || hasAnyTrace(local)) return local;
    return null;
  }

  // registered alias: <name>@<host>
  const row = stmt.selectAlias.get(local, domain) as { owner_session_id: string } | null;
  return row ? row.owner_session_id : null;
}

// Has this session id left any durable trace (owns an alias, or participated in
// a DM)? Lets a default-alias address resolve for a session that's offline but
// known.
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
    conn.send({ t: "welcome", protocol: PROTOCOL_VERSION });
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
      const handles = conn.joinedAs.get(frame.group);
      if (g && handles) {
        for (const as of handles) {
          const m = g.members.get(as);
          if (m && m.conn === conn && frame.seq > m.delivered) m.delivered = frame.seq;
        }
      }
      return;
    }

    case "read": {
      const handles = conn.joinedAs.get(frame.group);
      const col = pendingReads.get(`${frame.group}#${frame.seq}`);
      if (col && handles) {
        for (const as of handles) {
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
        members: g.members.size,
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
      const g = getOrCreateGroup(frame.group);
      const existing = g.members.get(frame.as);
      if (existing && existing.conn !== null && existing.conn !== conn) {
        err(conn, "name_taken", `'${frame.as}' is already attached in '${frame.group}'`, rid);
        return;
      }
      const isReturning = existing !== undefined;
      const member: Member = existing ?? {
        name: frame.as,
        conn,
        joined_ts: nowIso(),
        last_seen_ts: nowIso(),
        delivered: groupHead(frame.group),
      };
      member.conn = conn;
      member.last_seen_ts = nowIso();
      g.members.set(frame.as, member);
      let handles = conn.joinedAs.get(frame.group);
      if (!handles) conn.joinedAs.set(frame.group, (handles = new Set()));
      handles.add(frame.as);
      if (!isReturning) {
        stmt.insertMember.run(frame.group, frame.as, member.joined_ts, member.last_seen_ts);
      } else {
        stmt.touchMember.run(member.last_seen_ts, frame.group, frame.as);
      }
      conn.send({ t: "joined", rid, group: frame.group, as: frame.as });
      if (isReturning) resendGap(member, g);
      return;
    }

    case "leave": {
      const g = groups.get(frame.group);
      const handles = conn.joinedAs.get(frame.group);
      const as =
        frame.as !== undefined
          ? handles?.has(frame.as)
            ? frame.as
            : undefined
          : handles && handles.size === 1
            ? [...handles][0]
            : undefined;
      if (g && as) {
        g.members.delete(as);
        handles!.delete(as);
        if (handles!.size === 0) conn.joinedAs.delete(frame.group);
        stmt.deleteMember.run(frame.group, as);
      }
      conn.send({ t: "left", rid, group: frame.group });
      return;
    }

    case "send": {
      const g = groups.get(frame.group);
      const handles = conn.joinedAs.get(frame.group);
      const as =
        frame.as !== undefined
          ? handles?.has(frame.as)
            ? frame.as
            : undefined
          : handles && handles.size === 1
            ? [...handles][0]
            : undefined;
      if (!g || !as) {
        err(conn, "not_in_group", `join '${frame.group}' as the right handle before sending`, rid);
        return;
      }
      // `to` push-filter: entries must be CURRENT members of this group. If ANY
      // entry is a non-member, the whole send fails (decision O1) — no partial
      // send. The message is otherwise logged for everyone; `to` filters the
      // push only.
      let toFilter: string[] | undefined;
      if (frame.to !== undefined) {
        if (!Array.isArray(frame.to)) {
          err(conn, "to_non_member", "`to` must be an array of group handles", rid);
          return;
        }
        for (const name of frame.to) {
          if (!g.members.has(name)) {
            err(conn, "to_non_member", `'${name}' is not a member of '${frame.group}'`, rid);
            return;
          }
        }
        toFilter = frame.to;
      }
      const m = g.members.get(as);
      if (m) m.last_seen_ts = nowIso();
      const { msg, recipients } = broadcast(g, as, frame.message, toFilter);

      const key = `${g.name}#${msg.seq}`;
      // The set of names a receipt is awaited from: the recipients we pushed to.
      // `sent` reports everyone else the message went to in history terms — when
      // filtered, that's exactly the targeted recipients; unfiltered, the whole
      // group minus sender.
      const others = () => {
        const base = toFilter
          ? toFilter.filter((n) => n !== as)
          : [...g.members.values()].map((x) => x.name).filter((n) => n !== as);
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
        members: [...g.members.values()].map(memberInfo),
      });
      return;
    }

    case "show_member": {
      const g = groups.get(frame.group);
      if (!g) {
        err(conn, "no_such_group", `no group '${frame.group}'`, rid);
        return;
      }
      const m = g.members.get(frame.member);
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
      const existing = stmt.selectAlias.get(frame.name, conn.host) as
        | { owner_session_id: string }
        | null;
      if (existing) {
        if (existing.owner_session_id === sid) {
          // idempotent: re-registering your own alias succeeds.
          conn.send({ t: "aliases", rid, aliases: aliasesForSession(sid, conn.host) });
          return;
        }
        err(conn, "alias_taken", `'${frame.name}@${conn.host}' is owned by another session`, rid);
        return;
      }
      stmt.insertAlias.run(frame.name, conn.host, sid, nowIso());
      conn.send({ t: "aliases", rid, aliases: aliasesForSession(sid, conn.host) });
      return;
    }

    case "release_alias": {
      const sid = requireSession(conn, rid);
      if (!sid) return;
      const existing = stmt.selectAlias.get(frame.name, conn.host) as
        | { owner_session_id: string }
        | null;
      if (!existing) {
        err(conn, "no_such_address", `no alias '${frame.name}@${conn.host}'`, rid);
        return;
      }
      if (existing.owner_session_id !== sid) {
        err(conn, "not_alias_owner", `you do not own '${frame.name}@${conn.host}'`, rid);
        return;
      }
      stmt.deleteAlias.run(frame.name, conn.host, sid);
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
      conn.send({
        t: "whoami",
        rid,
        session_id: sid,
        host: conn.host,
        aliases: aliasesForSession(sid, conn.host),
      });
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

// The alias the sender presents on an outgoing DM: its first registered alias on
// this host if any, else its default alias.
function senderAlias(sessionId: string, host: string): string {
  const regs = stmt.selectAliasesForOwner.all(sessionId) as { name: string; host: string }[];
  const onHost = regs.find((r) => r.host === host);
  if (onHost) return `${onHost.name}@${onHost.host}`;
  return `${sessionId}@${host}`;
}

// Build the directory: every known session (alias owners + DM participants +
// live connections), with its aliases, group memberships, and online flag.
function buildDirectory(): DirectoryEntry[] {
  const sessions = new Map<string, { host: string }>();
  // alias owners
  for (const r of stmt.selectAllAliases.all() as {
    name: string;
    host: string;
    owner_session_id: string;
  }[]) {
    if (!sessions.has(r.owner_session_id)) {
      sessions.set(r.owner_session_id, { host: sessionHost.get(r.owner_session_id) ?? r.host });
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

  // group memberships per session: only ATTACHED handles map to a session id
  // (membership stores handles, not session ids — a session is mapped to a group
  // only while a live conn binds the handle).
  const groupsForSession = new Map<string, Set<string>>();
  for (const g of groups.values()) {
    for (const m of g.members.values()) {
      const sid = m.conn?.sessionId;
      if (!sid) continue;
      let set = groupsForSession.get(sid);
      if (!set) groupsForSession.set(sid, (set = new Set()));
      set.add(g.name);
    }
  }

  const out: DirectoryEntry[] = [];
  for (const [sid, info] of sessions) {
    const aliases = (stmt.selectAliasesForOwner.all(sid) as { name: string; host: string }[]).map(
      (r) => `${r.name}@${r.host}`,
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
  // The session resolved for THIS frame is the account we serve for it.
  conn.sessionId = sid;
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
      if (typeof direct === "string" && direct) {
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
  for (const [group, handles] of conn.joinedAs) {
    const g = groups.get(group);
    for (const as of handles) {
      const m = g?.members.get(as);
      if (m && m.conn === conn) {
        m.conn = null;
        m.last_seen_ts = nowIso();
        if (g) stmt.touchMember.run(m.last_seen_ts, group, as);
      }
    }
  }
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
        sessions: new Set<string>(),
        sessionId: null,
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
