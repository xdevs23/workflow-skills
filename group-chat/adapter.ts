#!/usr/bin/env bun
// group-chat channel adapter — the per-instance stdio MCP server that Claude
// Code spawns. Two jobs:
//   1. RECEIVE: hold a WebSocket to the hub; turn each incoming chat message
//      into a `notifications/claude/channel` push so it lands in the session as
//      <channel source="group-chat" group="..." from="..." ...>text</channel>.
//   2. ACT: expose the group + message tools; forward each call to the hub and
//      return the reply.
//
// One adapter = one Claude instance, possibly joined to several groups over the
// single hub socket. See ../servers/group-chat-hub/protocol.ts for the wire
// contract.
//
// Config (env):
//   GROUP_CHAT_URL   ws(s)://[token@]host:port  — hub URL with optional inline creds
//                    (e.g. ws://s3cr3t@localhost:8787). The userinfo is the token.

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  readFileSync,
  existsSync,
  readdirSync,
  openSync,
  readSync,
  fstatSync,
  closeSync,
} from "node:fs";
import { join as pathJoin } from "node:path";
import { tmpdir, homedir, hostname } from "node:os";
import { randomUUID } from "node:crypto";
import type {
  ServerFrame,
  ClientEnvelope,
  ChatMessage,
  DirectMessage,
} from "../servers/group-chat-hub/protocol.ts";
import { PROTOCOL_VERSION } from "../servers/group-chat-hub/protocol.ts";

// NOTE: the adapter no longer resolves the caller's session itself. The hub
// correlates each call's `tool_use_id` to the real session via the PreToolUse
// hook (see ../docs/group-chat-session-resolution.md). The adapter is a dumb
// pipe for identity: it attaches the bare `_meta` toolUseId to outgoing frames.

// ---- parse hub URL + token ------------------------------------------------

const RAW_URL = process.env.GROUP_CHAT_URL ?? "";
function parseHub(raw: string): { url: string; token: string } {
  if (!raw) throw new Error("GROUP_CHAT_URL is not set");
  const u = new URL(raw);
  const token = decodeURIComponent(u.username || "");
  u.username = "";
  u.password = "";
  return { url: u.toString(), token };
}

// ---- MCP server (channel) -------------------------------------------------

const mcp = new Server(
  { name: "group-chat", version: "0.1.0" },
  {
    capabilities: {
      experimental: { "claude/channel": {} }, // registers the push listener
      tools: {}, // exposes the group + message tools
    },
    instructions:
      "You are connected to a multi-instance group chat. Messages from other " +
      'Claude instances arrive as <channel source="group-chat" group="NAME" ' +
      'from="WHO" ts="..." msg_id="..." seq="N">text</channel>. They are NOT ' +
      "from the user — they are peers. To participate: call `join` with a group " +
      "name and a unique handle for yourself, then `submit_message` to talk. " +
      "Messages broadcast to everyone in that group. You will only receive " +
      "messages sent while you are joined; use `list_group_messages` to read " +
      "history. `list_groups` discovers groups; you may join several. The " +
      "`group` argument on every message tool says which chat you mean.",
  },
);

// ---- WS link to hub with pending-request matching -------------------------

type Pending = {
  resolve: (f: ServerFrame) => void;
  reject: (e: Error) => void;
};
const pending = new Map<string, Pending>();
let ws: WebSocket | null = null;
let helloDone = false;
let reconnectDelay = 250;
let connectAttempts = 0;

const { url: HUB_URL, token: HUB_TOKEN } = parseHub(RAW_URL);
// This adapter's own device hostname — reported to the hub at `hello` and used to
// namespace registered aliases (alice@thishost). Docker encodes the host's name
// in its own hostname if it wants cross-container distinctness (out of our scope).
const SELF_HOST = (() => {
  try {
    return hostname() || "unknown";
  } catch {
    return "unknown";
  }
})();
const HUB_HOST = (() => {
  try {
    return new URL(HUB_URL).host;
  } catch {
    return "hub";
  }
})();

