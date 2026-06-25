#!/usr/bin/env bun
// group-chat hub — the one networked process. Many Claude instances connect
// over WebSocket; many named groups live here so multiple projects share one
// hub. See protocol.ts for the wire contract and the delivery model.
//
// Run:  GROUP_CHAT_TOKEN=secret bun servers/group-chat-hub/hub.ts
// Env:
//   GROUP_CHAT_TOKEN  required unless GROUP_CHAT_ALLOW_NO_AUTH=1 — shared secret
//   GROUP_CHAT_PORT   listen port (default 8787)
//   GROUP_CHAT_HOST   bind host (default 127.0.0.1)
//   GROUP_CHAT_DATA   data dir for the per-group JSONL logs (default ./.group-chat-data)
//   GROUP_CHAT_ALLOW_NO_AUTH=1  run open (localhost/tunnel only)
//   GROUP_CHAT_WINDOW  in-memory message window per group for gap re-send (default 500)

import { mkdirSync, appendFileSync, existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join as pathJoin } from "node:path";
import { randomUUID } from "node:crypto";
import type {
  ServerFrame,
  ClientEnvelope,
  ChatMessage,
  MemberInfo,
} from "./protocol.ts";
import { PROTOCOL_VERSION } from "./protocol.ts";

const TOKEN = process.env.GROUP_CHAT_TOKEN ?? "";
const ALLOW_NO_AUTH = process.env.GROUP_CHAT_ALLOW_NO_AUTH === "1";
const PORT = Number(process.env.GROUP_CHAT_PORT ?? 8787);
const HOST = process.env.GROUP_CHAT_HOST ?? "127.0.0.1";
const DATA_DIR = process.env.GROUP_CHAT_DATA ?? ".group-chat-data";
const WINDOW = Number(process.env.GROUP_CHAT_WINDOW ?? 500);
// How long a `send` awaits read-receipts from currently-connected members
// before replying. Members who confirm within this window are "read"; everyone
// else in the group is "sent" (offline, or a slower-than-window RTT). 100ms
// comfortably covers localhost/LAN/tunnel; bump it for high-latency links.
const READ_RECEIPT_MS = Number(process.env.GROUP_CHAT_READ_RECEIPT_MS ?? 100);

if (!TOKEN && !ALLOW_NO_AUTH) {
  console.error(
    "group-chat-hub: refusing to start without GROUP_CHAT_TOKEN. " +
      "Set a token, or GROUP_CHAT_ALLOW_NO_AUTH=1 to run open on a trusted network.",
  );
  process.exit(1);
}

// Group names become a <channel group="..."> attribute downstream, and a
// filename for the log, so keep them to a safe charset.
const GROUP_NAME_RE = /^[A-Za-z0-9_-]{1,64}$/;
const MEMBER_NAME_RE = /^[A-Za-z0-9_-]{1,64}$/;

// ---------------------------------------------------------------------------
// Per-connection state. One Connection == one Claude instance's adapter socket.

interface Connection {
  id: string;
  authed: boolean;
  // groups this connection is joined to, keyed by group name -> the SET of member
  // names it joined as. A connection can use different names in different groups,
  // and — because one adapter socket can serve several Claude sessions (instance-
  // scoped) — several names in the SAME group. The per-message `as` on `send`
  // selects which of these to speak as.
  joinedAs: Map<string, Set<string>>;
  send(frame: ServerFrame): void;
}

interface Member {
  name: string;
  // Membership is DURABLE and identity-based: a member stays in the group until
  // an explicit `leave`, regardless of connection. `conn` is only the transient
  // live binding ("currently attached"), never persisted. There is no durable
  // offline state — absence of a connection is not a stored fact, since we can't
  // know whether an absent member is gone or just temporarily detached.
  conn: Connection | null; // null => not currently attached (still a member)
  joined_ts: string;
  last_seen_ts: string;
  // last seq this member has confirmed receiving. Lives on the Member (not the
  // Connection) so it survives a reconnect within a hub lifetime. Reset to the
  // group head on hub restart (no-backfill: a member detached across a restart
  // gets only new messages; history via list_group_messages).
  delivered: number;
}

interface Group {
  name: string;
  seq: number; // monotonic, last assigned
  members: Map<string, Member>; // by member name
  window: ChatMessage[]; // recent messages kept in memory for gap re-send
  logPath: string;
  membersPath: string; // durable roster (group + handle + joined_ts), no conn state
}

const groups = new Map<string, Group>();

