#!/usr/bin/env bun
// SessionEnd hook — releases this session's group-chat binding on a genuine
// /resume (or /clear), so the OLD session key stops receiving pushes.
//
// Why this exists: a /resume keeps the adapter PROCESS alive (SessionEnd then
// SessionStart fire in-process; the stdio adapter + its adapter_id survive), but
// mints a NEW session id. Without a release, the OLD session key would linger as a
// still-live route in the hub (its lease re-binds it, identityConns keeps pushing
// to it). This hook tells the hub to drop the ending session key. The decouple's
// counterpart: process DEATH (crash/kill/quit) needs NO release — the socket drop
// + the hub's onDisconnect already remove the route; this hook is best-effort and
// its failure there is irrelevant.
//
// Robustness: like the PreToolUse hook, this NEVER blocks or fails session end. It
// connects with a short timeout, swallows every error, and always exits 0.
//
// Wired on SessionEnd via hooks/hooks.json. SessionEnd stdin carries the ending
// `session_id`, a `reason`, and (inside a subagent) an `agent_id` — we compose the
// SAME session KEY the PreToolUse hook composed so the hub releases the right key.

import { readFileSync } from "node:fs";
import { parseHub, composeSessionKey, sendOneFrame } from "./hook-shared.ts";

const CONNECT_TIMEOUT_MS = Number(process.env.GROUP_CHAT_HOOK_TIMEOUT_MS ?? 1500);

interface HookInput {
  session_id?: string;
  agent_id?: string;
  reason?: string;
  hook_event_name?: string;
}

function readStdin(): string {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

// Open a transient authenticated hub connection, send one release_session frame on
// welcome, then close. The shared `sendOneFrame` handles the handshake.
function releaseSession(
  hub: { url: string; token: string },
  sessionKey: string,
): Promise<void> {
  return sendOneFrame(
    hub,
    () => ({ t: "release_session", session_key: sessionKey }),
    CONNECT_TIMEOUT_MS,
  );
}

async function main(): Promise<void> {
  const input = JSON.parse(readStdin() || "{}") as HookInput;
  const sessionId = input.session_id ?? "";
  if (!sessionId) return;

  const hub = parseHub(process.env.GROUP_CHAT_URL ?? "");
  if (!hub) return; // no hub configured — nothing to release

  const sessionKey = composeSessionKey(sessionId, input.agent_id);
  await releaseSession(hub, sessionKey);
}

main()
  .catch((e) => {
    process.stderr.write(`group-chat session-end-hook: ${String(e)}\n`);
  })
  .finally(() => process.exit(0));