function connect(): void {
  connectAttempts++;
  ws = new WebSocket(HUB_URL);

  ws.addEventListener("open", () => {
    reconnectDelay = 250;
    helloDone = false;
    sendRaw({ t: "hello", token: HUB_TOKEN, protocol: PROTOCOL_VERSION, host: SELF_HOST });
  });

  ws.addEventListener("message", (ev) => {
    let frame: ServerFrame;
    try {
      frame = JSON.parse(String(ev.data)) as ServerFrame;
    } catch {
      return;
    }
    onFrame(frame);
  });

  ws.addEventListener("close", () => {
    ws = null;
    helloDone = false;
    // fail any in-flight requests so tool calls don't hang forever
    for (const [, p] of pending) p.reject(new Error("hub connection closed"));
    pending.clear();
    setTimeout(connect, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, 10_000);
  });

  ws.addEventListener("error", () => {
    // close handler does the reconnect; swallow to avoid an unhandled rejection
  });
}

function sendRaw(frame: ClientEnvelope): void {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(frame));
}

// MEMBERSHIP STATE — `group -> handle`, single map for this instance's one WS.
// The adapter no longer resolves which Claude session a call belongs to (the hub
// does, from the call's tool_use_id), so it no longer keys membership per session.
// What it still needs is, per group, the handle to re-attach under and to send
// `as`. That is recovered from the SessionStart hook's identity files (every
// `identity-*.json` in the plugin-data dir, merged) and extended by explicit
// `join`s. The hub validates each `as` against what THIS connection joined as, so
// a wrong handle can never speak as another member.
const joinedGroups = new Map<string, string>(); // group -> handle

// Every group we currently want to be attached to — replayed to the hub on each
// (re)connect (idempotent re-attach).
function desiredAttachments(): Array<{ group: string; as: string }> {
  return [...joinedGroups].map(([group, as]) => ({ group, as }));
}

// Read a --flag value from argv (guard against un-interpolated placeholders).
function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i >= 0 && i + 1 < process.argv.length) {
    const v = process.argv[i + 1];
    if (v && !v.startsWith("${")) return v;
  }
  return undefined;
}

function pluginDataDir(): string {
  // --plugin-data arg → CLAUDE_PLUGIN_DATA env → inferred well-known location.
  const fromArg = argValue("--plugin-data");
  if (fromArg) return fromArg;
  const fromEnv = process.env.CLAUDE_PLUGIN_DATA;
  if (fromEnv && !fromEnv.startsWith("${")) return fromEnv;
  const home = process.env.HOME || homedir();
  if (home) {
    const inferred = pathJoin(home, ".claude", "plugins", "data", "workflow-skills-workflow-skills");
    if (existsSync(inferred)) return inferred;
  }
  return pathJoin(tmpdir(), "group-chat-plugin-data");
}

// Recover membership from the SessionStart hook's identity files. The hook writes
// `identity-<sessionId>.json` = {group: handle} for each session it sees. The
// adapter is one socket serving the instance, so it merges EVERY identity file in
// the plugin-data dir into the single `joinedGroups` map — it no longer needs to
// know which session a call belongs to (the hub binds the real account per-call
// from the call's tool_use_id). If two sessions recorded the same group under
// different handles, the later-read file wins; the hub still validates each `as`
// we assert, so this only affects which handle WE re-attach under for that group.
// Called once at startup; explicit `join`s extend the map thereafter.
function loadIdentity(): void {
  const dir = pluginDataDir();
  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => f.startsWith("identity-") && f.endsWith(".json"));
  } catch {
    return;
  }
  for (const f of files) {
    let map: Record<string, unknown>;
    try {
      map = JSON.parse(readFileSync(pathJoin(dir, f), "utf8"));
    } catch {
      continue;
    }
    for (const [group, handle] of Object.entries(map)) {
      if (typeof group === "string" && typeof handle === "string" && group && handle) {
        joinedGroups.set(group, handle);
      }
    }
  }
}

