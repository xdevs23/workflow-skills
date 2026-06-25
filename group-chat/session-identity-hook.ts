#!/usr/bin/env bun
// SessionStart hook — recovers this session's group-chat identity from the
// transcript and hands it to the adapter via a file in $CLAUDE_PLUGIN_DATA.
//
// Why this exists: a fresh adapter process (after /reload-plugins, or resuming a
// session next day) has no memory of which groups it joined or under what handle,
// so it can't auto-re-attach and the first submit_message fails. But the
// transcript durably records every join/leave tool call. This hook — which
// reliably receives transcript_path on stdin — reads that history, computes the
// current {group: handle} identity map, and writes it where the adapter can read
// it on startup. The transcript is the source of truth; this file is the handoff.
//
// Wired on SessionStart (source: startup | resume | compact) via hooks/hooks.json.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join as pathJoin } from "node:path";
import { tmpdir } from "node:os";

const JOIN_TOOL = "group-chat__join"; // substring match (plugin-namespaced)
const LEAVE_TOOL = "group-chat__leave";

interface HookInput {
  session_id?: string;
  transcript_path?: string;
  hook_event_name?: string;
  source?: string;
}

function readStdin(): string {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

// The plugin's persistent data dir. Claude Code exports CLAUDE_PLUGIN_DATA to
// hooks; fall back to a temp dir keyed the same way the adapter will look.
function dataDir(): string {
  const dir = process.env.CLAUDE_PLUGIN_DATA || pathJoin(tmpdir(), "group-chat-plugin-data");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

function identityFile(sessionId: string): string {
  return pathJoin(dataDir(), `identity-${sessionId || "default"}.json`);
}

// Walk the transcript, collecting join/leave tool calls in order. A session can
// be in SEVERAL groups at once (possibly different handles), so identity is a
// map; a later leave for a group cancels its join. Returns {group: handle}.
function computeIdentity(transcriptPath: string): Record<string, string> {
  const identity: Record<string, string> = {};
  let lines: string[];
  try {
    lines = readFileSync(transcriptPath, "utf8").split("\n");
  } catch {
    return identity;
  }
  for (const line of lines) {
    if (!line.includes(JOIN_TOOL) && !line.includes(LEAVE_TOOL)) continue;
    let obj: any;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }
    const content = obj?.message?.content ?? obj?.content;
    if (!Array.isArray(content)) continue;
    for (const b of content) {
      if (b?.type !== "tool_use" || typeof b?.name !== "string") continue;
      if (b.name.includes(JOIN_TOOL)) {
        const group = b.input?.group;
        const as = b.input?.as;
        if (typeof group === "string" && typeof as === "string") identity[group] = as;
      } else if (b.name.includes(LEAVE_TOOL)) {
        const group = b.input?.group;
        if (typeof group === "string") delete identity[group];
      }
    }
  }
  return identity;
}

function main(): void {
  const input = JSON.parse(readStdin() || "{}") as HookInput;
  const sessionId = input.session_id || "default";
  const tpath = input.transcript_path;

  // On a brand-new startup with no transcript yet, there's nothing to recover —
  // write an empty map so the adapter has a definite (empty) answer rather than
  // reading a stale file from a previous session with the same id.
  const identity = tpath && existsSync(tpath) ? computeIdentity(tpath) : {};

  try {
    writeFileSync(identityFile(sessionId), JSON.stringify(identity));
  } catch (e) {
    // never break session start because of this hook
    process.stderr.write(`group-chat session-identity-hook: ${String(e)}\n`);
  }
  process.exit(0);
}

try {
  main();
} catch (e) {
  process.stderr.write(`group-chat session-identity-hook: ${String(e)}\n`);
  process.exit(0);
}
