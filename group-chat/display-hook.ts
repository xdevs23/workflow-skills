#!/usr/bin/env bun
// MessageDisplay hook — pretty-prints incoming group-chat messages.
//
// Channel events from this plugin land in the session transcript as lines like:
//   {"type":"queue-operation","operation":"enqueue","content":"<channel source=\"plugin:workflow-skills:group-chat\" group=\"main\" from=\"x\" ... seq=\"3\">...text...</channel>"}
// They render in the terminal as a sparse "← group-chat: <text>" line that
// omits the sender. This hook fires while an assistant message is displayed
// (display-only — Claude's context and the transcript keep the original), scans
// the transcript for any group-chat channel events we haven't bannered yet, and
// PREPENDS a card (ANSI-colored header + markdown-blockquote body, no box-drawing)
// above the assistant reply so the human sees who said what.
//
// Wired on-by-default via hooks/hooks.json. No-ops cleanly when there are no
// group-chat events.

import { readFileSync, writeFileSync, appendFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir, homedir } from "node:os";

const SOURCE = "plugin:workflow-skills:group-chat";

interface HookInput {
  session_id?: string;
  transcript_path?: string;
  message_content?: string;
  hook_event_name?: string;
}

// A surfaced channel event — either a GROUP message or a DIRECT message. For a
// group message `group`/`from` are set; for a DM `dm` is true and the DM fields
// (`fromSession`/`fromAlias`/`toAlias`) carry the addressing. `seq` is per-group
// for group messages and per session-pair for DMs.
interface ChannelEvent {
  dm: boolean;
  group: string; // group name (group msgs) — for DMs we synthesize `dm:<from_identity>`
  from: string; // sender handle (group msgs)
  fromIdentity: string; // DM sender identity id
  toIdentity: string; // DM recipient identity id
  fromAlias: string; // DM sender alias
  toAlias: string; // DM recipient alias (the identity it was addressed to)
  seq: number;
  replyTo: number | null; // group reply: the seq this message replies to (null otherwise)
  to: string[] | null; // group push-targeting: member names this was directed to (null = plain broadcast)
  role: string | null; // the author's DERIVED role ("human"|"agent"|"system"); null when absent.
  // Only "human" is rendered (a person talking) — agents are the unmarked default, no noise.
  attachments: { name: string; size: number }[] | null; // v8 FILE OFFER sidecar on a
  // group message (null when none). Rendered as a "📎 N file(s) offered on seq S" marker
  // listing each name + human-readable size, with the approve_files hint.
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
// if it isn't one of ours. Handles both group messages and direct messages
// (the latter carry dm="1" plus from_identity/to_identity/from_alias/to_alias).
function parseChannel(content: string): ChannelEvent | null {
  if (!content.startsWith("<channel ")) return null;
  if (!content.includes(`source="${SOURCE}"`)) return null;
  const attr = (name: string): string => {
    const m = content.match(new RegExp(`${name}="([^"]*)"`));
    return m?.[1] ?? "";
  };
  const bodyMatch = content.match(/>\n?([\s\S]*?)\n?<\/channel>/);
  const text = bodyMatch?.[1]?.trim() ?? "";
  const seq = Number(attr("seq"));
  if (!Number.isFinite(seq)) return null;
  const isDm = attr("dm") === "1";
  if (isDm) {
    const fromIdentity = attr("from_identity");
    if (!fromIdentity) return null;
    return {
      dm: true,
      group: `dm:${fromIdentity}`, // synthetic per-peer key for seen-state tracking
      from: attr("from_alias"),
      fromIdentity,
      toIdentity: attr("to_identity"),
      fromAlias: attr("from_alias"),
      toAlias: attr("to_alias"),
      seq,
      replyTo: null,
      to: null,
      role: attr("role") || null,
      attachments: null,
      text,
    };
  }
  const replyToRaw = attr("reply_to");
  const replyTo = replyToRaw ? Number(replyToRaw) : null;
  const toRaw = attr("to");
  const to = toRaw ? toRaw.split(",").filter(Boolean) : null;
  // FILE OFFER (v8): `attach` encodes `<size> <name>` per file, files tab-joined (the
  // adapter's pushChannel encoding). Size is the leading token; the name is the
  // remainder (it may contain spaces/colons). A malformed entry is skipped.
  const attachRaw = attr("attach");
  let attachments: { name: string; size: number }[] | null = null;
  if (attachRaw) {
    const list: { name: string; size: number }[] = [];
    for (const entry of attachRaw.split("\t")) {
      const sp = entry.indexOf(" ");
      if (sp <= 0) continue;
      const size = Number(entry.slice(0, sp));
      const name = entry.slice(sp + 1);
      if (name && Number.isFinite(size)) list.push({ name, size });
    }
    if (list.length) attachments = list;
  }
  return {
    dm: false,
    group: attr("group"),
    from: attr("from"),
    fromIdentity: "",
    toIdentity: "",
    fromAlias: "",
    toAlias: "",
    seq,
    replyTo: Number.isFinite(replyTo as number) ? replyTo : null,
    to: to && to.length ? to : null,
    role: attr("role") || null,
    attachments,
    text,
  };
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

// Merge the freshly-observed per-chat head into the prior markers: chats present
// in `head` take its value (advancing forward, or re-basing DOWN on a seq reset);
// chats absent from `head` (no events this pass) keep their prior marker so they
// aren't dropped and re-treated as first-activation next turn.
function mergeSeen(prev: Map<string, number>, head: Map<string, number>): Map<string, number> {
  const out = new Map(prev);
  for (const [chat, seq] of head) out.set(chat, seq);
  return out;
}

// The plugin-data dir holds the adapter's identity files and our DM read-signal
// file. Mirror the adapter's resolution: CLAUDE_PLUGIN_DATA env → inferred
// well-known location → tmpdir fallback (so the adapter and hook agree).
function pluginDataDir(): string {
  const fromEnv = process.env.CLAUDE_PLUGIN_DATA;
  if (fromEnv && !fromEnv.startsWith("${")) return fromEnv;
  const home = process.env.HOME || homedir();
  if (home) {
    const inferred = join(home, ".claude", "plugins", "data", "workflow-skills-workflow-skills");
    if (existsSync(inferred)) return inferred;
  }
  return join(tmpdir(), "group-chat-plugin-data");
}

// READ SIGNAL: when this hook surfaces a DM to the assistant, append a line to
// dm-reads.jsonl so the adapter (which tails it) emits a `dm_read` to the hub —
// advancing the DM to the `read` state. This is the honest "read" moment: the
// assistant has actually seen the message.
function signalDmRead(fromIdentity: string, seq: number, recipientIdentity: string): void {
  try {
    const dir = pluginDataDir();
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    appendFileSync(
      join(dir, "dm-reads.jsonl"),
      JSON.stringify({ from_identity: fromIdentity, seq, to_identity: recipientIdentity }) + "\n",
    );
  } catch {
    // best-effort: if we can't signal, the DM simply stays in `received` state
  }
}

// Build the rendered card for one event: an ANSI-colored header line followed by
// the body as a MARKDOWN BLOCKQUOTE. DMs and groups get DIFFERENT colors; the
// group name (or the DM peer) is bolded. Body text stays default for readability.
// Kept minimal/standard so it's terminal-safe.
const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  group: "\x1b[36m", // cyan — group messages
  dm: "\x1b[35m", // magenta — direct messages
};

// Direct messages render distinctly from group messages: a different glyph, a
// different COLOR, and a header that names the channel (the group, or the DM peer).
//
// NO box-drawing: Claude Code GFM-renders this hook's displayContent. Earlier we
// drew a box ('╭─' header, per-line '│ ' left-bars, '╰─' footer). That broke in
// two ways (#9, #10): (a) the renderer's buggy table heuristic latched onto our
// injected box-drawing verticals lining up across lines plus a lone '|' in the
// peer's body text and styled it as a table delimiter; (b) when the card rendered
// while a real table was streaming in the assistant output, our box-drawing
// characters interleaved into the table grid and scattered it. Removing OUR
// box-drawing removes the trigger for both — there is nothing of ours left to
// mis-detect as a table or to interleave into one. (We do NOT make the lone '|'
// meaningful; a '|' with no delimiter row is still not a valid GFM table — the fix
// is purely the absence of our verticals.)

// Human-readable byte size for the file-offer marker (e.g. 482 KB, 1.2 MB). Compact and
// approximate — it's a glanceable hint, not an exact accounting.
function humanSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "? B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${i === 0 ? n : n.toFixed(n < 10 ? 1 : 0)} ${units[i]}`;
}