function onFrame(frame: ServerFrame): void {
  if (frame.t === "welcome") {
    helloDone = true;
    // Re-read identity files first: a session that STARTED after this adapter
    // booted (its SessionStart hook wrote identity-*.json post-boot) wouldn't be in
    // joinedGroups yet. Re-loading here means a hub reconnect (incl. after a hub
    // restart) re-attaches those groups too. Idempotent: it only adds entries.
    loadIdentity();
    // re-join everything any known session was in, to resume delivery after a
    // reconnect (hub re-attach is idempotent).
    for (const { group, as } of desiredAttachments()) {
      sendRaw({ t: "join", group, as });
    }
    return;
  }

  if (frame.t === "message") {
    const { group, seq } = frame.msg;
    // ack immediately for gap-resend bookkeeping (the message reached us)
    sendRaw({ t: "ack", group, seq });
    // send the READ receipt only AFTER the message is actually surfaced into
    // the session — that's the honest "read" moment the sender awaits.
    pushChannel(frame.msg)
      .then(() => sendRaw({ t: "read", group, seq }))
      .catch(() => {
        /* if surfacing failed, don't claim it was read */
      });
    return;
  }

  if (frame.t === "dm_message") {
    const dm = frame.msg;
    // DM RECEIVED: ack arrival immediately (state sent -> received). The `read`
    // receipt is sent later by the display hook's signal (see drainDmReads),
    // when the assistant actually surfaces the DM — that's the honest read. We
    // assert `dm.to_session` as the account so a multi-session socket attributes
    // the ack to the right recipient (the hub keys the DM thread off it).
    sendRaw({ t: "dm_ack", from_session: dm.from_session, seq: dm.seq, session: dm.to_session });
    pushDmChannel(dm).catch(() => {
      /* surfacing failed; the display hook simply won't emit a read signal */
    });
    return;
  }

  // everything else is a reply to a pending request (matched by rid)
  const anyFrame = frame as ServerFrame & { rid?: string };
  if (anyFrame.rid && pending.has(anyFrame.rid)) {
    pending.get(anyFrame.rid)!.resolve(frame);
    pending.delete(anyFrame.rid);
  }
}

// Push an incoming chat message into the session as a <channel> event.
async function pushChannel(msg: ChatMessage): Promise<void> {
  await mcp.notification({
    method: "notifications/claude/channel",
    params: {
      content: msg.text,
      // each meta key -> a <channel> tag attribute (identifier chars only)
      meta: {
        group: msg.group,
        from: msg.from,
        ts: msg.ts,
        msg_id: msg.msg_id,
        seq: String(msg.seq),
      },
    },
  });
}

// Push a DIRECT message into the session as a <channel> event, distinctly marked
// `dm="1"` and carrying both the to-alias and the sender's from-alias so a
// multi-alias recipient sees which identity was used. The display hook renders
// these distinctly and emits the read signal (see watchDmReads) when it surfaces
// one — that read signal is what advances the DM to the `read` state.
async function pushDmChannel(dm: DirectMessage): Promise<void> {
  await mcp.notification({
    method: "notifications/claude/channel",
    params: {
      content: dm.text,
      meta: {
        dm: "1",
        from_session: dm.from_session,
        from_alias: dm.from_alias,
        to_alias: dm.to_alias,
        ts: dm.ts,
        msg_id: dm.msg_id,
        seq: String(dm.seq),
      },
    },
  });
}

// DM read-receipt coordination. The display hook is a separate process; when it
// surfaces a DM to the assistant it appends a line to dm-reads.jsonl in the
// plugin-data dir — `{from_session, seq}`. We tail that file forward (same
// append-only cursor trick used for transcripts) and emit a `dm_read` for each
// new entry, so "read" reflects the genuine surfacing moment, not mere arrival.
function dmReadsPath(): string {
  return pathJoin(pluginDataDir(), "dm-reads.jsonl");
}

let dmReadsCursor = 0;

// Poll the dm-reads.jsonl tail on an interval and emit dm_read for new entries.
function watchDmReads(): void {
  setInterval(drainDmReads, 500);
}

