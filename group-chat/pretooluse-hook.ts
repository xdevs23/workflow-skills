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

import { readFileSync } from "node:fs";
import { parseHub, composeSessionKey, sendOneFrame } from "./hook-shared.ts";

const CONNECT_TIMEOUT_MS = Number(process.env.GROUP_CHAT_HOOK_TIMEOUT_MS ?? 1500);

interface HookInput {
  session_id?: string;
  tool_use_id?: string;
  tool_name?: string;
  // present (and unique per invocation) ONLY inside a subagent (Task tool). A
  // subagent shares its parent's session_id, so the session KEY folds agent_id in
  // to make a subagent its own chat participant: "<session_id>:<agent_id>".
  agent_id?: string;
}

function readStdin(): string {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

// Open a transient authenticated hub connection, send one map_session frame on
// welcome, then close. The shared `sendOneFrame` handles the handshake.
function registerSession(
  hub: { url: string; token: string },
  toolUseId: string,
  sessionKey: string,
): Promise<void> {
  return sendOneFrame(
    hub,
    () => ({ t: "map_session", tool_use_id: toolUseId, session_id: sessionKey }),
    CONNECT_TIMEOUT_MS,
  );
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

  // The composite session KEY (subagent-aware) is what the hub keys on.
  const sessionKey = composeSessionKey(sessionId, input.agent_id);
  await registerSession(hub, toolUseId, sessionKey);
}

main()
  .catch((e) => {
    process.stderr.write(`group-chat pretooluse-hook: ${String(e)}\n`);
  })
  .finally(() => process.exit(0));
