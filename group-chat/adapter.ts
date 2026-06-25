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
import { tmpdir, homedir } from "node:os";
import { randomUUID } from "node:crypto";
import type {
  ServerFrame,
  ClientEnvelope,
  ChatMessage,
} from "../servers/group-chat-hub/protocol.ts";
import { PROTOCOL_VERSION } from "../servers/group-chat-hub/protocol.ts";

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
    sendRaw({ t: "hello", token: HUB_TOKEN, protocol: PROTOCOL_VERSION });
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

// PER-SESSION MEMBERSHIP STATE. The adapter is per-INSTANCE, not per-session:
// the CLI starts it once and may route several sessions' tool calls through it
// (e.g. /resume into a different session ⇒ a different member). So membership is
// keyed per real session id, never global. `group -> handle` for each session.
const sessionGroups = new Map<string, Map<string, string>>(); // sessionId -> (group -> handle)

// Fallback bucket for attachments we couldn't attribute to a session id (the
// toolUseId wasn't resolvable to a transcript yet — e.g. the very first call of a
// brand-new session, before its transcript flushed). An explicit `join` here must
// still let same-process follow-up calls send, and must re-attach on reconnect.
// The adapter has a single live WS, so one shared bucket is correct.
const SESSIONLESS = "\0sessionless";

// Cache: a toolUseId resolves to exactly one session id, immutably. Resolving it
// requires scanning the project transcript dir, so we do it once per toolUseId.
const toolUseSession = new Map<string, string>(); // toolUseId -> sessionId

// Forward-scan cursor: how many bytes of each transcript we've already scanned
// for toolUseIds. Transcripts only ever grow (append-only) and a new toolUseId is
// always appended AFTER the last one we resolved, so on the next lookup we resume
// each file from its cursor and read only the newly-appended bytes — not the whole
// file from the top. Files we've never seen start at 0 (full scan once).
const scanned = new Map<string, number>(); // absolute file path -> bytes already scanned