// Read appended dm-read entries since our cursor and emit dm_read for each.
function drainDmReads(): void {
  const path = dmReadsPath();
  let fd: number;
  try {
    if (!existsSync(path)) return;
    fd = openSync(path, "r");
  } catch {
    return;
  }
  try {
    const size = fstatSync(fd).size;
    if (size <= dmReadsCursor) {
      // file shrank (rotated/truncated) -> restart from head
      if (size < dmReadsCursor) dmReadsCursor = 0;
      if (size <= dmReadsCursor) return;
    }
    const len = size - dmReadsCursor;
    const buf = Buffer.allocUnsafe(len);
    const n = readSync(fd, buf, 0, len, dmReadsCursor);
    const text = buf.toString("utf8", 0, n);
    const lastNl = text.lastIndexOf("\n");
    if (lastNl < 0) return; // no complete line yet
    const complete = text.slice(0, lastNl);
    dmReadsCursor += Buffer.byteLength(text.slice(0, lastNl + 1), "utf8");
    for (const line of complete.split("\n")) {
      if (!line.trim()) continue;
      try {
        const e = JSON.parse(line) as {
          from_session?: string;
          seq?: number;
          to_session?: string;
        };
        if (typeof e.from_session === "string" && typeof e.seq === "number") {
          // assert the recipient session (to_session) so the hub attributes the
          // read to the right account on a multi-session socket.
          sendRaw({
            t: "dm_read",
            from_session: e.from_session,
            seq: e.seq,
            ...(e.to_session ? { session: e.to_session } : {}),
          });
        }
      } catch {
        /* skip malformed */
      }
    }
  } catch {
    /* ignore */
  } finally {
    closeSync(fd);
  }
}

function ready(): boolean {
  return !!ws && ws.readyState === WebSocket.OPEN && helloDone;
}

// Wait until the hub link is up (hello completed) or a deadline passes. Smooths
// over the startup race and brief reconnects so a tool call doesn't fail just
// because it landed a few hundred ms early.
async function waitReady(deadlineMs = 5_000): Promise<void> {
  const start = Date.now();
  while (!ready()) {
    if (Date.now() - start > deadlineMs) {
      // Fail fast, but make clear it's transient and self-healing: the adapter
      // keeps reconnecting on its own and auto-re-joins every group on connect,
      // so the NEXT call once the hub is up will work — no manual re-join needed.
      throw new Error(
        `not connected to hub at ${HUB_HOST}; reconnecting automatically ` +
          `(attempt ${connectAttempts}). Your groups re-join on connect — retry in a moment.`,
      );
    }
    await new Promise((r) => setTimeout(r, 50));
  }
}

// Send a request frame and await the matching reply. `toolUseId` (when known) is
// the call's bare `_meta` toolUseId — attached so the HUB can correlate it to the
// caller's real session (via the PreToolUse hook) and bind the right account for
// identity/DM ops. The adapter does NO session resolution itself.
async function request(
  frame: ClientEnvelope,
  toolUseId?: string,
  timeoutMs = 10_000,
): Promise<ServerFrame> {
  await waitReady();
  return new Promise((resolve, reject) => {
    const rid = randomUUID();
    pending.set(rid, { resolve, reject });
    sendRaw({ ...frame, rid, ...(toolUseId ? { tool_use_id: toolUseId } : {}) });
    setTimeout(() => {
      if (pending.has(rid)) {
        pending.delete(rid);
        reject(new Error("hub request timed out"));
      }
    }, timeoutMs);
  });
}

function expect<T extends ServerFrame["t"]>(
  frame: ServerFrame,
  t: T,
): Extract<ServerFrame, { t: T }> {
  if (frame.t === "error") {
    const e = frame as Extract<ServerFrame, { t: "error" }>;
    throw new Error(`${e.code}: ${e.message}`);
  }
  if (frame.t !== t) throw new Error(`unexpected hub reply '${frame.t}'`);
  return frame as Extract<ServerFrame, { t: T }>;
}

// ---- MCP tools ------------------------------------------------------------