function box(ev: ChannelEvent): string {
  const color = ev.dm ? C.dm : C.group;
  // The chat identity is the prominent part: bold the group name / the DM pair.
  const replyMark = !ev.dm && ev.replyTo != null ? `  ↩ reply to seq ${ev.replyTo}` : "";
  // push-targeting marker: makes a to:-directed message legible to the recipient
  // (otherwise indistinguishable from a plain broadcast). Names who it was directed to.
  const toMark = !ev.dm && ev.to ? `  → to: ${ev.to.join(", ")}` : "";
  // human-author marker: ONLY for role="human" (a person — the web console user —
  // talking in the room), so it's distinct from a peer agent's message. Agents are the
  // unmarked default (no marker, to avoid noise). Consistent with the markers above.
  const humanMark = ev.role === "human" ? `  👤 human` : "";
  // ONE standalone ANSI-colored header line, prefixed with the SAME left bar the
  // markdown blockquote body draws, so the header sits flush above the quote and the
  // card reads as one connected unit. The bar MUST be U+258E (▎ LEFT ONE QUARTER
  // BLOCK) — that is exactly the glyph the renderer uses for the blockquote rule
  // (verified from a hexdump: bytes e2 96 8e). Do NOT "fix" it to U+2502 (│): that is
  // a thinner box-drawing line that would NOT line up with the quote's thick bar — and
  // a single header bar is safe (the per-body-line bars are what triggered the table
  // mis-detection / streaming-table corruption, bugs #9/#10; one header bar does not).
  const BAR = "▎"; // ▎ — match the blockquote's left rule exactly
  const header = ev.dm
    ? `${color}${BAR} 🔒 direct message  ${C.bold}${ev.fromAlias} → ${ev.toAlias}${C.reset}${color}  (seq ${ev.seq})${humanMark}${C.reset}`
    : `${color}${BAR} 📨 #${C.bold}${ev.group}${C.reset}${color}  from ${ev.from}  (seq ${ev.seq})${replyMark}${toMark}${humanMark}${C.reset}`;
  // FILE OFFER (v8): when the message carries an offer, append it INSIDE the blockquote
  // body (so it stays part of the one card — no new top-level block, no box-drawing) as a
  // "📎 N file(s) offered on seq S" header, one line per file (name + human size), and
  // the approve hint. It annotates the message exactly like the reply/to markers do.
  const offerLines: string[] = [];
  if (!ev.dm && ev.attachments && ev.attachments.length) {
    const n = ev.attachments.length;
    offerLines.push("");
    offerLines.push(`📎 ${n} file(s) offered on seq ${ev.seq}:`);
    for (const f of ev.attachments) offerLines.push(`   ${f.name} (${humanSize(f.size)})`);
    offerLines.push(`approve with approve_files('${ev.group}', ${ev.seq})`);
  }
  // Body as a markdown blockquote: prefix EACH line with '> '. No manual soft-wrap
  // (the renderer wraps; our old manual wrap fought it and produced ragged lines).
  // A blank line in the body becomes a bare '>' so the blockquote stays contiguous —
  // a real empty line would split it into two separate quotes.
  const body = [...ev.text.split("\n"), ...offerLines]
    .map((l) => (l === "" ? ">" : `> ${l}`))
    .join("\n");
  // Blank line between the ANSI header and the blockquote. REQUIRED: the renderer
  // treats the header (a paragraph) and the blockquote as separate BLOCKS, and inserts
  // its own inter-block margin — so there's a small gap between the header's ▎ and the
  // body's ▎ regardless. We accept that gap (the bars stay column-aligned, which reads
  // fine). Attempts to close it failed for the same root reason — they tried to merge
  // two blocks into one: a trailing-backslash hard break renders the '\' verbatim (this
  // renderer's known backslash bug), and a single '\n' still leaves the inter-block
  // margin. The only way to a truly continuous bar would be putting the header INSIDE
  // the blockquote ('> ' prefix), which changes the header's styling — not worth it.
  return `${header}\n\n${body}`;
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

  // Collect channel events PER CHAT in transcript (append) order. We keep order
  // because seq is monotonic only within ONE hub epoch — a hub DB wipe restarts
  // seq at 1, and the transcript accumulates BOTH epochs' events. So max-seq is
  // not the current head; we must find the latest epoch by reading forward.
  const ordered = new Map<string, ChannelEvent[]>(); // chat -> events in transcript order
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
    (ordered.get(ev.group) ?? ordered.set(ev.group, []).get(ev.group)!).push(ev);
  }

  // For each chat, keep only the CURRENT EPOCH's events: scan its events in
  // transcript order and cut to the segment after the last seq DROP (seq going
  // down means a new epoch began — the hub was wiped and seq restarted). Within a
  // single epoch seq only rises, so the tail from the last drop is the live epoch.
  // De-dup that segment by seq (a reconnect gap-resend can repeat a seq).
  const events = new Map<string, ChannelEvent>(); // key: `${group}#${seq}`, current epoch only
  for (const [chat, list] of ordered) {
    let epochStart = 0;
    for (let i = 1; i < list.length; i++) {
      if (list[i]!.seq < list[i - 1]!.seq) epochStart = i; // a drop => new epoch begins here
    }
    for (let i = epochStart; i < list.length; i++) {
      const ev = list[i]!;
      events.set(`${chat}#${ev.seq}`, ev);
    }
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

  // SEQ-RESET DETECTION (per chat). seq is monotonic only within one hub epoch; a
  // hub DB wipe restarts it at 1. So if a chat's current head dropped BELOW our
  // saved high-water, the sequence was interrupted — a new epoch began and the old
  // (higher) seqs no longer exist. Treat the saved marker as stale for that chat
  // (baseline 0) so the new low-seq messages banner as the genuinely-new messages
  // they are. Each chat (group or `dm:<peer>`) is judged independently.
  const baseline = (group: string): number => {
    const prev = seen.get(group) ?? 0;
    const h = head.get(group) ?? 0;
    return h < prev ? 0 : prev; // head below saved => reset epoch => baseline 0
  };

  // banner every event newer than the (reset-aware) baseline for its chat
  const fresh: ChannelEvent[] = [];
  for (const ev of events.values()) {
    if (ev.seq > baseline(ev.group)) fresh.push(ev);
  }

  if (fresh.length === 0) passthrough();

  // Emit the DM read signal for every fresh DM we're about to surface: this is
  // the genuine "read" moment (the assistant is seeing it now). The adapter tails
  // the signal file and reports `dm_read` to the hub.
  for (const ev of fresh) {
    if (ev.dm) signalDmRead(ev.fromIdentity, ev.seq, ev.toIdentity);
  }

  fresh.sort((a, b) => a.group.localeCompare(b.group) || a.seq - b.seq);

  // Advance each chat's marker to the head we observed, MERGED with the prior
  // markers — chats with no events this pass keep their saved marker (writing
  // `head` alone would drop them and re-trigger first-activation next turn). A
  // reset chat (head below saved) re-bases DOWN to the new epoch's head.
  saveSeen(sessionId, mergeSeen(seen, head));

  // Blank line BETWEEN cards: a card ends in a blockquote, and a lone '\n' would
  // put the next card's header on the line right after a '> ' line — GFM lazy
  // continuation then absorbs that header INTO the previous quote (it renders
  // glued to the end of the prior message). The blank line terminates the quote.
  const banners = fresh.map(box).join("\n\n");
  emit(`${banners}\n\n${assistantText}`);
}

try {
  main();
} catch {
  // never break message display because of a hook error
  passthrough();
}
