#!/usr/bin/env bun
// PreToolUse hook — correlates a tool call's REAL session id with its tool_use_id
// on the HUB, before the call reaches the adapter.
//
// Why this exists: a stdio MCP server (the adapter) cannot learn the real Claude
// Code session id of a tool call — the env id is a boot/phantom id, and no stdio
// MCP carries a per-call session id (see ../docs/group-chat-session-resolution.md).
// But THIS hook fires before each tool call and authoritatively receives the real
// `session_id` + the `tool_use_id` on stdin. So we ship that pair straight to the
// hub: it keeps a Map<tool_use_id, session_id>, and when the adapter's frame for
// the same call arrives carrying the bare tool_use_id, the hub resolves the
// account from this map. The adapter does no session resolution at all.
//
// Robustness: this hook must NEVER block or fail a tool call. It connects with a
// short timeout, swallows every error, and always exits 0. If the hub is down or
// the registration is slow, the worst case is the adapter's account-bound call
// honest-errors ("could not resolve your session") and the next call works.
//
// Wired on PreToolUse (matcher: the group-chat MCP tools) via hooks/hooks.json.

import { hostname } from "node:os";
import { readFileSync } from "node:fs";
import { PROTOCOL_VERSION } from "../servers/group-chat-hub/protocol.ts";

const CONNECT_TIMEOUT_MS = Number(process.env.GROUP_CHAT_HOOK_TIMEOUT_MS ?? 1500);

interface HookInput {
  session_id?: string;
  tool_use_id?: string;
  tool_name?: string;
}

function readStdin(): string {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

// Parse GROUP_CHAT_URL exactly as the adapter does: ws(s)://[token@]host:port,
// where the userinfo is the token. Returns null if unset/unparseable.
function parseHub(raw: string): { url: string; token: string } | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    const token = decodeURIComponent(u.username || "");
    u.username = "";
    u.password = "";
    return { url: u.toString(), token };
  } catch {
    return null;
  }
}

function selfHost(): string {
  try {
    return hostname() || "unknown";
  } catch {
    return "unknown";
  }
}

// Open a transient authenticated hub connection, send one map_session frame on
// welcome, then close. Resolves when the frame is sent (or on any failure — we
// never propagate). Bounded by CONNECT_TIMEOUT_MS.
function registerSession(
  hub: { url: string; token: string },
  toolUseId: string,
  sessionId: string,
): Promise<void> {
  return new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      resolve();
    };
    const timer = setTimeout(finish, CONNECT_TIMEOUT_MS);

    let ws: WebSocket;
    try {
      ws = new WebSocket(hub.url);
    } catch {
      clearTimeout(timer);
      resolve();
      return;
    }
    ws.addEventListener("open", () => {
      try {
        ws.send(
          JSON.stringify({
            t: "hello",
            token: hub.token,
            protocol: PROTOCOL_VERSION,
            host: selfHost(),
          }),
        );
      } catch {
        finish();
      }
    });
    ws.addEventListener("message", (ev) => {
      let frame: { t?: string };
      try {
        frame = JSON.parse(String(ev.data));
      } catch {
        return;
      }
      if (frame.t === "welcome") {
        try {
          ws.send(
            JSON.stringify({ t: "map_session", tool_use_id: toolUseId, session_id: sessionId }),
          );
        } catch {
          /* ignore */
        }
        // Give the frame a moment to flush, then close. The hub needs no reply.
        setTimeout(finish, 50);
      } else if (frame.t === "error") {
        finish(); // bad token / protocol — nothing we can do, don't block the call
      }
    });
    ws.addEventListener("error", () => finish());
    ws.addEventListener("close", () => finish());
  });
}

async function main(): Promise<void> {
  const input = JSON.parse(readStdin() || "{}") as HookInput;
  const toolName = input.tool_name ?? "";
  const sessionId = input.session_id ?? "";
  const toolUseId = input.tool_use_id ?? "";

  // Only act for the group-chat MCP tools. The hooks.json matcher already scopes
  // us, but re-checking here keeps the hook a no-op if mis-wired more broadly.
  if (!toolName.includes("group-chat__")) return;
  if (!sessionId || !toolUseId) return;

  const hub = parseHub(process.env.GROUP_CHAT_URL ?? "");
  if (!hub) return; // no hub configured — nothing to register, don't block the call

  await registerSession(hub, toolUseId, sessionId);
}

main()
  .catch((e) => {
    process.stderr.write(`group-chat pretooluse-hook: ${String(e)}\n`);
  })
  .finally(() => process.exit(0));