const TOOLS = [
  {
    name: "list_groups",
    description:
      "List the group chats that exist on the hub (name + online member count). " +
      "Call this to discover what to join.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "join",
    description:
      "Join a group chat under a unique handle. Auto-creates the group if it " +
      "doesn't exist (no approval needed). After joining you receive messages " +
      "sent to that group while you remain joined. You may join several groups.",
    inputSchema: {
      type: "object",
      properties: {
        group: { type: "string", description: "Group name [A-Za-z0-9_-]" },
        as: { type: "string", description: "Your unique handle in this group" },
      },
      required: ["group", "as"],
    },
  },
  {
    name: "leave",
    description: "Leave a group chat. Other groups you've joined are unaffected.",
    inputSchema: {
      type: "object",
      properties: { group: { type: "string" } },
      required: ["group"],
    },
  },
  {
    name: "submit_message",
    description:
      "Broadcast a message to everyone currently in the group. Optional `to` is " +
      "a list of group handles to restrict the live PUSH to those members (the " +
      "message is still logged to history for everyone — push-targeting, not " +
      "privacy). Naming a non-member errors the whole send. For a private message " +
      "use direct_message instead.",
    inputSchema: {
      type: "object",
      properties: {
        group: { type: "string" },
        message: { type: "string" },
        to: {
          type: "array",
          items: { type: "string" },
          description: "Group handles to push to (others still get it in history). Omit = whole group.",
        },
      },
      required: ["group", "message"],
    },
  },
  {
    name: "list_members",
    description:
      "List members of a group. Membership is durable; 'attached' shows whether " +
      "each member's session is currently connected (not a durable online state).",
    inputSchema: {
      type: "object",
      properties: { group: { type: "string" } },
      required: ["group"],
    },
  },
  {
    name: "show_member",
    description: "Show one member: whether currently attached, joined time, and last-seen.",
    inputSchema: {
      type: "object",
      properties: {
        group: { type: "string" },
        member_id: { type: "string" },
      },
      required: ["group", "member_id"],
    },
  },
  {
    name: "list_group_messages",
    description:
      "Read scrollback for a group from the hub's log. last_n = how many " +
      "messages; index_from_end = how many to skip from the newest (0 = most recent).",
    inputSchema: {
      type: "object",
      properties: {
        group: { type: "string" },
        last_n: { type: "number" },
        index_from_end: { type: "number" },
      },
      required: ["group"],
    },
  },
  // ---- identity / aliases ----
  {
    name: "register_alias",
    description:
      "Register a durable alias for yourself: <name>@<your-host>. Others can DM " +
      "you at that address. Names are dash-free [A-Za-z0-9_]{1,64}. First holder " +
      "wins (re-registering your own is a no-op); a name taken by another session " +
      "errors. You always also have your default alias <session-id>@<host>.",
    inputSchema: {
      type: "object",
      properties: { name: { type: "string", description: "Alias name (no dashes)" } },
      required: ["name"],
    },
  },
  {
    name: "release_alias",
    description: "Release a registered alias you own. Your default alias cannot be released.",
    inputSchema: {
      type: "object",
      properties: { name: { type: "string", description: "Alias name to release" } },
      required: ["name"],
    },
  },
  {
    name: "list_aliases",
    description: "List your own aliases (your default alias plus any you registered).",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "whoami",
    description: "Show your session id, host, and all your aliases.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "resolve_alias",
    description:
      "Resolve an address to the session it points at, and whether that session " +
      "is currently online. Address forms: <session-id>@<host> (default alias), " +
      "<name>@<host> (registered alias), <handle>@<group>._group (a member of a group).",
    inputSchema: {
      type: "object",
      properties: { address: { type: "string", description: "An address to resolve" } },
      required: ["address"],
    },
  },
  {
    name: "list_directory",
    description:
      "List every known session id with its aliases, group memberships, and " +
      "online/offline status. (Stale entries accumulate over time — pruning is a " +
      "separate concern.)",
    inputSchema: { type: "object", properties: {} },
  },
  // ---- direct messages ----
  {
    name: "direct_message",
    description:
      "Send a DIRECT message to one recipient by address — independent of any " +
      "group. `to` is any address form (default alias <session-id>@<host>, a " +
      "registered <name>@<host>, or a group member <handle>@<group>._group). " +
      "Unlike group messages, DMs are queued durably and delivered when the " +
      "recipient reconnects. The reply reports the state (read if they saw it in " +
      "time, else sent/queued); later state shows in list_direct_messages.",
    inputSchema: {
      type: "object",
      properties: {
        to: { type: "string", description: "Recipient address" },
        message: { type: "string" },
      },
      required: ["to", "message"],
    },
  },
  {
    name: "list_direct_messages",
    description:
      "Read your DM thread with one peer (given as any address, or a raw session " +
      "id). Newest last; each message shows its sent/received/read state and the " +
      "from/to aliases used.",
    inputSchema: {
      type: "object",
      properties: {
        peer: { type: "string", description: "The peer's address or session id" },
        last_n: { type: "number" },
        index_from_end: { type: "number" },
      },
      required: ["peer"],
    },
  },
];

mcp.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

function text(s: string) {
  return { content: [{ type: "text" as const, text: s }] };
}