// Pending read-receipt collectors, keyed `${group}#${seq}`. A `send` registers
// one with the set of recipients it's awaiting; each inbound `read {group,seq}`
// marks that member read; the collector resolves early once all recipients have
// confirmed, or on the READ_RECEIPT_MS deadline (whichever comes first).
interface ReadCollector {
  awaiting: Set<string>; // recipient names not yet confirmed
  read: Set<string>; // recipient names that confirmed within the window
  done: () => void; // resolve early when awaiting drains
}
const pendingReads = new Map<string, ReadCollector>();

mkdirSync(DATA_DIR, { recursive: true });

function logPathFor(group: string): string {
  return pathJoin(DATA_DIR, `${group}.jsonl`);
}

function membersPathFor(group: string): string {
  return pathJoin(DATA_DIR, `${group}.members.json`);
}

// Persist a group's durable roster: just identity (name + joined_ts), never the
// connection or any online/offline state. Written on every join/leave.
function persistRoster(group: Group): void {
  const roster = [...group.members.values()].map((m) => ({
    name: m.name,
    joined_ts: m.joined_ts,
  }));
  try {
    writeFileSync(group.membersPath, JSON.stringify(roster));
  } catch (e) {
    console.error(`group-chat-hub: failed to persist roster for ${group.name}:`, e);
  }
}

// On startup, recover each group from disk: its message log (for seq + window)
// AND its durable member roster (so a hub restart preserves who is in each
// group — members come back detached, never removed).
//
// A group can exist with members but NO messages yet (everyone joined, nobody
// sent), so we must discover group names from BOTH the .jsonl logs AND the
// .members.json rosters — recovering from only one would drop members-only or
// messages-only groups.
function recoverGroups(): void {
  if (!existsSync(DATA_DIR)) return;
  const names = new Set<string>();
  for (const file of readdirSync(DATA_DIR)) {
    if (file.endsWith(".members.json")) names.add(file.slice(0, -".members.json".length));
    else if (file.endsWith(".jsonl")) names.add(file.slice(0, -".jsonl".length));
  }
  for (const name of names) {
    if (!GROUP_NAME_RE.test(name)) continue;
    const path = logPathFor(name);
    let maxSeq = 0;
    const window: ChatMessage[] = [];
    if (existsSync(path)) {
      try {
        const lines = readFileSync(path, "utf8").split("\n");
        for (const line of lines) {
          if (!line.trim()) continue;
          const msg = JSON.parse(line) as ChatMessage;
          if (msg.seq > maxSeq) maxSeq = msg.seq;
          window.push(msg);
        }
      } catch (e) {
        console.error(`group-chat-hub: failed to recover ${path}:`, e);
      }
    }
    const group: Group = {
      name,
      seq: maxSeq,
      members: new Map(),
      window: window.slice(-WINDOW),
      logPath: path,
      membersPath: membersPathFor(name),
    };
    // reload the durable roster: members return DETACHED (conn=null), delivered
    // reset to head (no-backfill across a hub restart).
    try {
      if (existsSync(group.membersPath)) {
        const roster = JSON.parse(readFileSync(group.membersPath, "utf8")) as {
          name: string;
          joined_ts: string;
        }[];
        for (const r of roster) {
          if (!MEMBER_NAME_RE.test(r.name)) continue;
          group.members.set(r.name, {
            name: r.name,
            conn: null,
            joined_ts: r.joined_ts,
            last_seen_ts: r.joined_ts,
            delivered: maxSeq, // head: detached-across-restart gets only new msgs
          });
        }
      }
    } catch (e) {
      console.error(`group-chat-hub: failed to recover roster for ${name}:`, e);
    }
    groups.set(name, group);
  }
}

function getOrCreateGroup(name: string): Group {
  let g = groups.get(name);
  if (!g) {
    g = {
      name,
      seq: 0,
      members: new Map(),
      window: [],
      logPath: logPathFor(name),
      membersPath: membersPathFor(name),
    };
    groups.set(name, g);
  }
  return g;
}

function nowIso(): string {
  return new Date().toISOString();
}

function memberInfo(m: Member): MemberInfo {
  return {
    name: m.name,
    attached: m.conn !== null, // live binding, not a durable state
    joined_ts: m.joined_ts,
    last_seen_ts: m.last_seen_ts,
  };
}