// Every group we currently want to be attached to, across all known sessions —
// replayed to the hub on each (re)connect (idempotent re-attach). Multiple
// sessions in the same group under different handles is allowed by the model;
// the hub binds whichever handle we assert.
function desiredAttachments(): Array<{ group: string; as: string }> {
  const out: Array<{ group: string; as: string }> = [];
  for (const groups of sessionGroups.values()) {
    for (const [group, as] of groups) out.push({ group, as });
  }
  return out;
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

// The project's transcript directory: ~/.claude/projects/<slug>/, where <slug>
// is the launch dir with every non-alphanumeric run collapsed to '-'. The launch
// dir is stable per project (CLAUDE_PROJECT_DIR), so this points at the right
// dir regardless of which session's call we're serving.
function projectTranscriptDir(): string | undefined {
  const proj = (() => {
    const v = process.env.CLAUDE_PROJECT_DIR;
    if (v && !v.startsWith("${")) return v;
    return process.cwd();
  })();
  const home = process.env.HOME || homedir();
  if (!home || !proj) return undefined;
  const slug = proj.replace(/[^A-Za-z0-9]/g, "-");
  const dir = pathJoin(home, ".claude", "projects", slug);
  return existsSync(dir) ? dir : undefined;
}

// Scan a single transcript forward from its cursor for `needle`, STOPPING at the
// first complete line that contains it. Reads in 64 KiB chunks from the cursor's
// byte offset, tests each COMPLETE line, discards it (flat memory, no whole-file
// load). On a hit, `newOffset` is the byte just past that matching line (match +
// 1) — NOT end-of-file. The caller advances the cursor to exactly there, so the
// next lookup resumes from the line after the match and no earlier line is ever
// skipped. A trailing partial line (an in-progress append) is never tested; it is
// re-read whole next time. On no match, `newOffset` is meaningless (the caller
// must not advance a non-matching file's cursor).
function scanFileForward(
  path: string,
  startOffset: number,
  needle: string,
): { found: boolean; newOffset: number } {
  let fd: number;
  try {
    fd = openSync(path, "r");
  } catch {
    return { found: false, newOffset: startOffset };
  }
  try {
    const size = fstatSync(fd).size;
    if (size <= startOffset) return { found: false, newOffset: startOffset };
    const CHUNK = 1 << 16; // 64 KiB
    const buf = Buffer.allocUnsafe(CHUNK);
    let pos = startOffset; // absolute offset of the NEXT byte to read
    let lineStart = startOffset; // absolute offset where the current line begins
    let carry = ""; // bytes of the in-progress line carried across chunks
    while (pos < size) {
      const n = readSync(fd, buf, 0, Math.min(CHUNK, size - pos), pos);
      if (n <= 0) break;
      pos += n;
      const text = carry + buf.toString("utf8", 0, n);
      let from = 0;
      let nl = text.indexOf("\n");
      while (nl !== -1) {
        const line = text.slice(from, nl);
        // byte offset just past this line's newline = where the NEXT line starts
        const lineEnd = lineStart + Buffer.byteLength(text.slice(0, nl + 1), "utf8");
        if (line.includes(needle)) {
          return { found: true, newOffset: lineEnd }; // stop here: match + 1
        }
        from = nl + 1;
        lineStart = lineEnd;
        nl = text.indexOf("\n", from);
      }
      carry = text.slice(from); // trailing partial line, re-read next scan
    }
    return { found: false, newOffset: startOffset };
  } catch {
    return { found: false, newOffset: startOffset };
  } finally {
    closeSync(fd);
  }
}

// Resolve a toolUseId to the real session id by finding the transcript that
// contains it; the basename of that <session-id>.jsonl IS the session id. This is
// the ONLY reliable per-call path to the real session: the env/init session id is
// the boot/phantom session, not the one whose calls we serve. Cached per
// toolUseId (immutable). Each lookup scans every transcript FORWARD from its
// cursor — only newly-appended bytes — so steady-state cost is tiny. Returns
// undefined if not found yet (line not flushed, or new session) — callers must
// NOT guess in that case.
function resolveSessionId(toolUseId: string | undefined): string | undefined {
  if (!toolUseId) return undefined;
  const cached = toolUseSession.get(toolUseId);
  if (cached) return cached;
  const dir = projectTranscriptDir();
  if (!dir) return undefined;
  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".jsonl"));
  } catch {
    return undefined;
  }
  for (const f of files) {
    const path = pathJoin(dir, f);
    const sid = f.slice(0, -".jsonl".length);
    const { found, newOffset } = scanFileForward(path, scanned.get(path) ?? 0, toolUseId);
    // Advance ONLY the matching file's cursor, and only to just past the matched
    // line. A non-matching file is left untouched — advancing it would skip its
    // own not-yet-looked-up ids on a later lookup and we'd never rescan that
    // region, corrupting that session's resolution.
    if (found) {
      scanned.set(path, newOffset);
      toolUseSession.set(toolUseId, sid);
      return sid;
    }
  }
  return undefined;
}

// Read a session's {group: handle} identity map, written by the SessionStart hook
// from that session's transcript (identity-<sessionId>.json). Returns {} if
// unknown/unwritten.
function readIdentity(sessionId: string): Record<string, string> {
  const file = pathJoin(pluginDataDir(), `identity-${sessionId}.json`);
  try {
    if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    /* fall through */
  }
  return {};
}

// Lazily materialize a session's joinedGroups from its identity file, the first
// time we see that session. Re-attaches any recovered groups on the hub
// (idempotent), so a session resumed across /reload-plugins auto-rejoins.
function ensureSessionState(sessionId: string): Map<string, string> {
  let groups = sessionGroups.get(sessionId);
  if (groups) return groups;
  groups = new Map<string, string>();
  sessionGroups.set(sessionId, groups);
  for (const [group, handle] of Object.entries(readIdentity(sessionId))) {
    groups.set(group, handle);
    if (ready()) sendRaw({ t: "join", group, as: handle }); // re-attach now if connected
  }
  return groups;
}