// Registered alias names must be DASH-FREE [A-Za-z0-9_]{1,64} (mirrors the hub's
// ALIAS_NAME_RE). Forbidding dashes is the impersonation guard — a session id is
// dashed, so a dash-free name can never mimic a default alias. We enforce it here
// too (defence-in-depth) so the invariant doesn't rest on the hub alone.
const ALIAS_NAME_RE = /^[A-Za-z0-9_]{1,64}$/;

// Group-scoped tools need to know which member we are (the handle) before they
// can run. The handle comes from `joinedGroups` (recovered from the identity
// files + explicit joins); the hub binds the real ACCOUNT separately from the
// call's tool_use_id.
const GROUP_TOOLS = new Set([
  "submit_message",
  "list_members",
  "show_member",
  "list_group_messages",
  "leave",
]);

// Tools that act on the caller's ACCOUNT. Their identity is bound HUB-SIDE from
// the call's tool_use_id (the PreToolUse hook correlates it to the real session).
// The adapter just forwards the bare tool_use_id; if the hub can't resolve it in
// time it returns an honest 'no_session' error, surfaced through `expect`.
const SESSION_TOOLS = new Set([
  "register_alias",
  "release_alias",
  "list_aliases",
  "whoami",
  "direct_message",
  "list_direct_messages",
]);

// Ensure `group` is attached before serving a tool that needs it. Returns null on
// success, or an error message if we have no handle for the group — we never guess
// a handle (that risks impersonating another member). `toolUseId` is forwarded so
// the hub can bind the right account for the re-join.
async function ensureJoined(
  group: string,
  toolUseId?: string,
): Promise<string | null> {
  // We act only on a handle explicitly joined under (or recovered from an identity
  // file) — never a guessed one, which would risk impersonating another member.
  const handle = joinedGroups.get(group);
  if (!handle) {
    return (
      `Not joined to '${group}' and could not recover your identity for it ` +
      `(no prior join found). Call join('${group}', <your handle>) first.`
    );
  }
  // Re-assert the join on the hub before serving the tool. This is idempotent on
  // the hub (a returning handle just re-attaches) and is what makes the tool work
  // after a hub restart wiped the live attach, or when loadIdentity recovered the
  // handle while the socket was momentarily down (so its welcome-replay join
  // hadn't gone out). Cheap: a single round-trip the hub answers immediately.
  const r = await request({ t: "join", group, as: handle }, toolUseId);
  if (r.t === "error") {
    return `Failed to re-join '${group}' as '${handle}': ${(r as any).message}`;
  }
  return null;
}

