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
// CREATE/ALTER string, or a function for migrations needing imperative backfill) —
// never edit an applied one.
//
// v1 is the UNIFIED schema: ONE `handles` table replaces the old `aliases` AND
// `members` tables. A handle is a name owned by an identity; a group handle is a
// handle whose string ends `@<group>._group`; a registered alias is `<name>@<host>`.
// Group membership is derived (query handles ending in the suffix), not stored
// separately. Clean-slate per design O1: prior aliases/members data is not carried.
//
// A migration is either a SQL string (db.exec) or a function that receives the db
// and does imperative work inside the same per-version transaction. v3 needs the
// function form: it mints one opaque identity per distinct pre-existing session and
// rewrites every ownership column to the identity key (backfill — zero data loss).
type Migration = string | ((db: Database) => void);
const MIGRATIONS: Migration[] = [
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
  // because the lease is on disk. Rows are dropped by an explicit release_session
  // (a /resume's SessionEnd), which also CASCADE-drops the session stem's subagent
  // sibling leases (subagent GC); never deleted on plain disconnect. NOTE: this
  // lease is transport recovery only — /resume IDENTITY adoption keys off the
  // durable `sessions` table (v4 adapter_id column), not this table, precisely
  // because SessionEnd GCs the lease before the resumed session binds.
  `
  CREATE TABLE IF NOT EXISTS adapter_sessions (
    adapter_id TEXT,
    session_id TEXT,
    PRIMARY KEY (adapter_id, session_id)
  );
  `,
  // v3 — DECOUPLE IDENTITY FROM SESSION. The hub mints an opaque `identity_id`
  // (UUID) per identity; a `sessions(session_key -> identity_id)` map says which
  // identity a session credential speaks for (many session keys, e.g. across a
  // /resume or a subagent, can map to one identity over time). Every ownership /
  // addressing column moves off the session key onto the identity key. `messages`
  // gains a durable `from_identity` author anchor and a `reply_to` seq.
  //
  // BACKFILL (zero data loss on a live hub): mint one identity per distinct session
  // value already in the DB across handles.owner_session, dms.*_session and
  // dm_delivery.recipient_session; build the sessions map 1:1; rewrite each column.
  // messages.from_identity is backfilled via from_handle -> handles.owner_session ->
  // sessions.identity_id WHERE the handle still exists (else NULL — an author who
  // already left was never recorded as an identity and can't be invented).
  //
  // Column drops: bun:sqlite (SQLite 3.51) supports ALTER TABLE DROP COLUMN, but
  // not for a PRIMARY-KEY or indexed column. So `handles` drops its owner index,
  // ADDs owner_identity, backfills, DROPs owner_session, re-creates the index on
  // owner_identity; `dms` and `dm_delivery` (whose session columns are in the PK)
  // are REBUILT via the table-rebuild pattern under the new identity keys.
  (db: Database): void => {
    const mint = () => randomUUID();
    const now = nowIso();

    db.exec(`
      CREATE TABLE identities (
        identity_id TEXT PRIMARY KEY,
        host TEXT,
        created_ts TEXT
      );
      CREATE TABLE sessions (
        session_key TEXT PRIMARY KEY,
        identity_id TEXT NOT NULL,
        created_ts TEXT
      );
      CREATE INDEX sessions_by_identity ON sessions (identity_id);
    `);

    // 1) Gather every distinct pre-existing session value across all ownership
    //    columns, and a best-known host per session (from a default-alias handle
    //    `<session>@<host>` it owns, else 'unknown').
    const sessionSet = new Set<string>();
    const addCol = (sql: string, col: string) => {
      for (const r of db.query(sql).all() as Record<string, string | null>[]) {
        const v = r[col];
        if (typeof v === "string" && v) sessionSet.add(v);
      }
    };
    addCol("SELECT DISTINCT owner_session FROM handles", "owner_session");
    addCol("SELECT DISTINCT from_session FROM dms", "from_session");
    addCol("SELECT DISTINCT to_session FROM dms", "to_session");
    addCol("SELECT DISTINCT lo_session FROM dms", "lo_session");
    addCol("SELECT DISTINCT hi_session FROM dms", "hi_session");
    addCol("SELECT DISTINCT recipient_session FROM dm_delivery", "recipient_session");

    // host carried from a handle the session owns shaped like its default alias
    // `<session>@<host>`: the local part equals the session id. ESCAPE the alias's
    // own special chars so a session id with `%`/`_` matches literally.
    const hostOf = (session: string): string => {
      const esc = session.replace(/[\\%_]/g, (c) => `\\${c}`);
      const row = db
        .query(
          "SELECT handle FROM handles WHERE owner_session = ? AND handle LIKE ? ESCAPE '\\' LIMIT 1",
        )
        .get(session, `${esc}@%`) as { handle: string } | null;
      if (!row) return "unknown";
      const at = row.handle.lastIndexOf("@");
      return at >= 0 ? row.handle.slice(at + 1) : "unknown";
    };

    const insIdentity = db.query(
      "INSERT INTO identities (identity_id, host, created_ts) VALUES (?, ?, ?)",
    );
    const insSession = db.query(
      "INSERT INTO sessions (session_key, identity_id, created_ts) VALUES (?, ?, ?)",
    );
    const sessionToIdentity = new Map<string, string>();
    for (const session of sessionSet) {
      const id = mint();
      insIdentity.run(id, hostOf(session), now);
      insSession.run(session, id, now);
      sessionToIdentity.set(session, id);
    }

    // 2) handles: owner_session -> owner_identity. Drop the owner index first (a
    //    DROP COLUMN can't touch an indexed column), rewrite, re-index.
    db.exec("DROP INDEX IF EXISTS handles_by_owner");
    db.exec("ALTER TABLE handles ADD COLUMN owner_identity TEXT");
    db.exec(
      "UPDATE handles SET owner_identity = " +
        "(SELECT identity_id FROM sessions WHERE session_key = handles.owner_session)",
    );
    db.exec("ALTER TABLE handles DROP COLUMN owner_session");
    db.exec("CREATE INDEX handles_by_owner ON handles (owner_identity)");

    // 3) dms: rebuild under identity keys (session columns are in the PK / index,
    //    so an in-place DROP COLUMN is impossible). New canonical pair key is the
    //    ordered identity pair (lo_identity, hi_identity).
    db.exec(`
      CREATE TABLE dms_new (
        lo_identity TEXT, hi_identity TEXT, seq INTEGER,
        from_identity TEXT, from_alias TEXT, to_identity TEXT, to_alias TEXT,
        ts TEXT, msg_id TEXT, text TEXT,
        state TEXT,
        PRIMARY KEY (lo_identity, hi_identity, seq)
      );
    `);
    const id = (s: string | null): string | null =>
      s == null ? null : sessionToIdentity.get(s) ?? null;
    const oldDms = db
      .query(
        "SELECT lo_session, hi_session, seq, from_session, from_alias, to_session, to_alias, ts, msg_id, text, state FROM dms",
      )
      .all() as DmV2Row[];
    const insDmNew = db.query(
      "INSERT INTO dms_new (lo_identity, hi_identity, seq, from_identity, from_alias, to_identity, to_alias, ts, msg_id, text, state) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    );
    for (const r of oldDms) {
      const loI = id(r.lo_session);
      const hiI = id(r.hi_session);
      // re-order the pair by the IDENTITY key so the canonical pair is stable.
      const lo = loI != null && hiI != null ? (loI <= hiI ? loI : hiI) : loI;
      const hi = loI != null && hiI != null ? (loI <= hiI ? hiI : loI) : hiI;
      insDmNew.run(
        lo,
        hi,
        r.seq,
        id(r.from_session),
        r.from_alias,
        id(r.to_session),
        r.to_alias,
        r.ts,
        r.msg_id,
        r.text,
        r.state,
      );
    }
    db.exec("DROP TABLE dms");
    db.exec("ALTER TABLE dms_new RENAME TO dms");
    db.exec("CREATE INDEX dms_by_pair ON dms (lo_identity, hi_identity, seq)");

    // 4) dm_delivery: rebuild under identity keys (recipient_session is in the PK).
    db.exec(`
      CREATE TABLE dm_delivery_new (
        lo_identity TEXT, hi_identity TEXT, recipient_identity TEXT, delivered_seq INTEGER,
        PRIMARY KEY (lo_identity, hi_identity, recipient_identity)
      );
    `);
    const oldDelivery = db
      .query(
        "SELECT lo_session, hi_session, recipient_session, delivered_seq FROM dm_delivery",
      )
      .all() as {
      lo_session: string;
      hi_session: string;
      recipient_session: string;
      delivered_seq: number;
    }[];
    const insDelNew = db.query(
      "INSERT OR IGNORE INTO dm_delivery_new (lo_identity, hi_identity, recipient_identity, delivered_seq) VALUES (?, ?, ?, ?)",
    );
    for (const r of oldDelivery) {
      const loI = id(r.lo_session);
      const hiI = id(r.hi_session);
      const lo = loI != null && hiI != null ? (loI <= hiI ? loI : hiI) : loI;
      const hi = loI != null && hiI != null ? (loI <= hiI ? hiI : loI) : hiI;
      insDelNew.run(lo, hi, id(r.recipient_session), r.delivered_seq);
    }
    db.exec("DROP TABLE dm_delivery");
    db.exec("ALTER TABLE dm_delivery_new RENAME TO dm_delivery");

    // 5) messages: add the durable author identity + reply_to. `from_handle` stores
    //    the member NAME (the handle's local part), so the author's full group
    //    handle is `<from_handle>@<group_name>._group`; backfill from_identity from
    //    THAT handle's current owner_identity. Authors whose group handle no longer
    //    exists (they left) stay NULL — we can't invent an identity never recorded.
    db.exec("ALTER TABLE messages ADD COLUMN from_identity TEXT");
    db.exec("ALTER TABLE messages ADD COLUMN reply_to INTEGER");
    db.exec(
      "UPDATE messages SET from_identity = (SELECT owner_identity FROM handles " +
        "WHERE handles.handle = messages.from_handle || '@' || messages.group_name || '._group')",
    );
  },
  // v4 — record the adapter on each session row so /resume adoption survives the
  // SessionEnd lease GC. The v6 re-attach keyed adoption off `adapter_sessions`, but
  // in the REAL /resume lifecycle the SessionEnd hook fires release_session{oldKey}
  // (which DELETEs the old key's adapter_sessions row) BEFORE the resumed session's
  // first tool call binds — so by adoption time the lease is gone and a fresh
  // identity is wrongly minted. The `sessions(oldKey -> identity)` row, by contrast,
  // SURVIVES release (it's never deleted — the identity is durable). Stamping the
  // adapter that bound each session row lets adoption find the adapter's prior MAIN
  // identity from the durable `sessions` table, independent of the transient lease.
  // Append-only ALTER; existing rows get NULL adapter_id (they predate adoption and
  // are never adopted from — adoption requires a non-empty adapter match).
  "ALTER TABLE sessions ADD COLUMN adapter_id TEXT",
];

// The pre-v3 `dms` row shape, used only by the v3 backfill to read the old table.
interface DmV2Row {
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

function runMigrations(): void {
  const cur =
    (db.query("PRAGMA user_version").get() as { user_version: number } | null)?.user_version ?? 0;
  for (let i = 0; i < MIGRATIONS.length; i++) {
    const version = i + 1;
    if (version <= cur) continue;
    const m = MIGRATIONS[i]!;
    const apply = db.transaction(() => {
      if (typeof m === "string") db.exec(m);
      else m(db);
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

// Prepared statements (reused; bun:sqlite caches the compiled plan). All
// ownership/addressing columns are keyed on the opaque IDENTITY id (v3), not a
// session id; `sessions(session_key -> identity_id)` is the only place a session
// credential is stored.
const stmt = {
  insertGroup: db.query("INSERT OR IGNORE INTO groups (name, created_ts) VALUES (?, ?)"),
  // identities + sessions (v3). The hub mints an identity the first time it sees a
  // new session_key; `lookupSession`/`insertSession` are the resolution seam.
  insertIdentity: db.query(
    "INSERT INTO identities (identity_id, host, created_ts) VALUES (?, ?, ?)",
  ),
  selectIdentity: db.query("SELECT identity_id, host, created_ts FROM identities WHERE identity_id = ?"),
  lookupSession: db.query("SELECT identity_id FROM sessions WHERE session_key = ?"),
  insertSession: db.query(
    "INSERT OR IGNORE INTO sessions (session_key, identity_id, created_ts, adapter_id) VALUES (?, ?, ?, ?)",
  ),
  // /resume adoption (v4): the prior MAIN identities this adapter has bound, from the
  // DURABLE sessions table (survives the SessionEnd lease GC, unlike adapter_sessions).
  // Excludes subagent composite keys (a `:` agent component) so a /resume never adopts
  // a subagent's identity, and the boot-time NULL adapter rows (existing rows predate
  // adoption). DISTINCT + ordered newest-first so the live coexistence case and the
  // conflict check below both see a deterministic set. The caller passes a non-empty
  // adapterId (guarded at the call site), so NULL/empty adapter rows never match.
  adoptableMainIdentities: db.query(
    "SELECT DISTINCT identity_id FROM sessions WHERE adapter_id = ? AND adapter_id <> '' " +
      "AND instr(session_key, ':') = 0 ORDER BY created_ts DESC",
  ),
  // handles — the single registry for "a name owned by an identity". A group
  // handle is `<name>@<group>._group`; a registered alias is `<name>@<host>`.
  insertHandle: db.query(
    "INSERT INTO handles (handle, owner_identity, created_ts) VALUES (?, ?, ?)",
  ),
  deleteHandle: db.query("DELETE FROM handles WHERE handle = ? AND owner_identity = ?"),
  selectHandleOwner: db.query("SELECT owner_identity, created_ts FROM handles WHERE handle = ?"),
  // every handle in a group, ordered by name; membership is DERIVED from this.
  selectHandlesInGroup: db.query(
    "SELECT handle, owner_identity, created_ts FROM handles WHERE handle LIKE ? ESCAPE '\\' ORDER BY handle ASC",
  ),
  // the caller identity's handle in a group (it owns at most one).
  selectMyHandleInGroup: db.query(
    "SELECT handle, owner_identity, created_ts FROM handles WHERE owner_identity = ? AND handle LIKE ? ESCAPE '\\' LIMIT 1",
  ),
  // registered aliases (handles NOT ending in the group suffix) owned by an identity.
  // The `_` in `._group` is a LIKE wildcard, so the suffix is escaped and matched
  // with `ESCAPE '\\'` — otherwise `'%._group'` would mean "ends `.<any-char>group`"
  // and could mis-classify a host whose name happens to end that way.
  selectAliasesForOwner: db.query(
    "SELECT handle FROM handles WHERE owner_identity = ? AND handle NOT LIKE '%.\\_group' ESCAPE '\\'",
  ),
  // whoami shows the owner ALL their handles — including group handles
  // (`<name>@<group>._group`), which are identities/addresses too. (The
  // `aliasesForIdentity` path above stays `@host`-only for the directory/register
  // replies.)
  selectAllHandlesForOwner: db.query("SELECT handle FROM handles WHERE owner_identity = ?"),
  selectAllAliases: db.query(
    "SELECT handle, owner_identity FROM handles WHERE handle NOT LIKE '%.\\_group' ESCAPE '\\'",
  ),
  insertMessage: db.query(
    "INSERT INTO messages (group_name, seq, from_handle, ts, msg_id, text, from_identity, reply_to) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  ),
  selectGroups: db.query("SELECT name FROM groups"),
  selectMaxSeq: db.query("SELECT MAX(seq) AS m FROM messages WHERE group_name = ?"),
  selectWindow: db.query(
    "SELECT group_name, seq, from_handle, ts, msg_id, text, from_identity, reply_to FROM messages WHERE group_name = ? ORDER BY seq DESC LIMIT ?",
  ),
  selectHistory: db.query(
    "SELECT group_name, seq, from_handle, ts, msg_id, text, from_identity, reply_to FROM messages WHERE group_name = ? ORDER BY seq ASC",
  ),
  // a single message by (group, seq) — for the reply-to author lookup.
  selectMessageAt: db.query(
    "SELECT group_name, seq, from_handle, ts, msg_id, text, from_identity, reply_to FROM messages WHERE group_name = ? AND seq = ?",
  ),
  insertDm: db.query(
    "INSERT INTO dms (lo_identity, hi_identity, seq, from_identity, from_alias, to_identity, to_alias, ts, msg_id, text, state) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ),
  maxDmSeq: db.query("SELECT MAX(seq) AS m FROM dms WHERE lo_identity = ? AND hi_identity = ?"),
  updateDmState: db.query(
    "UPDATE dms SET state = ? WHERE lo_identity = ? AND hi_identity = ? AND seq = ? AND to_identity = ?",
  ),
  selectDmState: db.query(
    "SELECT state FROM dms WHERE lo_identity = ? AND hi_identity = ? AND seq = ?",
  ),
  selectUndeliveredDms: db.query(
    "SELECT lo_identity, hi_identity, seq, from_identity, from_alias, to_identity, to_alias, ts, msg_id, text, state " +
      "FROM dms d WHERE d.to_identity = ? AND d.seq > COALESCE(" +
      "(SELECT delivered_seq FROM dm_delivery dd WHERE dd.lo_identity = d.lo_identity AND dd.hi_identity = d.hi_identity AND dd.recipient_identity = ?), 0) " +
      "ORDER BY d.lo_identity, d.hi_identity, d.seq ASC",
  ),
  selectDmThread: db.query(
    "SELECT lo_identity, hi_identity, seq, from_identity, from_alias, to_identity, to_alias, ts, msg_id, text, state " +
      "FROM dms WHERE lo_identity = ? AND hi_identity = ? ORDER BY seq ASC",
  ),
  upsertDelivery: db.query(
    "INSERT INTO dm_delivery (lo_identity, hi_identity, recipient_identity, delivered_seq) VALUES (?, ?, ?, ?) " +
      "ON CONFLICT(lo_identity, hi_identity, recipient_identity) DO UPDATE SET delivered_seq = excluded.delivered_seq " +
      "WHERE excluded.delivered_seq > dm_delivery.delivered_seq",
  ),
  // every IDENTITY we have ever observed as a dm participant — part of the
  // directory's identity universe (alias owners + dm participants + live conns).
  selectDmIdentities: db.query(
    "SELECT from_identity AS s FROM dms UNION SELECT to_identity AS s FROM dms",
  ),
  // targeted existence check: is this identity a participant in ANY dm? Used by
  // hasAnyTrace so a default-alias resolution doesn't scan the whole dms table.
  dmTraceForIdentity: db.query(
    "SELECT 1 FROM dms WHERE from_identity = ? OR to_identity = ? LIMIT 1",
  ),
  // adapter→session lease (migration v2 / protocol v5 reconnect). STAYS
  // session-keyed: an adapter serves SESSION keys (the v3 decouple does not change
  // this — the lease's job is transport recovery, leasing the session credential).
  // UPSERT on bind, SELECT on hello to re-bind a reconnecting adapter's sessions,
  // DELETE on an explicit release_session (a /resume's SessionEnd).
  upsertAdapterSession: db.query(
    "INSERT OR IGNORE INTO adapter_sessions (adapter_id, session_id) VALUES (?, ?)",
  ),
  selectAdapterSessions: db.query(
    // ORDER BY for a deterministic re-bind order. An adapter MAY lease several
    // session keys concurrently (the parent plus live subagents, or a coexisting
    // /resume before its SessionEnd release), so this is no longer a singleton; the
    // hello handler re-binds each leased session key, all coexisting.
    "SELECT session_id FROM adapter_sessions WHERE adapter_id = ? ORDER BY session_id ASC",
  ),
  // Release a session key's durable lease across ALL adapters that lease it. A
  // session key (`<session_id>[:<agent_id>]`) is globally unique to one Claude
  // session, so in practice one adapter leases it; deleting by key (not by
  // adapter_id+key) is authoritative even when the releasing socket — a transient
  // SessionEnd-hook connection — never bound the key itself.
  deleteAdapterSessionByKey: db.query(
    "DELETE FROM adapter_sessions WHERE session_id = ?",
  ),
  // The adapter ids that currently lease a given session key (read BEFORE the delete
  // above), used to scope the subagent-lease cascade to the releasing adapter only.
  selectAdaptersForSession: db.query(
    "SELECT adapter_id FROM adapter_sessions WHERE session_id = ?",
  ),
  // Subagent-lease GC (cascade on main-key release): the subagent sibling leases of
  // a released MAIN key — same adapter_id, session_id shaped `<mainKey>:<agent_id>`.
  // A subagent cannot outlive its parent session, so releasing the parent's main key
  // (its SessionEnd) cascade-releases the session_id stem's `:`-suffixed subagent
  // keys for THE SAME adapter. The LIKE pattern escapes the main key's own LIKE
  // wildcards so the `:` boundary is the only structural match (paired with ESCAPE).
  selectSubagentLeases: db.query(
    "SELECT session_id FROM adapter_sessions WHERE adapter_id = ? AND session_id LIKE ? ESCAPE '\\'",
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
  (
    group_name: string,
    from: string,
    ts: string,
    msg_id: string,
    text: string,
    fromIdentity: string | null,
    replyTo: number | null,
  ): number => {
    const max = (stmt.selectMaxSeq.get(group_name) as { m: number | null })?.m ?? 0;
    const seq = max + 1;
    stmt.insertMessage.run(group_name, seq, from, ts, msg_id, text, fromIdentity, replyTo);
    return seq;
  },
);

const assignAndInsertDm = db.transaction(
  (p: {
    lo: string;
    hi: string;
    fromIdentity: string;
    fromAlias: string;
    toIdentity: string;
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
      p.fromIdentity,
      p.fromAlias,
      p.toIdentity,
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
  // One adapter socket can serve several Claude SESSION KEYS (a /resume into a
  // different session, or live subagents whose key is `<session_id>:<agent_id>`,
  // all over the same socket). `sessions` is every session KEY this socket has
  // asserted and is routing for; `sessionId` is the key asserted on the current
  // frame (the credential whose identity/DM op we're serving right now). A session
  // key is opaque — the hub never parses it.
  sessions: Set<string>;
  sessionId: string | null;
  // The ACTIVE session key last established by `bindSession` (the credential the
  // current frame asserted). Distinct from `sessionId` only in that attribution-
  // only frames (dm_ack/dm_read) set `sessionId` WITHOUT calling bindSession, so
  // they never touch `boundSession`. Null until the first bind. The decouple
  // removed the bind-time supersede: a new key binding over the same socket no
  // longer evicts the prior (subagents + a /resume's two sessions coexist); only an
  // explicit release_session (SessionEnd) detaches a session key.
  boundSession: string | null;
  // The IDENTITY id resolved for the current frame's session key (mint-on-first-
  // sight). Stamped immediately before handleFrame reads it, like `sessionId`.
  identityId: string | null;
  // Every identity id this socket currently routes for, keyed by the session KEY
  // that resolved to it. Used by onDisconnect/release to know which identityConns
  // entries to drop when a session key (or the whole socket) goes away. Multiple
  // session keys can map to the same identity (its value repeats); routing fans to
  // all live conns of an identity, so we only drop an identityConns membership when
  // THIS conn no longer serves ANY key mapping to that identity.
  sessionIdentity: Map<string, string>;
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

// IDENTITY id -> the set of live connections currently speaking for it. An
// identity MAY have several concurrent live sessions (a /resume's two sessions, or
// several adapters), so this is a Set and a push fans out to ALL of them. Used to
// route DMs / group pushes to an online recipient and to compute online state.
const identityConns = new Map<string, Set<Connection>>();
// identity id -> the host last reported for it (its default-alias host).
const identityHost = new Map<string, string>();
// Every live connection. A release_session must find the session key across ALL
// connections (the releasing SessionEnd hook opens its OWN transient socket, not
// the adapter's), so it iterates this set rather than a per-socket lookup.
const allConnections = new Set<Connection>();

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
// The resolution seam: session KEY -> IDENTITY id, minting on first sight. This is
// the ONE place a session credential becomes an identity. The session key is opaque
// (`<session_id>` or the composite `<session_id>:<agent_id>` for a subagent) — the
// hub never parses it EXCEPT for the single structural peek below: detecting the
// presence of a `:` agent component to tell a main-agent key from a subagent one.
// That one boundary check is the ONLY place the hub looks inside the key, and it is
// required by the re-attach predicate (a main-agent /resume adopts the prior main
// identity; a subagent must always get its own).
//
// A brand-new key mints a fresh identity + a `sessions` row; thereafter the same
// key always resolves to that identity. `host` is recorded on the identity at mint
// time for its default alias, and refreshed by bindSession.

// The ONE allowed structural peek into the opaque session key: does it carry a
// `:`-suffixed agent component (i.e. is it a subagent key `<session_id>:<agent_id>`)?
function isSubagentKey(sessionKey: string): boolean {
  return sessionKey.includes(":");
}

// Resolve (mint-on-first-sight, with adapterId-scoped RE-ATTACH adoption). When a
// NEW, unseen key is resolved during a bind on adapter `adapterId`:
//   1. If the key already maps in `sessions` -> return that identity (unchanged).
//   2. Else, if it is a MAIN-agent key (no `:` agent component), look at the prior
//      MAIN session rows this SAME adapterId has bound (the DURABLE `sessions` table,
//      v4 adapter_id column — NOT the transient adapter_sessions lease, which the
//      SessionEnd hook has already GC'd by this point in the real /resume order): if
//      they share exactly one identity, ADOPT it — insert sessions(newKey -> that
//      identity) instead of minting. This is the /resume continuity: the new session
//      id over the same surviving adapter process inherits the prior identity
//      (handles/aliases/DMs/membership carry over), with no impersonation question
//      (same adapter = the v5 lease's trust).
//   3. Else (subagent key, or no adoptable prior main identity, or a degraded
//      multi-identity adapter) -> mint fresh.
// A SUBAGENT key NEVER adopts: it always gets its own distinct identity (the
// composite key path), never collapsing into the parent — even though it shares the
// parent's adapterId.
function resolveIdentity(sessionKey: string, host: string, adapterId: string): string {
  const existing = stmt.lookupSession.get(sessionKey) as { identity_id: string } | null;
  if (existing) return existing.identity_id;

  // RE-ATTACH adoption: only for a NEW main-agent key on an adapter that has already
  // bound a prior main key (a /resume). The adopted identity is that prior MAIN key's
  // identity, read from the DURABLE sessions table — so adoption survives the
  // SessionEnd lease GC that has, by this point in the real /resume lifecycle, already
  // dropped the old key's adapter_sessions row.
  if (adapterId && !isSubagentKey(sessionKey)) {
    const adopted = adoptableIdentityFor(adapterId);
    if (adopted) {
      stmt.insertSession.run(sessionKey, adopted, nowIso(), adapterId);
      return adopted;
    }
  }

  const id = randomUUID();
  const ts = nowIso();
  stmt.insertIdentity.run(id, host || "unknown", ts);
  stmt.insertSession.run(sessionKey, id, ts, adapterId || null);
  return id;
}

// The prior MAIN identity this adapter can have a /resume adopt: read from the
// DURABLE `sessions` table (NOT the transient adapter_sessions lease, which the
// SessionEnd hook has already GC'd by adoption time in the real /resume order). The
// adapter's bound MAIN (non-composite) session rows are collapsed to their DISTINCT
// identities:
//   - exactly one distinct identity  -> ADOPT it (the /resume continuity case; also
//     covers a second /resume, where the prior resumed key already shares the one
//     identity, so DISTINCT still yields one).
//   - none -> null (a genuinely first-seen adapter) -> resolveIdentity mints fresh.
//   - MORE THAN ONE distinct identity -> null (force a fresh mint). This only arises
//     in a DEGRADED state where SessionEnd failed to release a prior main key, leaving
//     two unrelated identities bound to one adapter; silently adopting an arbitrary one
//     would mis-attribute, so we decline rather than guess. (Normal operation can't
//     reach this: each /resume's SessionEnd releases the prior key, and adoption makes
//     the resumed key share the SAME identity, so DISTINCT stays at one.)
// Subagent rows are excluded by the query (so a /resume never adopts a subagent).
function adoptableIdentityFor(adapterId: string): string | null {
  const rows = stmt.adoptableMainIdentities.all(adapterId) as { identity_id: string }[];
  if (rows.length !== 1) return null;
  return rows[0]!.identity_id;
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
  from_identity: string | null;
  reply_to: number | null;
}
function rowToMsg(r: MsgRow): ChatMessage {
  return {
    group: r.group_name,
    seq: r.seq,
    from: r.from_handle,
    ts: r.ts,
    msg_id: r.msg_id,
    text: r.text,
    ...(r.reply_to != null ? { reply_to: r.reply_to } : {}),
  };
}

interface DmRow {
  lo_identity: string;
  hi_identity: string;
  seq: number;
  from_identity: string;
  from_alias: string;
  to_identity: string;
  to_alias: string;
  ts: string;
  msg_id: string;
  text: string;
  state: string;
}
function rowToDm(r: DmRow): DirectMessage {
  return {
    seq: r.seq,
    from_identity: r.from_identity,
    from_alias: r.from_alias,
    to_identity: r.to_identity,
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
  owner_identity: string;
  created_ts: string;
}

// Membership derived from the handle table: every `<name>@<group>._group` handle.
function membersOf(group: string): GroupMember[] {
  const rows = stmt.selectHandlesInGroup.all(groupHandlePattern(group)) as HandleRow[];
  return rows.map((r) => ({
    name: handleToMemberName(r.handle, group),
    handle: r.handle,
    owner: r.owner_identity,
    created_ts: r.created_ts,
  }));
}

// The caller identity's handle in a group (at most one — one identity per group).
// Returns the member-name part, or null if the identity is not a member.
function myMemberName(identityId: string, group: string): string | null {
  const row = stmt.selectMyHandleInGroup.get(identityId, groupHandlePattern(group)) as
    | HandleRow
    | null;
  return row ? handleToMemberName(row.handle, group) : null;
}

// The member names this connection currently participates as in a group — used to
// attribute spontaneous `ack`/`read` frames (which carry no identity) back to the
// right member. Populated by `join` on this conn; falls back to deriving from the
// conn's bound session keys' identities if the live record is empty (e.g. after a
// reconnect that re-bound the session before an explicit re-join).
function connMemberNames(conn: Connection, group: string): Set<string> {
  const live = conn.joinedAs.get(group);
  if (live && live.size > 0) return live;
  const out = new Set<string>();
  for (const identity of conn.sessionIdentity.values()) {
    const name = myMemberName(identity, group);
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
  fromIdentity?: string | null,
  replyTo?: number,
): { msg: ChatMessage; recipients: string[] } {
  // seq is DB-owned: assigned as MAX(seq)+1 and inserted in one transaction (no
  // mirrored in-memory counter). 1) durable append first, getting the seq back.
  // The durable row stores the author's identity (the reply-to anchor) + reply_to.
  const ts = nowIso();
  const msg_id = randomUUID();
  const seq = assignAndInsertMessage(
    group.name,
    from,
    ts,
    msg_id,
    text,
    fromIdentity ?? null,
    replyTo ?? null,
  );
  const msg: ChatMessage = {
    group: group.name,
    seq,
    from,
    ts,
    msg_id,
    text,
    ...(replyTo != null ? { reply_to: replyTo } : {}),
  };
  // 2) keep it in the in-memory window for gap re-send
  group.window.push(msg);
  if (group.window.length > WINDOW) group.window.shift();
  // 3) fan out to every online member EXCEPT the sender, and — when `to` is set
  //    — only to member names listed in `to`. "Online" = the member's OWNING
  //    identity has a live connection (identityConns); we push to each such conn,
  //    STAMPING the recipient identity so the adapter can gate the push to the
  //    session it is destined for (delivery gate).
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
    for (const c of conns) c.send({ t: "message", msg, to_identity: m.owner });
    recipients.push(m.name);
    if (seq > (group.delivered.get(m.name) ?? 0)) group.delivered.set(m.name, seq);
  }
  return { msg, recipients };
}

// Re-send the brief-reconnect gap to a returning member: every windowed message
// past the member's in-memory delivered cursor, to that identity's live conns.
// Each send is stamped with the recipient identity for the adapter's delivery gate.
function resendGap(memberName: string, owner: string, group: Group): void {
  const delivered = group.delivered.get(memberName) ?? 0;
  const conns = liveConnsFor(owner);
  if (conns.length === 0) return;
  let last = delivered;
  for (const msg of group.window) {
    if (msg.seq > delivered) {
      for (const c of conns) c.send({ t: "message", msg, to_identity: owner });
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

// Order an identity pair (lo, hi) so a thread has one canonical key regardless of
// direction.
function pairOf(a: string, b: string): { lo: string; hi: string } {
  return a <= b ? { lo: a, hi: b } : { lo: b, hi: a };
}

function isOnline(identityId: string): boolean {
  const set = identityConns.get(identityId);
  return !!set && set.size > 0;
}

function liveConnsFor(identityId: string): Connection[] {
  const set = identityConns.get(identityId);
  return set ? [...set] : [];
}

// The host recorded for an identity (its default-alias host): the live one last
// reported, else the durable one minted onto the identity row, else 'unknown'.
function hostForIdentity(identityId: string): string {
  const live = identityHost.get(identityId);
  if (live) return live;
  const row = stmt.selectIdentity.get(identityId) as { host: string } | null;
  return row?.host || "unknown";
}

// Every alias (host-qualified form) owned by an identity, including its implicit
// default alias <identity-id>@<host>. Registered aliases are handles NOT ending in
// the group suffix (the @host ones); they are already full strings.
function aliasesForIdentity(identityId: string, host: string | undefined): string[] {
  const out: string[] = [];
  if (host) out.push(`${identityId}@${host}`);
  for (const r of stmt.selectAliasesForOwner.all(identityId) as { handle: string }[]) {
    out.push(r.handle);
  }
  return out;
}

// The reply-to author-left warning: the author's identity is no longer a member of
// the group, so the reply was logged but not pushed. Tell the replier where they
// can reach the author — registered aliases + the canonical default address — and
// whether they're online. Honest when there is nothing to offer.
function describeReachability(authorIdentity: string, repliedSeq: number, group: string): string {
  const host = hostForIdentity(authorIdentity);
  const addrs: string[] = [];
  for (const r of stmt.selectAliasesForOwner.all(authorIdentity) as { handle: string }[]) {
    addrs.push(r.handle);
  }
  // the canonical default address always exists for a known identity.
  addrs.push(`${authorIdentity}@${host}`);
  const online = isOnline(authorIdentity);
  return (
    `the author of seq ${repliedSeq} has left '${group}', so the reply was logged ` +
    `but not pushed to them. They are ${online ? "online" : "offline"}; you can reach them ` +
    `by DM at: ${addrs.join(", ")}.`
  );
}

// Resolve an address to an IDENTITY id. Three forms, all now a single handle table:
//   <identity-id>@<host>         default alias (the identity itself, implicit)
//   <name>@<host>                registered alias (handle row)
//   <handle>@<group>._group      group handle (handle row) — DURABLE, independent
//                                of connection/attachment.
// Returns null if it doesn't resolve to a known identity.
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
    return row ? row.owner_identity : null;
  }

  // default alias: local part contains a dash => it's an identity-id shape (UUIDs
  // are dash-ful, dash-free names are reserved for registered aliases). Accept iff
  // we have minted that identity (it exists in the identities table) or it has a
  // durable trace.
  if (local.includes("-")) {
    if (identityExists(local) || hasAnyTrace(local)) return local;
    return null;
  }

  // registered alias: <name>@<host> — the same handle table.
  const row = stmt.selectHandleOwner.get(address) as HandleRow | null;
  return row ? row.owner_identity : null;
}

// Does this identity id exist in the identities table?
function identityExists(identityId: string): boolean {
  return !!(stmt.selectIdentity.get(identityId) as
    | { identity_id: string; host: string; created_ts: string }
    | null);
}

// Has this identity left any durable trace (owns an alias, or participated in a
// DM)? Lets a default-alias address resolve for an identity that's offline but
// known. NOTE: a group handle is deliberately NOT a trace here — a group member is
// addressed via its durable `<name>@<group>._group` handle (resolved directly in
// resolveAddress), not via its identity default alias, so an identity whose only
// durable artifact is a group handle need not be reachable by default alias.
function hasAnyTrace(identityId: string): boolean {
  const a = stmt.selectAliasesForOwner.all(identityId) as unknown[];
  if (a.length > 0) return true;
  return !!stmt.dmTraceForIdentity.get(identityId, identityId);
}

// ---------------------------------------------------------------------------
// Direct messages.

// Persist + route a DM. Returns the stored DirectMessage and whether it was
// pushed live (recipient online).
function storeDm(
  fromIdentity: string,
  fromAlias: string,
  toIdentity: string,
  toAlias: string,
  text: string,
): { dm: DirectMessage; pushed: boolean } {
  const { lo, hi } = pairOf(fromIdentity, toIdentity);
  const ts = nowIso();
  const msg_id = randomUUID();
  // Assign the per-pair seq and insert atomically: reading MAX(seq) and inserting
  // must be one transaction so two concurrent DMs to the same pair can't read the
  // same max and collide on seq. (Harmless under today's single-threaded Bun, but
  // the foundation is meant to scale — keep the invariant in the DB, not the runtime.)
  const seq = assignAndInsertDm({
    lo,
    hi,
    fromIdentity,
    fromAlias,
    toIdentity,
    toAlias,
    ts,
    msg_id,
    text,
  });
  const dm: DirectMessage = {
    seq,
    from_identity: fromIdentity,
    from_alias: fromAlias,
    to_identity: toIdentity,
    to_alias: toAlias,
    ts,
    msg_id,
    text,
    state: "sent",
  };
  // Try a live push if the recipient is online. If pushed, advance the
  // recipient's durable delivery cursor so it isn't re-flushed on reconnect. The
  // dm_message already names its target (to_identity) so the adapter gates it.
  let pushed = false;
  for (const c of liveConnsFor(toIdentity)) {
    c.send({ t: "dm_message", msg: dm });
    pushed = true;
  }
  if (pushed) {
    stmt.upsertDelivery.run(lo, hi, toIdentity, seq);
  }
  return { dm, pushed };
}

// Flush a reconnecting session's undelivered DM queue: every DM addressed to its
// IDENTITY past its per-pair delivery cursor, one dm_message each, advancing the
// cursor.
function flushDmQueue(conn: Connection): void {
  const identity = conn.identityId;
  if (!identity) return;
  const rows = stmt.selectUndeliveredDms.all(identity, identity) as DmRow[];
  for (const r of rows) {
    conn.send({ t: "dm_message", msg: rowToDm(r) });
    stmt.upsertDelivery.run(r.lo_identity, r.hi_identity, identity, r.seq);
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
    // Re-bind every session KEY this adapter was serving (the durable lease). This
    // is what restores `identityConns` after a reconnect or hub restart with NO
    // tool call: each bindSession resolves the key to its identity, re-registers the
    // live route, and flushes that identity's queued DMs. A first-connect adapter
    // has no lease rows, so this is a no-op. An adapter MAY lease several session
    // keys (subagents, or a /resume's two sessions before SessionEnd releases the
    // old one) — they all re-bind and coexist; the bind no longer supersedes.
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
      // The PreToolUse hook authoritatively reports a call's real session key (the
      // composite "<session_id>[:<agent_id>]" — opaque to the hub). Record it and
      // wake any adapter frame already awaiting this tool_use_id. Fire-and-forget:
      // the hook closes right after; no reply is sent.
      if (
        typeof frame.tool_use_id === "string" && frame.tool_use_id &&
        typeof frame.session_id === "string" && frame.session_id
      ) {
        registerSessionMapping(frame.tool_use_id, frame.session_id);
      }
      return;
    }

    case "release_session": {
      // A genuine /resume (or /clear) ended a session: its SessionEnd hook sends
      // this so the OLD session key stops receiving pushes. Drop the key's route
      // across ALL connections that serve it (the lease + identityConns), idempotent
      // — releasing an already-gone key is a no-op. The identity itself survives;
      // only this session credential detaches. Fire-and-forget; no reply.
      if (typeof frame.session_key === "string" && frame.session_key) {
        releaseSessionKey(frame.session_key);
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
      const identity = requireIdentity(conn, rid);
      if (!identity) return;
      const g = getOrCreateGroup(frame.group);
      const handle = `${frame.as}${groupHandleSuffix(frame.group)}`;
      const existing = stmt.selectHandleOwner.get(handle) as HandleRow | null;
      if (existing && existing.owner_identity !== identity) {
        // A DIFFERENT identity holds this handle — genuine collision.
        err(conn, "handle_taken", `'${frame.as}' is already taken in '${frame.group}'`, rid);
        return;
      }
      const isReturning = existing !== null; // same owner re-registering -> idempotent
      if (!isReturning) {
        stmt.insertHandle.run(handle, identity, nowIso());
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
        resendGap(frame.as, identity, g);
      }
      return;
    }

    case "leave": {
      // Drop the caller identity's handle in the group (at most one — unambiguous,
      // no `as` needed). Requires a resolved identity.
      const identity = requireIdentity(conn, rid);
      if (!identity) return;
      const g = groups.get(frame.group);
      const name = myMemberName(identity, frame.group);
      if (name !== null) {
        stmt.deleteHandle.run(`${name}${groupHandleSuffix(frame.group)}`, identity);
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
      const identity = requireIdentity(conn, rid);
      if (!identity) return;
      const g = groups.get(frame.group);
      const as = g ? myMemberName(identity, frame.group) : null;
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

      // REPLY-TO: when set, the reply is pushed ONLY to the original author (still
      // logged for the whole group). Look up the replied-to row; derive the author's
      // current group handle from its durable identity. If the author is still a
      // member, push to them (the `to` filter); if they LEFT, log-only + a warning
      // in the result naming their reachable addresses.
      let replyWarning: string | undefined;
      if (frame.reply_to !== undefined && frame.reply_to !== null) {
        const target = stmt.selectMessageAt.get(g.name, frame.reply_to) as MsgRow | null;
        if (!target) {
          err(
            conn,
            "no_such_message",
            `no message seq ${frame.reply_to} in '${frame.group}'`,
            rid,
          );
          return;
        }
        const authorIdentity = target.from_identity;
        if (!authorIdentity) {
          // pre-migration author: identity was never recorded. Reply still logs; the
          // warning notes we can't name the author.
          replyWarning =
            `the original author of seq ${frame.reply_to} has no recorded identity ` +
            `(pre-migration message), so it was logged but could not be pushed to anyone.`;
          toFilter = []; // log-only: push to nobody
        } else {
          const authorName = myMemberName(authorIdentity, g.name);
          if (authorIdentity === identity) {
            // replying to your OWN message: there is no one else to push the reply
            // to (the sender is never pushed their own message). Log-only + say so,
            // rather than reporting an empty send as if it silently went nowhere.
            toFilter = [];
            replyWarning =
              `you replied to your own message (seq ${frame.reply_to}); it was logged ` +
              `to the group's history but a reply pushes only to its author, and you ` +
              `are not pushed your own message.`;
          } else if (authorName !== null) {
            // author still in the group: push only to them (overrides any `to`).
            toFilter = [authorName];
          } else {
            // author LEFT: log-only, and report where they can be reached.
            toFilter = [];
            replyWarning = describeReachability(authorIdentity, frame.reply_to, g.name);
          }
        }
      }

      const { msg, recipients } = broadcast(
        g,
        as,
        frame.message,
        toFilter,
        identity,
        frame.reply_to ?? undefined,
      );

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
        conn.send({
          t: "sent",
          rid,
          group: g.name,
          seq: msg.seq,
          read: [],
          sent: others(),
          ...(replyWarning ? { warning: replyWarning } : {}),
        });
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
        conn.send({
          t: "sent",
          rid,
          group: g.name,
          seq: msg.seq,
          read,
          sent,
          ...(replyWarning ? { warning: replyWarning } : {}),
        });
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
      const identity = requireIdentity(conn, rid);
      if (!identity) return;
      if (!ALIAS_NAME_RE.test(frame.name)) {
        err(conn, "bad_alias_name", "alias must match [A-Za-z0-9_]{1,64} (no dashes)", rid);
        return;
      }
      // An alias is a handle `<name>@<host>`. First-holder-wins on the handle table.
      const aliasHandle = `${frame.name}@${conn.host}`;
      const existing = stmt.selectHandleOwner.get(aliasHandle) as HandleRow | null;
      if (existing) {
        if (existing.owner_identity === identity) {
          // idempotent: re-registering your own alias succeeds.
          conn.send({ t: "aliases", rid, aliases: aliasesForIdentity(identity, conn.host) });
          return;
        }
        err(conn, "alias_taken", `'${aliasHandle}' is owned by another identity`, rid);
        return;
      }
      stmt.insertHandle.run(aliasHandle, identity, nowIso());
      conn.send({ t: "aliases", rid, aliases: aliasesForIdentity(identity, conn.host) });
      return;
    }

    case "release_alias": {
      const identity = requireIdentity(conn, rid);
      if (!identity) return;
      const aliasHandle = `${frame.name}@${conn.host}`;
      const existing = stmt.selectHandleOwner.get(aliasHandle) as HandleRow | null;
      if (!existing) {
        err(conn, "no_such_address", `no alias '${aliasHandle}'`, rid);
        return;
      }
      if (existing.owner_identity !== identity) {
        err(conn, "not_alias_owner", `you do not own '${aliasHandle}'`, rid);
        return;
      }
      stmt.deleteHandle.run(aliasHandle, identity);
      conn.send({ t: "aliases", rid, aliases: aliasesForIdentity(identity, conn.host) });
      return;
    }

    case "list_aliases": {
      const identity = requireIdentity(conn, rid);
      if (!identity) return;
      conn.send({ t: "aliases", rid, aliases: aliasesForIdentity(identity, conn.host) });
      return;
    }

    case "whoami": {
      const identity = requireIdentity(conn, rid);
      if (!identity) return;
      // ALL of this identity's addresses, merged: the implicit default alias plus
      // every owned handle — registered `<name>@<host>` AND group
      // `<name>@<group>._group` (group handles are addresses too).
      const aliases: string[] = [];
      if (conn.host) aliases.push(`${identity}@${conn.host}`);
      for (const r of stmt.selectAllHandlesForOwner.all(identity) as { handle: string }[]) {
        aliases.push(r.handle);
      }
      conn.send({ t: "whoami", rid, identity_id: identity, host: conn.host, aliases });
      return;
    }

    case "resolve_alias": {
      const identity = resolveAddress(frame.address);
      conn.send({
        t: "resolved",
        rid,
        address: frame.address,
        identity_id: identity,
        online: identity ? isOnline(identity) : false,
      });
      return;
    }

    case "list_directory": {
      conn.send({ t: "directory", rid, entries: buildDirectory() });
      return;
    }

    // ---- direct messages (v3) ----

    case "dm": {
      const identity = requireIdentity(conn, rid);
      if (!identity) return;
      const toIdentity = resolveAddress(frame.to);
      if (!toIdentity) {
        err(conn, "no_such_address", `cannot resolve '${frame.to}'`, rid);
        return;
      }
      // The sender's own alias for this DM: the most specific identity it has on
      // this host — its first registered alias, else its default alias.
      const fromAlias = senderAlias(identity, conn.host);
      const { dm, pushed } = storeDm(identity, fromAlias, toIdentity, frame.to, frame.message);

      // If pushed to an online recipient, await a read within the window so the
      // reply can report `read`; else reply `sent` immediately (queued).
      if (!pushed) {
        conn.send({ t: "dm_sent", rid, seq: dm.seq, state: "sent" });
        return;
      }
      const { lo, hi } = pairOf(identity, toIdentity);
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
      // downgrade a read). Attribution-only: `conn.identityId` was stamped from the
      // asserted recipient identity (NOT bound — never supersedes), `from_identity`
      // names the sender. We thread the (sender, recipient) identity pair.
      const me = conn.identityId;
      if (!me) return;
      const { lo, hi } = pairOf(me, frame.from_identity);
      const cur = stmt.selectDmState.get(lo, hi, frame.seq) as { state: string } | null;
      if (cur && cur.state === "sent") {
        stmt.updateDmState.run("received", lo, hi, frame.seq, me);
      }
      return;
    }

    case "dm_read": {
      // recipient's display hook surfaced the DM: advance to read and resolve any
      // pending sender wait. Attribution-only (see dm_ack).
      const me = conn.identityId;
      if (!me) return;
      const { lo, hi } = pairOf(me, frame.from_identity);
      stmt.updateDmState.run("read", lo, hi, frame.seq, me);
      const col = pendingDmReads.get(`${lo}|${hi}#${frame.seq}`);
      if (col) {
        col.read = true;
        col.done();
      }
      return;
    }

    case "dm_history": {
      const identity = requireIdentity(conn, rid);
      if (!identity) return;
      const peerIdentity = resolveAddress(frame.peer) ?? frame.peer; // accept a raw identity id too
      const { lo, hi } = pairOf(identity, peerIdentity);
      const all = (stmt.selectDmThread.all(lo, hi) as DmRow[]).map(rowToDm);
      const fromEnd = Math.max(0, frame.index_from_end | 0);
      const n = Math.max(0, frame.last_n | 0);
      const end = all.length - fromEnd;
      const start = Math.max(0, end - n);
      conn.send({
        t: "dm_history",
        rid,
        peer_identity: peerIdentity,
        messages: all.slice(start, end),
      });
      return;
    }
  }
}

// Identity-scoped frames (group / alias / DM ops) require a resolved identity. The
// identity is resolved in dispatchFrame from the session key correlated to the
// frame's tool_use_id (via the PreToolUse hook's map_session), then minted-on-
// first-sight. If that correlation hasn't arrived within SESSION_MAP_WAIT_MS (or
// the call carried no tool_use_id), the identity is unresolved and these ops
// honest-error rather than act as the wrong one.
function requireIdentity(conn: Connection, rid?: string): string | null {
  if (!conn.identityId) {
    err(
      conn,
      "no_session",
      "could not resolve your identity (no session bound to this call)",
      rid,
    );
    return null;
  }
  return conn.identityId;
}

// The host part of a registered-alias handle `<name>@<host>` (last @ segment).
function aliasHost(handle: string): string {
  const at = handle.lastIndexOf("@");
  return at >= 0 ? handle.slice(at + 1) : "";
}

// The alias the sender presents on an outgoing DM: its first registered alias on
// this host if any, else its default alias <identity-id>@<host>.
function senderAlias(identityId: string, host: string): string {
  const regs = stmt.selectAliasesForOwner.all(identityId) as { handle: string }[];
  const onHost = regs.find((r) => aliasHost(r.handle) === host);
  if (onHost) return onHost.handle;
  return `${identityId}@${host}`;
}

// Build the directory: every known identity (alias owners + DM participants +
// live connections), with its aliases, group memberships, and online flag.
// Group membership is DERIVED from the durable handle table — an identity is in a
// group iff it owns a `@<group>._group` handle (independent of attachment).
function buildDirectory(): DirectoryEntry[] {
  const byIdentity = new Map<string, { host: string }>();
  // alias owners (registered aliases on the handle table)
  for (const r of stmt.selectAllAliases.all() as { handle: string; owner_identity: string }[]) {
    if (!byIdentity.has(r.owner_identity)) {
      byIdentity.set(r.owner_identity, {
        host: identityHost.get(r.owner_identity) ?? aliasHost(r.handle),
      });
    }
  }
  // DM participants
  for (const r of stmt.selectDmIdentities.all() as { s: string }[]) {
    if (!byIdentity.has(r.s)) byIdentity.set(r.s, { host: hostForIdentity(r.s) });
  }
  // live connections
  for (const [id] of identityConns) {
    if (!byIdentity.has(id)) byIdentity.set(id, { host: hostForIdentity(id) });
  }

  // group memberships per identity, derived from group handles (durable). Also
  // ensures any identity owning ONLY a group handle appears in the directory.
  const groupsForIdentity = new Map<string, Set<string>>();
  for (const g of groups.values()) {
    for (const m of membersOf(g.name)) {
      if (!byIdentity.has(m.owner)) {
        byIdentity.set(m.owner, { host: hostForIdentity(m.owner) });
      }
      let set = groupsForIdentity.get(m.owner);
      if (!set) groupsForIdentity.set(m.owner, (set = new Set()));
      set.add(g.name);
    }
  }

  const out: DirectoryEntry[] = [];
  for (const [id, info] of byIdentity) {
    const aliases = (stmt.selectAliasesForOwner.all(id) as { handle: string }[]).map(
      (r) => r.handle,
    );
    out.push({
      identity_id: id,
      host: info.host,
      aliases,
      groups: [...(groupsForIdentity.get(id) ?? [])],
      online: isOnline(id),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Session binding + identity resolution. A frame's session KEY is correlated per-
// call by the hub: the PreToolUse hook reports `(tool_use_id, session_key)`, the
// adapter's frame carries the bare `tool_use_id`, and dispatchFrame resolves it to
// the session key before calling this. (A directly-asserted `session` field also
// binds here, for the in-process/test path.) bindSession then resolves the session
// key to its IDENTITY (mint-on-first-sight) and registers the live route under
// `identityConns`.
//
// The DECOUPLE removed the bind-time supersede: a different session key asserted
// later (a /resume into a new session, or a subagent's `<sid>:<agent_id>` key over
// the same socket) is a DISTINCT, coexisting route — it does NOT evict the prior.
// An identity MAY have several concurrent live sessions; only an explicit
// release_session (a /resume's SessionEnd) detaches a session key.

function bindSession(conn: Connection, sessionKey: string): void {
  // Resolve (minting on first sight, OR adopting a prior identity for a /resume on
  // the same adapter) the identity this session key speaks for. resolveIdentity reads
  // the adapter's PRIOR leases for adoption; this is sound because the UPSERT of THIS
  // key's lease happens BELOW, after resolution — so the new key is never in its own
  // adoptable set.
  const identity = resolveIdentity(sessionKey, conn.host, conn.adapterId);

  // This session key + identity are what we serve for the CURRENT frame.
  conn.sessionId = sessionKey;
  conn.boundSession = sessionKey;
  conn.identityId = identity;
  // Durable lease: record that this adapter serves this session KEY, so a reconnect
  // (even after a hub restart) re-binds it. UPSERT is idempotent. Guard on a set
  // adapterId: it's "" only on a pre-hello conn, and every path that reaches
  // bindSession (the hello re-bind loop sets it first; dispatchFrame requires
  // auth, i.e. a completed hello) has it set — so the guard is a belt-and-braces
  // backstop, never false in practice.
  if (conn.adapterId) stmt.upsertAdapterSession.run(conn.adapterId, sessionKey);

  // Keep the identity's default-alias host fresh.
  identityHost.set(identity, conn.host);

  if (conn.sessions.has(sessionKey)) {
    // already routing for this session key over this socket; nothing new to wire.
    conn.sessionIdentity.set(sessionKey, identity);
    return;
  }
  // First time this socket asserts this session key: register it as a live route
  // under the identity and flush any DMs queued for the identity while it was
  // offline (one dm_message each). "Offline" = the identity had NO live conn.
  conn.sessions.add(sessionKey);
  conn.sessionIdentity.set(sessionKey, identity);
  let set = identityConns.get(identity);
  if (!set) identityConns.set(identity, (set = new Set()));
  const wasOffline = set.size === 0;
  set.add(conn);
  if (wasOffline) flushDmQueue(conn);
}

// Release a session KEY (an explicit /resume SessionEnd, frame release_session).
// Drops the key's live route across every connection serving it AND — when the key
// is a MAIN (non-composite) key — CASCADE-releases its subagent sibling leases for
// the same adapter (the subagent-lease GC). A subagent never fires its own
// SessionEnd, so its `<mainKey>:<agent_id>` lease would otherwise linger and be
// re-bound forever on reconnect; but a subagent cannot outlive its parent session,
// so the parent's release reaps the stem's subagent keys. Idempotent: a key we don't
// serve / lease is a no-op. The identity survives.
function releaseSessionKey(sessionKey: string): void {
  // Find the adapter(s) that lease this key, BEFORE releaseOneKey deletes the rows —
  // the cascade is adapter-scoped (only the same adapter's subagent siblings). The
  // lease table is authoritative even when no conn is currently live (process death
  // + a transient SessionEnd-hook socket): the cascade keys off the durable leases,
  // not a live handle.
  const adaptersForKey = isSubagentKey(sessionKey) ? [] : leasingAdaptersOf(sessionKey);

  releaseOneKey(sessionKey);

  // CASCADE: only a MAIN key reaps subagent siblings. A subagent key being released
  // (it shares the parent's adapter and stem) must NOT reach back to reap the parent
  // or other subagents — its release is a no-op cascade.
  if (!isSubagentKey(sessionKey)) {
    const escaped = likeEscape(sessionKey);
    for (const adapterId of adaptersForKey) {
      const siblings = stmt.selectSubagentLeases.all(adapterId, `${escaped}:%`) as {
        session_id: string;
      }[];
      for (const { session_id } of siblings) releaseOneKey(session_id);
    }
  }
}

// The adapter ids that currently lease a given session key (across the durable lease
// table). Used to scope the subagent-lease cascade to the releasing adapter only.
function leasingAdaptersOf(sessionKey: string): string[] {
  const rows = stmt.selectAdaptersForSession.all(sessionKey) as { adapter_id: string }[];
  return rows.map((r) => r.adapter_id);
}

// Release ONE session key: drop its live route across every connection serving it
// (remove the conn from identityConns[identity] only when it no longer serves ANY
// key mapping to that identity — a coexisting session of the same identity must NOT
// be evicted), forget the key on the conn, and delete EVERY durable lease row for the
// key (across all adapters that lease it) so it isn't re-bound on a future reconnect.
// Idempotent: a key no conn serves / no row leases is a no-op.
function releaseOneKey(sessionKey: string): void {
  // Delete the durable lease rows first, authoritatively — independent of any live
  // conn (the SessionEnd hook's transient socket never bound this key, so a
  // conn-scoped delete would miss it after a process-death reconnect gap).
  stmt.deleteAdapterSessionByKey.run(sessionKey);

  for (const conn of allConnections) {
    if (!conn.sessions.has(sessionKey)) continue;
    const identity = conn.sessionIdentity.get(sessionKey);
    conn.sessions.delete(sessionKey);
    conn.sessionIdentity.delete(sessionKey);
    if (conn.boundSession === sessionKey) conn.boundSession = null;
    if (conn.sessionId === sessionKey) conn.sessionId = null;
    if (identity) {
      // only drop the identityConns membership if THIS conn no longer serves any
      // other session key resolving to the same identity.
      const stillServes = [...conn.sessionIdentity.values()].includes(identity);
      if (!stillServes) {
        const set = identityConns.get(identity);
        if (set) {
          set.delete(conn);
          if (set.size === 0) identityConns.delete(identity);
        }
      }
    }
  }
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
    // Lifetime contract for `conn.sessionId`/`conn.identityId`: they are the
    // CURRENT-FRAME credential + resolved identity, stamped here (resolve/bind or
    // clear) immediately before `handleFrame` reads them, and valid only for that
    // synchronous `handleFrame` call. Because this is an `await`ing async function
    // fired with `void`, two frames on one socket can be in-flight at once; each
    // stamps then synchronously hands off to `handleFrame` with no interleaving
    // await, so in single-threaded JS each frame reads its own value. Handlers MUST
    // read them synchronously and never cache across an async boundary.
    if (conn.authed && frame.t !== "hello" && frame.t !== "map_session") {
      // 1) direct `session` assertion binds verbatim (no resolution needed).
      const direct = (frame as { session?: unknown }).session;
      // `dm_ack`/`dm_read` are ATTRIBUTION-ONLY: they assert an IDENTITY (the
      // recipient) in the `session` field purely so the handler threads a DM receipt
      // to the right identity on a multi-session socket. They are NOT a change of
      // the instance's active session (a /resume), so they must NOT run bindSession
      // — which would register a push route. Stamp `conn.identityId` directly (the
      // asserted value IS an identity here) and skip the binding machinery. See
      // group-chat-adapter-reconnect.md.
      if (frame.t === "dm_ack" || frame.t === "dm_read") {
        conn.identityId = typeof direct === "string" && direct ? direct : null;
        conn.sessionId = null;
      } else if (typeof direct === "string" && direct) {
        bindSession(conn, direct);
      } else if (typeof frame.tool_use_id === "string" && frame.tool_use_id) {
        // 2) resolve the real session key from the PreToolUse correlation map. May
        //    await the hook's registration up to SESSION_MAP_WAIT_MS. On null
        //    (timeout): leave the identity unresolved — identity ops then honest-
        //    error via requireIdentity.
        const sessionKey = await resolveToolSession(frame.tool_use_id);
        if (sessionKey) bindSession(conn, sessionKey);
        else {
          conn.sessionId = null;
          conn.identityId = null;
        }
      } else {
        // No per-call credential asserted at all: clear any stale current-frame
        // binding so an unbound frame can't ride a prior frame's identity.
        conn.sessionId = null;
        conn.identityId = null;
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
  // member simply becomes "offline" (its owning identity loses this live conn).
  // Drop this conn from every identity it routed for; an identity goes offline only
  // when its LAST conn leaves. THIS is the crash/kill path (the socket drop) — no
  // release_session needed for process death.
  for (const identity of new Set(conn.sessionIdentity.values())) {
    const set = identityConns.get(identity);
    set?.delete(conn);
    if (set && set.size === 0) identityConns.delete(identity);
  }
  conn.sessions.clear();
  conn.sessionIdentity.clear();
  allConnections.delete(conn);
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
        identityId: null,
        sessionIdentity: new Map<string, string>(),
        host: "unknown",
        joinedAs: new Map<string, Set<string>>(),
        send: (frame) => ws.send(JSON.stringify(frame)),
      };
      allConnections.add(conn);
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