function onFrame(frame: ServerFrame): void {
  if (frame.t === "welcome") {
    helloDone = true;
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

// Send a request frame and await the matching reply.
async function request(frame: ClientEnvelope, timeoutMs = 10_000): Promise<ServerFrame> {
  await waitReady();
  return new Promise((resolve, reject) => {
    const rid = randomUUID();
    pending.set(rid, { resolve, reject });
    sendRaw({ ...frame, rid });
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
    description: "Broadcast a message to everyone currently in the group.",
    inputSchema: {
      type: "object",
      properties: {
        group: { type: "string" },
        message: { type: "string" },
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
];

mcp.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

function text(s: string) {
  return { content: [{ type: "text" as const, text: s }] };
}

// Group-scoped tools need to know which member we are before they can run. Their
// identity is recovered lazily per session (toolUseId → session id → identity).
const GROUP_TOOLS = new Set([
  "submit_message",
  "list_members",
  "show_member",
  "list_group_messages",
  "leave",
]);

// Ensure `group` is attached for THIS session before serving a tool that needs
// it. `groups` is the calling session's own (group -> handle) map. Returns null
// on success, or an error message if we have no recovered handle for the group —
// we never guess a handle (that risks impersonating another member).
async function ensureJoined(groups: Map<string, string>, group: string): Promise<string | null> {
  if (groups.has(group)) return null; // already attached for this session
  const handle = groups.get(group); // ensureSessionState already merged identity
  if (!handle) {
    return (
      `Not joined to '${group}' and could not recover your identity for it ` +
      `(no prior join found for this session). Call join('${group}', <your handle>) first.`
    );
  }
  const r = await request({ t: "join", group, as: handle });
  if (r.t === "error") {
    return `Failed to re-join '${group}' as '${handle}': ${(r as any).message}`;
  }
  return null;
}

mcp.setRequestHandler(CallToolRequestSchema, async (req, extra) => {
  const name = req.params.name;
  const a = (req.params.arguments ?? {}) as Record<string, unknown>;

  // Resolve which session is calling, per-call, from the toolUseId. The env/init
  // session id is the boot/phantom session — not the one whose call this is — so
  // we never use it for identity. When the toolUseId can't be resolved yet, fall
  // back to the SESSIONLESS bucket so an explicit join in this process still lets
  // same-process follow-ups send (we never invent a handle, only reuse one the
  // caller explicitly joined under). `groups` is the membership map to act on.
  const toolUseId =
    ((extra as any)?._meta?.["claudecode/toolUseId"] ??
      (req.params as any)?._meta?.["claudecode/toolUseId"]) as string | undefined;
  const sessionId = resolveSessionId(toolUseId);
  const groups = ensureSessionState(sessionId ?? SESSIONLESS);

  // Group-scoped tools need a known handle for the group. If we have none — no
  // recovered identity AND no explicit join under the active bucket — return the
  // honest error rather than guessing (guessing risks impersonating a member).
  if (GROUP_TOOLS.has(name) && typeof a.group === "string") {
    const errMsg = await ensureJoined(groups, a.group).catch((e) => String(e));
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
        const group = String(a.group);
        const as = String(a.as);
        const r = expect(await request({ t: "join", group, as }), "joined");
        // Record under the active bucket (the resolved session, or SESSIONLESS if
        // unresolved) so same-process follow-up calls find this handle and we
        // auto-re-attach on reconnect. `groups` already points at the right bucket.
        groups.set(r.group, r.as);
        return text(`Joined '${r.group}' as '${r.as}'. Messages will arrive as <channel> events.`);
      }
      case "leave": {
        const group = String(a.group);
        // Disambiguate which handle to leave when one socket holds several in the
        // group (multi-session): this session's own handle.
        const as = groups.get(group);
        await request({ t: "leave", group, ...(as ? { as } : {}) });
        groups.delete(group);
        return text(`Left '${group}'.`);
      }
      case "submit_message": {
        const group = String(a.group);
        const message = String(a.message);
        // Send AS this session's handle for the group — one adapter socket can
        // hold several handles (multiple sessions), so the hub needs `as` to
        // attribute the message to the right member. ensureJoined guaranteed it.
        const as = groups.get(group);
        // The hub replies with read-receipts: who confirmed surfacing the
        // message within the read window (read) vs the rest of the group (sent —
        // offline or slower than the window).
        const r = expect(await request({ t: "send", group, message, ...(as ? { as } : {}) }), "sent");
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
      default:
        throw new Error(`unknown tool: ${name}`);
    }
  } catch (e) {
    return text(`Error: ${e instanceof Error ? e.message : String(e)}`);
  }
});

// ---- boot -----------------------------------------------------------------

connect();
await mcp.connect(new StdioServerTransport());
