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
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join as pathJoin } from "node:path";
import { tmpdir } from "node:os";
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

// On (re)connect the hub may need us to re-join groups we thought we were in,
// so it can resume fan-out and re-send any gap. Track desired memberships.
const joinedGroups = new Map<string, string>(); // group -> our handle

// IDENTITY RECOVERY: a fresh adapter process (after /reload-plugins or resuming
// next day) has an empty joinedGroups, so it would re-join nothing and the first
// submit_message would fail. The SessionStart hook records this session's
// {group: handle} identity (from the transcript) into a file in the plugin data
// dir; we read it here on startup and seed joinedGroups, so the existing welcome
// re-attach logic auto-rejoins every group before any tool call runs.
function pluginDataDir(): string {
  return process.env.CLAUDE_PLUGIN_DATA || pathJoin(tmpdir(), "group-chat-plugin-data");
}

function loadRecoveredIdentity(): Record<string, string> {
  const dir = pluginDataDir();
  if (!existsSync(dir)) return {};
  // Prefer the file for THIS session id if the harness passed it; else fall back
  // to the most-recently-written identity-*.json (one session = one adapter).
  const sid = process.env.GROUP_CHAT_SESSION_ID || process.env.CLAUDE_CODE_SESSION_ID;
  try {
    if (sid && existsSync(pathJoin(dir, `identity-${sid}.json`))) {
      return JSON.parse(readFileSync(pathJoin(dir, `identity-${sid}.json`), "utf8"));
    }
    const files = readdirSync(dir).filter((f) => f.startsWith("identity-") && f.endsWith(".json"));
    if (files.length === 0) return {};
    let newest = files[0];
    let newestMtime = 0;
    for (const f of files) {
      const m = statSync(pathJoin(dir, f)).mtimeMs;
      if (m > newestMtime) { newestMtime = m; newest = f; }
    }
    return JSON.parse(readFileSync(pathJoin(dir, newest), "utf8"));
  } catch {
    return {};
  }
}

// Seed joinedGroups from the recovered identity. These are re-asserted to the
// hub on the first welcome; the hub treats them as idempotent re-attach.
for (const [group, handle] of Object.entries(loadRecoveredIdentity())) {
  joinedGroups.set(group, handle);
}

function onFrame(frame: ServerFrame): void {
  if (frame.t === "welcome") {
    helloDone = true;
    // re-join everything we were in, to resume delivery after a reconnect
    for (const [group, as] of joinedGroups) {
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

mcp.setRequestHandler(CallToolRequestSchema, async (req) => {
  const name = req.params.name;
  const a = (req.params.arguments ?? {}) as Record<string, unknown>;
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
        joinedGroups.set(r.group, r.as);
        return text(`Joined '${r.group}' as '${r.as}'. Messages will arrive as <channel> events.`);
      }
      case "leave": {
        const group = String(a.group);
        await request({ t: "leave", group });
        joinedGroups.delete(group);
        return text(`Left '${group}'.`);
      }
      case "submit_message": {
        const group = String(a.group);
        const message = String(a.message);
        // The hub replies with read-receipts: who confirmed surfacing the
        // message within the read window (read) vs the rest of the group (sent —
        // offline or slower than the window).
        const r = expect(await request({ t: "send", group, message }), "sent");
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
