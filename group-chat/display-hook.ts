#!/usr/bin/env bun
// MessageDisplay hook — pretty-prints incoming group-chat messages.
//
// Channel events from this plugin land in the session transcript as lines like:
//   {"type":"queue-operation","operation":"enqueue","content":"<channel source=\"plugin:workflow-skills:group-chat\" group=\"main\" from=\"x\" ... seq=\"3\">...text...</channel>"}
// They render in the terminal as a sparse "← group-chat: <text>" line that
// omits the sender. This hook fires while an assistant message is displayed
// (display-only — Claude's context and the transcript keep the original), scans
// the transcript for any group-chat channel events we haven't bannered yet, and
// PREPENDS a boxed quote (sender + group + text) above the assistant reply so
// the human sees who said what.
//
// Wired on-by-default via hooks/hooks.json. No-ops cleanly when there are no
// group-chat events.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const SOURCE = "plugin:workflow-skills:group-chat";

interface HookInput {
  session_id?: string;
  transcript_path?: string;
  message_content?: string;
  hook_event_name?: string;
}

interface ChannelEvent {
  group: string;
  from: string;
  seq: number;
  text: string;
}

function readStdin(): string {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

// Emit nothing-changing output and exit. Returning no displayContent leaves the
// assistant text untouched.
function passthrough(): never {
  process.exit(0);
}

function emit(displayContent: string): never {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "MessageDisplay",
        displayContent,
      },
    }),
  );
  process.exit(0);
}

// Parse one <channel ...>body</channel> string from this plugin. Returns null
// if it isn't one of ours.
function parseChannel(content: string): ChannelEvent | null {
  if (!content.startsWith("<channel ")) return null;
  if (!content.includes(`source="${SOURCE}"`)) return null;
  const attr = (name: string): string => {
    const m = content.match(new RegExp(`${name}="([^"]*)"`));
    return m ? m[1] : "";
  };
  const bodyMatch = content.match(/>\n?([\s\S]*?)\n?<\/channel>/);
  const text = bodyMatch ? bodyMatch[1].trim() : "";
  const seq = Number(attr("seq"));
  if (!Number.isFinite(seq)) return null;
  return { group: attr("group"), from: attr("from"), seq, text };
}

// State: the highest channel seq we've already bannered, PER GROUP, per
// session — so we never re-banner on later assistant messages, and seq tracking
// is correct even across multiple groups (seq is per-group). Stored as JSON
// {group: seq}. Keyed by session id.
function stateFile(sessionId: string): string {
  const dir = join(tmpdir(), "group-chat-display");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return join(dir, `${sessionId || "default"}.json`);
}

// Returns the per-group seen map, or null if this session has NEVER run the
// hook before. The null case matters: on first activation we must NOT
// back-banner the whole pre-existing history — we initialize the markers to the
// current heads and show only messages that arrive afterward.
function loadSeen(sessionId: string): Map<string, number> | null {
  try {
    const raw = readFileSync(stateFile(sessionId), "utf8").trim();
    if (raw === "") return null;
    const obj = JSON.parse(raw) as Record<string, number>;
    return new Map(Object.entries(obj));
  } catch {
    return null;
  }
}

function saveSeen(sessionId: string, seen: Map<string, number>): void {
  try {
    writeFileSync(stateFile(sessionId), JSON.stringify(Object.fromEntries(seen)));
  } catch {
    // best-effort; if we can't persist, worst case is a re-banner once
  }
}

// Build the boxed quote for one event. Wraps the body to keep the box tidy.
function box(ev: ChannelEvent): string {
  const header = `╭─ 📨 ${ev.from} in #${ev.group} (seq ${ev.seq})`;
  const lines: string[] = [];
  const WIDTH = 72;
  for (const raw of ev.text.split("\n")) {
    if (raw.length <= WIDTH) {
      lines.push(raw);
      continue;
    }
    // soft-wrap long lines at word boundaries
    let cur = "";
    for (const word of raw.split(" ")) {
      if ((cur + " " + word).trim().length > WIDTH) {
        lines.push(cur.trim());
        cur = word;
      } else {
        cur = (cur + " " + word).trim();
      }
    }
    if (cur) lines.push(cur);
  }
  const body = lines.map((l) => `│ ${l}`).join("\n");
  return `${header}\n${body}\n╰─`;
}

function main(): void {
  const input = JSON.parse(readStdin() || "{}") as HookInput;
  const tpath = input.transcript_path;
  const sessionId = input.session_id || "default";
  const assistantText = input.message_content ?? "";

  if (!tpath || !existsSync(tpath)) passthrough();

  // scan the transcript for our channel events
  let lines: string[];
  try {
    lines = readFileSync(tpath, "utf8").split("\n");
  } catch {
    passthrough();
  }

  // Collect every group-chat channel event in the transcript, de-duped by
  // (group, seq). seq is per-GROUP, so we track the high-water mark per group.
  const events = new Map<string, ChannelEvent>(); // key: `${group}#${seq}`
  for (const line of lines) {
    if (!line.includes(SOURCE)) continue; // cheap pre-filter
    let obj: any;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }
    if (obj.type !== "queue-operation" || typeof obj.content !== "string") continue;
    const ev = parseChannel(obj.content);
    if (!ev) continue;
    events.set(`${ev.group}#${ev.seq}`, ev);
  }

  // current per-group head seq across the whole transcript
  const head = new Map<string, number>();
  for (const ev of events.values()) {
    head.set(ev.group, Math.max(head.get(ev.group) ?? 0, ev.seq));
  }

  const seen = loadSeen(sessionId); // Map<group, seq> as JSON, or null on first run

  // FIRST ACTIVATION: never back-banner pre-existing history. Record the
  // current per-group head and show nothing this pass — only messages that
  // arrive AFTER the hook was turned on get bannered.
  if (seen === null) {
    saveSeen(sessionId, head);
    passthrough();
  }

  // banner every event newer than what we've shown for its group
  const fresh: ChannelEvent[] = [];
  for (const ev of events.values()) {
    if (ev.seq > (seen.get(ev.group) ?? 0)) fresh.push(ev);
  }

  if (fresh.length === 0) passthrough();

  fresh.sort((a, b) => a.group.localeCompare(b.group) || a.seq - b.seq);

  // advance the per-group marker to the head we observed
  saveSeen(sessionId, head);

  const banners = fresh.map(box).join("\n");
  emit(`${banners}\n\n${assistantText}`);
}

try {
  main();
} catch {
  // never break message display because of a hook error
  passthrough();
}