// Append-then-fan-out. The log append commits the message and its seq before
// any delivery, so a crash mid-fan-out never loses the record, and every live
// connection's gap re-send can rely on the window/log. Returns the message plus
// the set of member names it was actively pushed to (connected, not the sender)
// — the `send` handler awaits read-receipts from exactly those.
function broadcast(
  group: Group,
  from: string,
  text: string,
): { msg: ChatMessage; recipients: string[] } {
  const seq = ++group.seq;
  const msg: ChatMessage = {
    group: group.name,
    seq,
    from,
    ts: nowIso(),
    msg_id: randomUUID(),
    text,
  };
  // 1) durable append first
  appendFileSync(group.logPath, JSON.stringify(msg) + "\n");
  // 2) keep it in the in-memory window for gap re-send
  group.window.push(msg);
  if (group.window.length > WINDOW) group.window.shift();
  // 3) fan out to every online member's connection EXCEPT the sender — a sender
  //    shouldn't get its own message tickled back (that just wastes a turn).
  //    The message is still logged above, so it's in history/scrollback and
  //    counts toward seq; we only suppress the live push to its author.
  const recipients: string[] = [];
  for (const m of group.members.values()) {
    if (m.name === from) {
      // advance the sender's marker so a later reconnect won't re-send its own
      // message during gap re-send either
      if (seq > m.delivered) m.delivered = seq;
      continue;
    }
    if (m.conn) {
      // attached: push live
      m.conn.send({ t: "message", msg });
      recipients.push(m.name);
      // optimistically advance; an explicit `ack` is what keeps gap re-send
      // precise across a reconnect (the member may go down before acking)
      if (seq > m.delivered) m.delivered = seq;
    }
    // detached members are still members; they just don't get a live push (and,
    // per no-backfill, won't get this message on re-attach either — pull via
    // list_group_messages). Their delivered marker stays put.
  }
  return { msg, recipients };
}

// When a member reconnects and re-joins, re-send any windowed message newer
// than what it last confirmed. A brand-new member starts at the current head,
// so nothing is re-sent — consistent with decision B (no history on join).
function resendGap(member: Member, group: Group): void {
  for (const msg of group.window) {
    if (msg.seq > member.delivered && member.conn) {
      member.conn.send({ t: "message", msg });
    }
  }
  // don't advance delivered here; let the member's acks confirm receipt
}

function err(conn: Connection, code: string, message: string, rid?: string): void {
  conn.send({ t: "error", rid, code, message });
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
    conn.send({ t: "welcome", protocol: PROTOCOL_VERSION });
    return;
  }

  if (!conn.authed) {
    err(conn, "unauthorized", "send hello first", rid);
    return;
  }

  switch (frame.t) {
    case "ping":
      conn.send({ t: "pong" });
      return;

    case "ack": {
      // connection confirms receipt; advance the delivered marker of every member
      // this connection holds in the group (the push went down this one socket, so
      // it reached all of them). One socket may hold several handles per group.
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
      // READ RECEIPT: a member on this connection surfaced message `seq`. Satisfy
      // any awaited recipient name this connection holds in the group (the surface
      // happened on this one socket). Resolve the sender's `send` early once every
      // awaited recipient has confirmed.
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
        members: g.members.size, // total durable members (attached or not)
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
      // `name_taken` only fires for a GENUINE concurrent claim: the handle is
      // already a member AND a DIFFERENT live connection is currently attached as
      // it. Membership being durable, a returning member (detached) re-attaching,
      // or this same connection re-joining, are both fine (idempotent re-attach).
      if (existing && existing.conn !== null && existing.conn !== conn) {
        err(conn, "name_taken", `'${frame.as}' is already attached in '${frame.group}'`, rid);
        return;
      }
      const isReturning = existing !== undefined;
      // Brand-new member: delivered starts at head (no backfill — decision B), and
      // the durable roster is updated. Returning member: keep its delivered so the
      // gap it missed within this hub lifetime is re-sent on re-attach.
      const member: Member = existing ?? {
        name: frame.as,
        conn,
        joined_ts: nowIso(),
        last_seen_ts: nowIso(),
        delivered: g.seq,
      };
      member.conn = conn; // (re)bind the live connection
      member.last_seen_ts = nowIso();
      g.members.set(frame.as, member);
      let handles = conn.joinedAs.get(frame.group);
      if (!handles) conn.joinedAs.set(frame.group, (handles = new Set()));
      handles.add(frame.as); // this conn now speaks for `frame.as` in this group
      if (!isReturning) persistRoster(g); // durable: a new member joined

      // Member is now attached, so any NEW broadcast fans out to it (closes the
      // join<->first-message race). For a returning member, re-send what it
      // missed while detached (within this hub lifetime).
      conn.send({ t: "joined", rid, group: frame.group, as: frame.as });
      if (isReturning) resendGap(member, g);
      return;
    }

    case "leave": {
      const g = groups.get(frame.group);
      const handles = conn.joinedAs.get(frame.group);
      // Pick which handle to leave: the explicit `as` if given, else the sole
      // handle this connection holds in the group (unambiguous). If `as` names a
      // handle this connection doesn't hold, leave nothing (no cross-member leave).
      const as =
        frame.as !== undefined
          ? handles?.has(frame.as)
            ? frame.as
            : undefined
          : handles && handles.size === 1
            ? [...handles][0]
            : undefined;
      if (g && as) {
        // `leave` is the ONLY thing that removes a durable member. It deletes the
        // membership and persists the removal, so the member is truly gone (a
        // later join is fresh, no gap re-send). Detaching (a dropped socket) does
        // NOT do this — that just clears the live binding, see onDisconnect.
        g.members.delete(as);
        handles!.delete(as);
        if (handles!.size === 0) conn.joinedAs.delete(frame.group);
        persistRoster(g);
      }
      conn.send({ t: "left", rid, group: frame.group });
      return;
    }

    case "send": {
      const g = groups.get(frame.group);
      const handles = conn.joinedAs.get(frame.group);
      // Sender identity: the explicit `as` (validated to be a handle THIS
      // connection joined under — so a connection can never speak as a member it
      // didn't join as), or the sole handle if unambiguous. One adapter socket can
      // hold several handles in a group (multiple sessions); `as` disambiguates.
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
      const m = g.members.get(as);
      if (m) m.last_seen_ts = nowIso();
      const { msg, recipients } = broadcast(g, as, frame.message);

      // Reply with read-receipts: await `read` confirmations from the members we
      // just pushed to, up to READ_RECEIPT_MS. Whoever confirms in the window is
      // "read"; the rest of the group is "sent" (offline, or slower than the
      // window). If there were no recipients, reply immediately.
      const key = `${g.name}#${msg.seq}`;
      const groupNames = () =>
        [...g.members.values()].map((x) => x.name).filter((n) => n !== as);

      if (recipients.length === 0) {
        conn.send({ t: "sent", rid, group: g.name, seq: msg.seq, read: [], sent: groupNames() });
        return;
      }

      const col: ReadCollector = {
        awaiting: new Set(recipients),
        read: new Set(),
        done: () => {}, // replaced below
      };
      pendingReads.set(key, col);

      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        pendingReads.delete(key);
        const read = [...col.read];
        const sent = groupNames().filter((n) => !col.read.has(n));
        conn.send({ t: "sent", rid, group: g.name, seq: msg.seq, read, sent });
      };
      col.done = finish; // resolve early when all recipients confirm
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
      // Pull scrollback from the on-disk log (authoritative, survives restart).
      let all: ChatMessage[] = [];
      try {
        const lines = readFileSync(g.logPath, "utf8").split("\n");
        for (const line of lines) {
          if (line.trim()) all.push(JSON.parse(line) as ChatMessage);
        }
      } catch {
        all = [...g.window];
      }
      const fromEnd = Math.max(0, frame.index_from_end | 0);
      const n = Math.max(0, frame.last_n | 0);
      const end = all.length - fromEnd;
      const start = Math.max(0, end - n);
      conn.send({ t: "history", rid, group: frame.group, messages: all.slice(start, end) });
      return;
    }
  }
}