mcp.setRequestHandler(CallToolRequestSchema, async (req, extra) => {
  const name = req.params.name;
  const a = (req.params.arguments ?? {}) as Record<string, unknown>;

  // Read the call's bare tool_use_id from _meta. We do NOT resolve a session from
  // it — that's the HUB's job (it correlates the id to the real session via the
  // PreToolUse hook). We just forward it on account-bound frames so the hub binds
  // the right account. SESSION_TOOLS need no adapter-side guard: if the hub can't
  // resolve the id in time it returns an honest no_session error.
  const toolUseId =
    ((extra as any)?._meta?.["claudecode/toolUseId"] ??
      (req.params as any)?._meta?.["claudecode/toolUseId"]) as string | undefined;

  // Group-scoped tools need a known handle for the group. If we have none — no
  // recovered identity AND no explicit join — return the honest error rather than
  // guessing (guessing risks impersonating a member).
  if (GROUP_TOOLS.has(name) && typeof a.group === "string") {
    const errMsg = await ensureJoined(a.group, toolUseId).catch((e) => String(e));
    if (errMsg) return text(errMsg);
  }
  try {
    switch (name) {
      case "list_groups": {
        const r = expect(await request({ t: "list_groups" }), "groups");
        if (r.groups.length === 0) return text("No groups yet. Use `join` to create one.");
        return text(
          "Groups:\n" +
            r.groups.map((g) => `  ${g.name} (${g.members} online)`).join("\n"),
        );
      }
      case "join": {
        // Validate before coercing: String(undefined) === "undefined" would
        // otherwise silently join under the literal handle "undefined" (e.g. when
        // called with the wrong arg name). Require non-empty strings.
        const group = typeof a.group === "string" ? a.group.trim() : "";
        const as = typeof a.as === "string" ? a.as.trim() : "";
        if (!group) return text("join requires a non-empty `group`.");
        if (!as) return text("join requires a non-empty handle in `as` (e.g. join(group, as)).");
        const r = expect(await request({ t: "join", group, as }, toolUseId), "joined");
        // Record the handle so follow-up calls find it and we auto-re-attach on
        // reconnect (welcome-replay of desiredAttachments).
        joinedGroups.set(r.group, r.as);
        return text(`Joined '${r.group}' as '${r.as}'. Messages will arrive as <channel> events.`);
      }
      case "leave": {
        const group = String(a.group);
        // Disambiguate which handle to leave when one socket holds several in the
        // group: our recovered handle for it.
        const as = joinedGroups.get(group);
        await request({ t: "leave", group, ...(as ? { as } : {}) }, toolUseId);
        joinedGroups.delete(group);
        return text(`Left '${group}'.`);
      }
      case "submit_message": {
        const group = String(a.group);
        const message = String(a.message);
        // Optional `to` push-filter: restrict the live push to these group
        // handles (still logged for everyone). A non-member in `to` errors the
        // whole send hub-side.
        const to =
          Array.isArray(a.to) && a.to.length > 0
            ? a.to.map((x) => String(x))
            : undefined;
        // Send AS our handle for the group — the hub needs `as` to attribute the
        // message to the right member (it validates we joined under it).
        // ensureJoined guaranteed it.
        const as = joinedGroups.get(group);
        // The hub replies with read-receipts: who confirmed surfacing the
        // message within the read window (read) vs the rest of the group (sent —
        // offline or slower than the window).
        const r = expect(
          await request(
            { t: "send", group, message, ...(as ? { as } : {}), ...(to ? { to } : {}) },
            toolUseId,
          ),
          "sent",
        );
        const readPart =
          r.read.length > 0
            ? `Read by ${r.read.length}: ${r.read.join(", ")}.`
            : `Read by 0.`;
        const sentPart =
          r.sent.length > 0 ? ` Sent (unconfirmed): ${r.sent.join(", ")}.` : "";
        const noOthers =
          r.read.length === 0 && r.sent.length === 0
            ? " No other members in the group."
            : "";
        return text(`Sent to '${group}' (seq ${r.seq}). ${readPart}${sentPart}${noOthers}`);
      }
      case "list_members": {
        const group = String(a.group);
        const r = expect(await request({ t: "list_members", group }), "members");
        if (r.members.length === 0) return text(`No members in '${group}'.`);
        return text(
          `Members of '${group}':\n` +
            r.members
              .map(
                (m) =>
                  `  ${m.name} [${m.attached ? "attached" : "detached"}] last seen ${m.last_seen_ts}`,
              )
              .join("\n"),
        );
      }
      case "show_member": {
        const group = String(a.group);
        const member = String(a.member_id);
        const r = expect(await request({ t: "show_member", group, member }), "member");
        if (!r.member) return text(`No member '${member}' in '${group}'.`);
        const m = r.member;
        return text(
          `${m.name} in '${group}': ${m.attached ? "attached" : "detached"}, ` +
            `joined ${m.joined_ts}, last seen ${m.last_seen_ts}`,
        );
      }
      case "list_group_messages": {
        const group = String(a.group);
        const last_n = a.last_n === undefined ? 20 : Number(a.last_n);
        const index_from_end = a.index_from_end === undefined ? 0 : Number(a.index_from_end);
        const r = expect(
          await request({ t: "history", group, last_n, index_from_end }),
          "history",
        );
        if (r.messages.length === 0) return text(`No messages in '${group}' for that range.`);
        return text(
          `Messages in '${group}':\n` +
            r.messages.map((m) => `  [${m.seq}] ${m.from}: ${m.text}`).join("\n"),
        );
      }

      // ---- identity / aliases ----
      case "register_alias": {
        const aliasName = typeof a.name === "string" ? a.name.trim() : "";
        if (!aliasName) return text("register_alias requires a non-empty `name`.");
        if (!ALIAS_NAME_RE.test(aliasName)) {
          return text(
            "Alias names must be dash-free [A-Za-z0-9_]{1,64} (dashes are reserved " +
              "for session ids, to prevent impersonating a default alias).",
          );
        }
        const r = expect(await request({ t: "register_alias", name: aliasName }, toolUseId), "aliases");
        return text(`Registered. Your aliases:\n` + r.aliases.map((x) => `  ${x}`).join("\n"));
      }
      case "release_alias": {
        const aliasName = typeof a.name === "string" ? a.name.trim() : "";
        if (!aliasName) return text("release_alias requires a non-empty `name`.");
        const r = expect(await request({ t: "release_alias", name: aliasName }, toolUseId), "aliases");
        return text(`Released '${aliasName}'. Your aliases:\n` + r.aliases.map((x) => `  ${x}`).join("\n"));
      }
      case "list_aliases": {
        const r = expect(await request({ t: "list_aliases" }, toolUseId), "aliases");
        return text(`Your aliases:\n` + r.aliases.map((x) => `  ${x}`).join("\n"));
      }
      case "whoami": {
        const r = expect(await request({ t: "whoami" }, toolUseId), "whoami");
        return text(
          `session: ${r.session_id}\nhost: ${r.host}\naliases:\n` +
            r.aliases.map((x) => `  ${x}`).join("\n"),
        );
      }
      case "resolve_alias": {
        const address = String(a.address);
        const r = expect(await request({ t: "resolve_alias", address }, toolUseId), "resolved");
        if (!r.session_id) return text(`'${address}' does not resolve to any known session.`);
        return text(
          `'${address}' -> session ${r.session_id} (${r.online ? "online" : "offline"}).`,
        );
      }
      case "list_directory": {
        const r = expect(await request({ t: "list_directory" }, toolUseId), "directory");
        if (r.entries.length === 0) return text("Directory is empty.");
        return text(
          "Directory:\n" +
            r.entries
              .map((e) => {
                const aliases = e.aliases.length ? e.aliases.join(", ") : "(default only)";
                const groupsPart = e.groups.length ? ` groups: ${e.groups.join(", ")}` : "";
                return `  ${e.session_id}@${e.host} [${e.online ? "online" : "offline"}] aliases: ${aliases}${groupsPart}`;
              })
              .join("\n"),
        );
      }

      // ---- direct messages ----
      case "direct_message": {
        const to = typeof a.to === "string" ? a.to.trim() : "";
        const message = String(a.message);
        if (!to) return text("direct_message requires a non-empty `to` address.");
        const r = expect(await request({ t: "dm", to, message }, toolUseId), "dm_sent");
        // The hub returns `read` only when the target surfaced it within the read
        // window; otherwise `sent` — which covers BOTH "offline, queued for
        // reconnect" and "online but hadn't surfaced it yet within the window".
        // We don't claim "queued/offline" outright since we can't tell those apart
        // from the reply; later state shows in list_direct_messages.
        const state =
          r.state === "read"
            ? "delivered and read"
            : "sent (not yet confirmed read — if they're offline it's queued for reconnect; check list_direct_messages for updated state)";
        return text(`DM to '${to}' (seq ${r.seq}): ${state}.`);
      }
      case "list_direct_messages": {
        const peer = typeof a.peer === "string" ? a.peer.trim() : "";
        if (!peer) return text("list_direct_messages requires a non-empty `peer`.");
        const last_n = a.last_n === undefined ? 20 : Number(a.last_n);
        const index_from_end = a.index_from_end === undefined ? 0 : Number(a.index_from_end);
        const r = expect(
          await request({ t: "dm_history", peer, last_n, index_from_end }, toolUseId),
          "dm_history",
        );
        if (r.messages.length === 0) return text(`No direct messages with '${peer}' for that range.`);
        return text(
          `Direct messages with '${peer}':\n` +
            r.messages
              .map(
                (m) =>
                  `  [${m.seq}] (${m.state}) ${m.from_alias} -> ${m.to_alias}: ${m.text}`,
              )
              .join("\n"),
        );
      }

      default:
        throw new Error(`unknown tool: ${name}`);
    }
  } catch (e) {
    return text(`Error: ${e instanceof Error ? e.message : String(e)}`);
  }
});

// ---- boot -----------------------------------------------------------------

loadIdentity(); // recover group->handle membership from the hook's identity files
connect();
watchDmReads(); // tail the display hook's DM read-signal file and emit dm_read
await mcp.connect(new StdioServerTransport());