function onDisconnect(conn: Connection): void {
  // A dropped socket DETACHES the member — it does NOT remove it. Membership is
  // durable; clearing the live binding is all that happens. The member stays in
  // the group (and on disk) and re-attaches on the next join. Only an explicit
  // `leave` removes a member.
  for (const [group, handles] of conn.joinedAs) {
    const g = groups.get(group);
    for (const as of handles) {
      const m = g?.members.get(as);
      if (m && m.conn === conn) {
        m.conn = null; // detached, still a member
        m.last_seen_ts = nowIso();
      }
    }
  }
}

// ---------------------------------------------------------------------------
// WebSocket server (Bun native)

recoverGroups();

const connections = new WeakMap<object, Connection>();

const server = Bun.serve<{ conn: Connection }>({
  port: PORT,
  hostname: HOST,
  fetch(req, srv) {
    if (srv.upgrade(req)) return; // upgraded to WS
    return new Response("group-chat hub: websocket only\n", { status: 426 });
  },
  websocket: {
    open(ws) {
      const conn: Connection = {
        id: randomUUID(),
        authed: false,
        joinedAs: new Map<string, Set<string>>(),
        delivered: new Map(),
        send: (frame) => ws.send(JSON.stringify(frame)),
      };
      ws.data = { conn };
      connections.set(ws, conn);
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
      try {
        handleFrame(conn, frame);
      } catch (e) {
        console.error("group-chat-hub: handler error:", e);
        err(conn, "internal", String(e), frame.rid);
      }
    },
    close(ws) {
      onDisconnect(ws.data.conn);
    },
  },
});

console.error(
  `group-chat-hub: listening ws://${HOST}:${PORT}  ` +
    `(auth: ${ALLOW_NO_AUTH ? "OPEN" : "token"}, data: ${DATA_DIR}, window: ${WINDOW})`,
);
// keep a reference so the server isn't GC'd
void server;
