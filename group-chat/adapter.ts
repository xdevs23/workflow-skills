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
//   CLAUDE_CODE_SESSION_ID  the current session id — trustworthy ONLY on a fresh
//                    respawn (manual Reconnect / first launch), where it equals the
//                    live session. Drives the reconnect-notice pre-flight + the
//                    transcript watch. Unset → the notice path stays silent.
//   CLAUDE_PROJECT_DIR  the project dir; its '/'→'-' slug locates the per-session
//                    transcript at ~/.claude/projects/<slug>/<session>.jsonl. Unset →
//                    we glob the projects dir and match on corr_id content instead.
//   GROUP_CHAT_DEBUG   "1" enables the on-disk lifecycle log (dbg, below); no-op otherwise.
//   CLAUDE_PLUGIN_ROOT / CLAUDE_PLUGIN_DATA  locate the .cache debug log and the
//                    plugin data dir (the display hook's dm-reads signal file).

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  existsSync,
  openSync,
  readSync,
  fstatSync,
  closeSync,
  appendFileSync,
  readdirSync,
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

// ---- debug lifecycle log --------------------------------------------------
// The adapter's stderr is a socket to the harness and is NOT readable from the
// sandbox, which is exactly what hid the reconnect-notice failure for cycles: the
// three failure modes (latch never fired / push written-then-dropped-by-harness /
// push threw) all presented identically as "no notice appeared". This writes a
// timestamped, append-only lifecycle log to a file ON DISK that the sandbox CAN
// read, so a Reconnect leaves a forensic trail that disambiguates them.
//
// Path: <CLAUDE_PLUGIN_ROOT>/.cache/adapter-debug.log. In this dev checkout
// CLAUDE_PLUGIN_ROOT == the project dir (verified live), so this lands in the
// project's gitignored .cache/. Falls back to cwd. Gated behind GROUP_CHAT_DEBUG
// so it's a no-op in normal operation — set GROUP_CHAT_DEBUG=1 to enable.
const DEBUG_ENABLED = process.env.GROUP_CHAT_DEBUG === "1";
const DEBUG_LOG_PATH = (() => {
  const root =
    (process.env.CLAUDE_PLUGIN_ROOT && !process.env.CLAUDE_PLUGIN_ROOT.startsWith("${")
      ? process.env.CLAUDE_PLUGIN_ROOT
      : process.cwd());
  return pathJoin(root, ".cache", "adapter-debug.log");
})();
// pid lets us tell a fresh respawn apart from the prior process in one shared log.
const DEBUG_PID = process.pid;
function dbg(event: string, detail?: Record<string, unknown>): void {
  if (!DEBUG_ENABLED) return;
  try {
    const line =
      JSON.stringify({
        ts: new Date().toISOString(),
        pid: DEBUG_PID,
        event,
        ...(detail ?? {}),
      }) + "\n";
    appendFileSync(DEBUG_LOG_PATH, line);
  } catch {
    // never let logging crash the adapter; the .cache dir may not exist yet, in
    // which case we silently skip (the dir is created by the project, not us).
  }
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
// The per-process relay id the hub assigns on first connect (in `welcome`). Held
// in MEMORY for this process's lifetime and echoed on every later `hello`, so the
// hub recognizes a reconnecting endpoint and re-binds the sessions it was serving
// (surviving a hub restart). NOT persisted: a restarted adapter process is a new
// Claude session about which we assume no prior state. Never cleared on a socket
// drop/reconnect — that's exactly the case it must survive. See
// docs/group-chat-adapter-reconnect.md.
let adapterId: string | null = null;

// FRESH-PROCESS NOTICE GATE: set true (in maybeFireAdapterNotice) after we surface
// the one-shot adapter-status notice. Fires at most once per process, only on a
// freshly-minted adapter_id (the orphaned-lease gap), never on a transient
// re-presented-id reconnect (which self-heals). Process-lifetime in-memory flag.
let adapterStatusNoticeSent = false;

// PENDING-LATCH for the fresh-process notice. The notice must fire only AFTER the
// MCP handshake completes (`notifications/initialized` from Claude Code), or the
// push is silently dropped — Claude Code hasn't subscribed to the channel yet.
// `mcp.connect()` resolves BEFORE that handshake; the correct hook is the Server's
// `oninitialized` callback (fires once per fresh process when the client sends
// `notifications/initialized`). But the hub `welcome` (which sets freshlyMinted)
// and `oninitialized` are INDEPENDENT events with NO guaranteed order, so we latch:
// whichever happens SECOND triggers the send. `freshProcessNoticePending` is set by
// a freshly-minted welcome; `mcpInitialized` is set by oninitialized. maybeFire
// sends iff BOTH hold and we haven't sent yet.
let freshProcessNoticePending = false;
let mcpInitialized = false;

// The full wording of the one-shot adapter-status notice. Stated once so the
// pre-flight/poll machinery below can reference it. Informational only: it states
// the fact of the unestablished link and that any group-chat tool call re-establishes
// it; it does not command the model to do anything.
const ADAPTER_STATUS_TEXT =
  "The group-chat adapter (re)started and has not yet re-established its " +
  "link with the hub for this session. Incoming <channel> messages will " +
  "not be delivered until the link is re-established, which happens " +
  "automatically the next time you use any group-chat tool (e.g. listing " +
  "groups, sending a message, or checking message history). Until then " +
  "you may be missing messages; any queued ones are delivered in full " +
  "once the link is re-established.";

// Maybe fire the fresh-process adapter-status notice. Gated (as before) on BOTH the
// MCP handshake completing (mcpInitialized) AND a fresh-process welcome arming the
// pending flag (freshProcessNoticePending) — regardless of which event arrived
// first. A non-fresh reconnect never arms the pending flag, so this stays a no-op for
// transient drops. Idempotent via adapterStatusNoticeSent.
//
// THE REAL DESIGN (replaces the prior unconditional delay probe — see
// docs/group-chat-reconnect-notice.md): a fresh process is INDISTINGUISHABLE from a
// first launch at this point (both mint a fresh adapter_id), so firing
// unconditionally bugs a brand-new unrelated session that never used the feature.
// Instead we PRE-FLIGHT the hub: does this session id (env CLAUDE_CODE_SESSION_ID,
// trustworthy on a fresh respawn) have a durable `sessions` row — i.e. did it ever
// engage group-chat? Only if engaged do we run the poll-until-acked loop. A
// first-launch session has no row → we return silently.
function maybeFireAdapterNotice(): void {
  dbg("maybeFireAdapterNotice:enter", {
    mcpInitialized,
    freshProcessNoticePending,
    adapterStatusNoticeSent,
  });
  if (!mcpInitialized || !freshProcessNoticePending || adapterStatusNoticeSent) {
    dbg("maybeFireAdapterNotice:skip");
    return;
  }
  adapterStatusNoticeSent = true; // latch closed: at most one attempt per process.
  dbg("maybeFireAdapterNotice:firing");
  // Fire-and-forget the async pre-flight + poll loop. Never let it crash the adapter:
  // the notice never gates correctness.
  void runReconnectNotice().catch((err) => {
    dbg("runReconnectNotice:threw", { err: String(err) });
  });
}

// The current Claude Code session id, from the adapter's env. On a MANUAL Reconnect
// (a fresh respawn) this equals the live session — the one assumption this whole path
// rests on (see the doc, constraint 1). Empty if unset (an environment we can't
// pre-flight): we then stay silent.
function currentSessionId(): string {
  const v = process.env.CLAUDE_CODE_SESSION_ID;
  return typeof v === "string" && v && !v.startsWith("${") ? v : "";
}

// The ~/.claude/projects dir that holds the per-session transcript jsonl files.
function claudeProjectsDir(): string {
  const home = process.env.HOME || homedir();
  return pathJoin(home, ".claude", "projects");
}

// Derive the transcript path for a session id: ~/.claude/projects/<slug>/<id>.jsonl
// where <slug> = CLAUDE_PROJECT_DIR with every '/' replaced by '-'. VERIFIED (the
// doc) the derived slug matches the real on-disk directory. Returns null if we can't
// build the slug (CLAUDE_PROJECT_DIR unset/placeholder) — the caller then falls back
// to globbing the projects dir.
function deriveTranscriptPath(sessionId: string): string | null {
  const projectDir = process.env.CLAUDE_PROJECT_DIR;
  if (!projectDir || projectDir.startsWith("${")) return null;
  const slug = projectDir.replace(/\//g, "-");
  return pathJoin(claudeProjectsDir(), slug, `${sessionId}.jsonl`);
}

// Scan a transcript jsonl for OUR delivered notice: a record carrying `corrId` in one
// of the TWO shapes a surfaced channel event takes in the transcript. This is the ack
// that our push actually landed; we match on the corr_id so we confirm OUR notice, not
// a stale earlier one.
//
// CRITICAL — there are two record shapes, written at DIFFERENT times (proven live, the
// runaway-spam bug 2026-06-28):
//   1. `type:"queue-operation"`, `operation:"enqueue"` — written at DELIVERY time, the
//      instant the event is queued into the session. `origin` is NULL on this record.
//   2. `type:"user"` with `origin.kind === "channel"` — written only when the queued
//      event is CONSUMED INTO A TURN, which can be minutes after delivery (events queue
//      and surface on the next turn).
// The original code matched ONLY shape (2). Between delivery and the next turn, shape
// (2) doesn't exist yet, so the poll never acked and re-pushed the SAME notice up to
// the cap — flooding the session with identical notices. We now accept EITHER shape:
// the enqueue record is the true delivery-time signal (acks fast, stops the re-push),
// and origin.kind=="channel" still counts (a turn already consumed it).
//
// We read the WHOLE file each scan rather than tail forward from a cursor (the
// drainDmReads trick). A deliberate tradeoff, not an oversight: this loop is capped,
// transcripts are small, and a from-head read is robust to the glob fallback handing us
// a DIFFERENT file each iteration (a cursor is per-path state the fallback can't share).
// We test the raw line for the corr_id substring first (cheap), then confirm shape.
// Returns true on a match, false otherwise (missing file included).
function transcriptHasNotice(path: string, corrId: string): boolean {
  const textData = readFileFully(path);
  if (textData === null) return false;
  for (const line of textData.split("\n")) {
    if (!line.includes(corrId)) continue; // cheap pre-filter on the raw line
    try {
      const rec = JSON.parse(line) as {
        type?: string;
        operation?: string;
        origin?: { kind?: string };
      };
      // shape (2): turn-consumed channel record
      if (rec.origin?.kind === "channel") return true;
      // shape (1): delivery-time enqueue record (origin is null here)
      if (rec.type === "queue-operation" && rec.operation === "enqueue") return true;
    } catch {
      /* skip malformed/partial line */
    }
  }
  return false;
}

// Read a whole file to a string with the same open/fstat/read/close fd ceremony
// drainDmReads uses (one place owns the low-level read shape). Returns null on a
// missing/empty/unreadable file so callers fold all "nothing to scan" cases into one
// branch. Unlike drainDmReads this is stateless (no cursor) — see transcriptHasNotice
// for why a from-head read is the right shape there.
function readFileFully(path: string): string | null {
  let fd: number;
  try {
    if (!existsSync(path)) return null;
    fd = openSync(path, "r");
  } catch {
    return null;
  }
  try {
    const size = fstatSync(fd).size;
    if (size <= 0) return null;
    const buf = Buffer.allocUnsafe(size);
    const n = readSync(fd, buf, 0, size, 0);
    return buf.toString("utf8", 0, n);
  } catch {
    return null;
  } finally {
    closeSync(fd);
  }
}

// Reconnect-notice delivery: PRE-FLIGHT the hub for engagement, then (only if engaged)
// POLL-UNTIL-ACKED. The poll re-pushes the notice every 250ms and scans the session's
// transcript for our corr_id, stopping on the first match (the harness wrote our
// notice → it surfaced). This defeats the proven subscription race (oninitialized is
// necessary but not sufficient — see the doc) without a fixed-delay guess: we keep
// re-pushing until the transcript proves landing.
//
// The cap is the BLAST RADIUS if detection ever fails: every un-acked attempt surfaces
// ANOTHER copy of the notice. A too-high cap once flooded the session with ~13 spammed
// notices before it was caught (the origin.kind-only match bug, since fixed in
// transcriptHasNotice). So the cap is deliberately LOW: ~10 attempts / ~2.5s. The
// healthy path acks at attempt 1, so a low cap costs nothing normally; it only bounds
// the damage if a new detection edge-case slips through. After the cap, give up quietly
// (one dbg line, no crash, no stderr spam).
const RECONNECT_NOTICE_INTERVAL_MS = 250;
const RECONNECT_NOTICE_MAX_ATTEMPTS = 10; // ~2.5s at 250ms — kept low to bound spam

async function runReconnectNotice(): Promise<void> {
  const sessionId = currentSessionId();
  dbg("runReconnectNotice:enter", { sessionId });
  if (!sessionId) {
    // No env session id (can't pre-flight, can't watch a transcript). Stay silent.
    dbg("runReconnectNotice:no-session-id");
    return;
  }

  // 1) PRE-FLIGHT: has this session id ever engaged group-chat (a durable `sessions`
  //    row, MAIN key)? If NOT engaged -> do nothing (constraint 2: never nudge a
  //    session that never used the feature — a first launch has no row).
  let engaged = false;
  try {
    const reply = expect(
      await request({ t: "session_engaged", session_id: sessionId }),
      "session_engaged",
    );
    engaged = reply.engaged;
  } catch (err) {
    // The pre-flight failed (hub down / timeout). Fail SILENT: we can't prove
    // engagement, and a wrong nudge into an unengaged session is the worse error.
    dbg("runReconnectNotice:preflight-failed", { err: String(err) });
    return;
  }
  dbg("runReconnectNotice:preflight", { engaged });
  if (!engaged) return;

  // 2) ENGAGED -> POLL-UNTIL-ACKED. Stamp a unique corr_id (meta key chars are
  //    [A-Za-z0-9_]; "corr_id" is fine) so we confirm OUR notice landed.
  const corrId = randomUUID();
  // Prefer the derived path (session id is known); fall back to globbing the projects
  // dir and matching purely on corr_id content (path-independent) if it's absent.
  const derivedPath = deriveTranscriptPath(sessionId);
  dbg("runReconnectNotice:poll-start", { corrId, derivedPath });

  for (let attempt = 1; attempt <= RECONNECT_NOTICE_MAX_ATTEMPTS; attempt++) {
    try {
      await pushAdapterStatus(ADAPTER_STATUS_TEXT, corrId);
    } catch (err) {
      // A push failure is non-fatal: the next attempt re-pushes. Don't spam stderr.
      dbg("runReconnectNotice:push-failed", { attempt, err: String(err) });
    }
    await new Promise((r) => setTimeout(r, RECONNECT_NOTICE_INTERVAL_MS));

    // Look for our notice landing in the transcript. Try the derived path first; if
    // it doesn't exist (or we couldn't derive one), glob *.jsonl under the projects
    // dir and match on corr_id content alone.
    let landed = false;
    if (derivedPath && transcriptHasNotice(derivedPath, corrId)) {
      landed = true;
    } else {
      for (const candidate of globTranscripts()) {
        if (transcriptHasNotice(candidate, corrId)) {
          landed = true;
          break;
        }
      }
    }
    if (landed) {
      dbg("runReconnectNotice:acked", { attempt });
      return; // STOP on match.
    }
  }
  // Cap reached: give up quietly (one dbg line, no crash, no stderr spam).
  dbg("runReconnectNotice:gave-up", { attempts: RECONNECT_NOTICE_MAX_ATTEMPTS });
}

// Glob *.jsonl under ~/.claude/projects/*/ — the fallback transcript source when the
// derived path is absent. Matched purely on corr_id content, so a wrong-directory
// scan is harmless (no corr_id, no match). Best-effort; returns [] on any error.
function globTranscripts(): string[] {
  const base = claudeProjectsDir();
  const out: string[] = [];
  try {
    if (!existsSync(base)) return out;
    for (const dirent of readdirSync(base, { withFileTypes: true })) {
      if (!dirent.isDirectory()) continue;
      const dir = pathJoin(base, dirent.name);
      try {
        for (const f of readdirSync(dir)) {
          if (f.endsWith(".jsonl")) out.push(pathJoin(dir, f));
        }
      } catch {
        /* unreadable subdir — skip */
      }
    }
  } catch {
    /* projects dir unreadable — return what we have */
  }
  return out;
}

// DELIVERY GATE state: the identities this adapter knows it currently serves. An
// adapter socket may relay for several identities (the main session plus live
// subagents, all sharing the socket), but a <channel> notification surfaces into
// THE main Claude session only. The gate drops any push whose stamped target
// identity is KNOWN-FOREIGN (in nothing this adapter serves) so a push meant for a
// subagent — or a superseded resume — is never surfaced into the wrong session.
// Learned from whoami replies (the adapter's own identity); fail-open while empty
// so a correctly-routed push is never dropped just because we haven't learned yet.
const servedIdentities = new Set<string>();

// Should a push stamped for `targetIdentity` be surfaced? Drop only when we KNOW
// our served set and the target isn't in it (fail-open while we know nothing).
function gateAllows(targetIdentity: string | undefined): boolean {
  if (!targetIdentity) return true; // unstamped (shouldn't happen post-v6) — surface
  if (servedIdentities.size === 0) return true; // haven't learned our identity yet
  return servedIdentities.has(targetIdentity);
}

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
    // Echo the held adapter_id only if we have one (reconnect); omit it on first
    // connect so the hub mints a fresh one and hands it back in `welcome`.
    sendRaw({
      t: "hello",
      token: HUB_TOKEN,
      protocol: PROTOCOL_VERSION,
      host: SELF_HOST,
      ...(adapterId ? { adapter_id: adapterId } : {}),
    });
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

// The adapter tracks NO membership state of its own. The hub is the source of
// truth for group membership (durable identity-owned handles): it does not pick a
// handle for leave/submit_message (those carry no handle — the hub resolves the
// caller's identity to its one handle in the group), and it does not replay joins
// on reconnect. Reconnect re-attach is the hub's job, keyed by `adapterId` (above).

// Read a --flag value from argv (guard against un-interpolated placeholders).
function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i >= 0 && i + 1 < process.argv.length) {
    const v = process.argv[i + 1];
    if (v && !v.startsWith("${")) return v;
  }
  return undefined;
}

// The plugin's persistent data dir — used only to locate the DM read-signal file
// the display hook writes (group membership no longer comes from here; the hub
// owns it). --plugin-data arg → CLAUDE_PLUGIN_DATA env → inferred well-known dir.
function pluginDataDir(): string {
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

function onFrame(frame: ServerFrame): void {
  if (frame.t === "welcome") {
    helloDone = true;
    dbg("welcome", {
      frameAdapterId: frame.adapter_id ?? null,
      heldAdapterId: adapterId,
      freshProcess: !!(frame.adapter_id && !adapterId),
    });
    // Store the hub-minted relay id on the FIRST welcome that carries one. The
    // `!adapterId` guard enforces the contract "never overwrite the held id": on a
    // reconnect we already hold it and the hub echoes the same one back, so the
    // store is skipped — the held id is the stable identity for this process.
    //
    // FRESH-PROCESS detection: a welcome that carries an adapter_id WHILE we held
    // none is a freshly-minted relay id — i.e. this process connected without a
    // prior id to re-present (a first connect, or a /reload-plugins respawn, which
    // are indistinguishable from the adapter's view). In that case the hub could
    // NOT auto-rebind the prior session lease (it's orphaned), so group push stays
    // dark until the next tool call's PreToolUse map_session re-binds the session.
    // A transient socket drop does NOT hit this branch (we still held the id and
    // re-presented it, so `!adapterId` is false) — that path self-heals, no notice.
    // Emit ONE informational status notice so the model knows a tool call is what
    // re-establishes delivery. We do NOT send it inline here: the MCP handshake may
    // not be complete yet (Claude Code hasn't subscribed to the channel), so the
    // push would be silently dropped. Instead ARM the latch and let
    // maybeFireAdapterNotice() send it once the handshake's `oninitialized` has also
    // fired — whichever of the two events lands second triggers the send.
    if (frame.adapter_id && !adapterId) {
      adapterId = frame.adapter_id;
      freshProcessNoticePending = true;
      maybeFireAdapterNotice();
    }
    return;
  }

  if (frame.t === "message") {
    const { group, seq } = frame.msg;
    // DELIVERY GATE: drop a push stamped for an identity this adapter doesn't serve
    // (a subagent's, or a superseded resume's) rather than surface it into the wrong
    // session. Still ack so the hub's gap bookkeeping stays consistent.
    sendRaw({ t: "ack", group, seq });
    if (!gateAllows(frame.to_identity)) return;
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
    // DELIVERY GATE: drop a DM whose target identity this adapter doesn't serve.
    if (!gateAllows(dm.to_identity)) return;
    // DM RECEIVED: ack arrival immediately (state sent -> received). The `read`
    // receipt is sent later by the display hook's signal (see drainDmReads),
    // when the assistant actually surfaces the DM — that's the honest read. We
    // assert `dm.to_identity` (the recipient identity) so a multi-session socket
    // attributes the ack to the right recipient (the hub keys the DM thread off it).
    sendRaw({ t: "dm_ack", from_identity: dm.from_identity, seq: dm.seq, session: dm.to_identity });
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
        // a reply marks the seq it replies to (only present on replies)
        ...(msg.reply_to != null ? { reply_to: String(msg.reply_to) } : {}),
        // push-targeting: the member names this was directed to (only on to:-targeted
        // messages). Comma-joined; the display hook renders it as a "→ to: …" marker.
        ...(msg.to && msg.to.length ? { to: msg.to.join(",") } : {}),
        // DERIVED author role (only stamped when present). The display hook renders a
        // visible marker for role="human" so a person talking in the room is legible.
        ...(msg.role ? { role: msg.role } : {}),
      },
    },
  });
}

// Push a LOCAL adapter-status notice into the session as a <channel> event. This
// is NOT a peer chat message and NOT a hub-delivered frame — it originates in the
// adapter itself to inform the model of its own link state. It reuses the same
// `notifications/claude/channel` injection path as pushChannel for consistency,
// but carries a distinct `notice="adapter-status"` meta attribute (and no group/
// from/seq fields) so it can never be mistaken for peer chatter: the display hook
// only banners events with a finite `seq` (group msgs) or `dm="1"` (DMs), so this
// notice carries neither and is left untouched by the hook — its content surfaces
// plainly to the model as adapter status. Informational only: it states the fact
// of the unestablished link and that any group-chat tool call re-establishes it;
// it does not command the model to do anything.
//
// `corrId` is a unique correlation token stamped into the meta (and thus the
// serialized <channel> content) so the poll-until-acked loop can detect THIS push's
// own delivery in the session transcript — see runReconnectNotice. The meta key
// "corr_id" is [A-Za-z0-9_], as the channels spec requires.
async function pushAdapterStatus(text: string, corrId?: string): Promise<void> {
  dbg("pushAdapterStatus:before-notification", { corrId });
  await mcp.notification({
    method: "notifications/claude/channel",
    params: {
      content: text,
      meta: {
        notice: "adapter-status",
        role: "system",
        ts: new Date().toISOString(),
        ...(corrId ? { corr_id: corrId } : {}),
      },
    },
  });
  dbg("pushAdapterStatus:after-notification", { corrId });
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
        from_identity: dm.from_identity,
        to_identity: dm.to_identity,
        from_alias: dm.from_alias,
        to_alias: dm.to_alias,
        ts: dm.ts,
        msg_id: dm.msg_id,
        seq: String(dm.seq),
        // DERIVED sender role (only when present) — a human's DM is a human talking.
        ...(dm.role ? { role: dm.role } : {}),
      },
    },
  });
}

// DM read-receipt coordination. The display hook is a separate process; when it
// surfaces a DM to the assistant it appends a line to dm-reads.jsonl in the
// plugin-data dir — `{from_identity, seq, to_identity}`. We tail that file forward (same
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
          from_identity?: string;
          seq?: number;
          to_identity?: string;
        };
        if (typeof e.from_identity === "string" && typeof e.seq === "number") {
          // assert the recipient identity (to_identity) so the hub attributes the
          // read to the right account on a multi-session socket.
          sendRaw({
            t: "dm_read",
            from_identity: e.from_identity,
            seq: e.seq,
            ...(e.to_identity ? { session: e.to_identity } : {}),
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
      "a list of member names to restrict the live PUSH to those members (the " +
      "message is still logged to history for everyone — push-targeting, not " +
      "privacy). Naming a non-member errors the whole send. Optional `reply_to` is " +
      "the seq of a prior message in this group: the reply is logged for everyone " +
      "but live-pushed ONLY to that message's author (if the author left the group, " +
      "it is logged and you are told where to reach them). For a private message " +
      "use direct_message instead.",
    inputSchema: {
      type: "object",
      properties: {
        group: { type: "string" },
        message: { type: "string" },
        to: {
          type: "array",
          items: { type: "string" },
          description: "Member names to push to (others still get it in history). Omit = whole group.",
        },
        reply_to: {
          type: "number",
          description: "Seq of a message in this group to reply to (pushes only to its author).",
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
      "errors. You always also have your default alias <identity-id>@<host>.",
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
    description: "Show your identity id, host, and all your aliases.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "resolve_alias",
    description:
      "Resolve an address to the identity it points at, and whether that identity " +
      "is currently online. Address forms: <identity-id>@<host> (default alias), " +
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
      "List every known identity with its aliases, group memberships, and " +
      "online/offline status. (Stale entries accumulate over time — pruning is a " +
      "separate concern.)",
    inputSchema: { type: "object", properties: {} },
  },
  // ---- direct messages ----
  {
    name: "direct_message",
    description:
      "Send a DIRECT message to one recipient by address — independent of any " +
      "group. `to` is any address form (default alias <identity-id>@<host>, a " +
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
      "Read your DM thread with one peer (given as any address, or a raw identity " +
      "id). Newest last; each message shows its sent/received/read state and the " +
      "from/to aliases used.",
    inputSchema: {
      type: "object",
      properties: {
        peer: { type: "string", description: "The peer's address or identity id" },
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

mcp.setRequestHandler(CallToolRequestSchema, async (req, extra) => {
  const name = req.params.name;
  const a = (req.params.arguments ?? {}) as Record<string, unknown>;

  // Read the call's bare tool_use_id from _meta. We do NOT resolve a session from
  // it — that's the HUB's job (it correlates the id to the real session via the
  // PreToolUse hook). We forward it on EVERY hub frame that needs an identity: ALL
  // group tools (the hub resolves the caller's handle in the group) AND the
  // account tools. If the hub can't resolve the id in time it returns an honest
  // no_session error, surfaced through `expect`.
  const toolUseId =
    ((extra as any)?._meta?.["claudecode/toolUseId"] ??
      (req.params as any)?._meta?.["claudecode/toolUseId"]) as string | undefined;

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
        return text(
          `Joined '${r.group}' as '${r.as}'.\n` +
            `Your unique, globally identifiable group address: ${r.as}@${r.group}._group\n` +
            `Messages will arrive as <channel> events.`,
        );
      }
      case "leave": {
        const group = String(a.group);
        // No handle on the wire: the hub resolves the caller's identity to its one
        // handle in the group and drops it. Just forward group + tool_use_id.
        await request({ t: "leave", group }, toolUseId);
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
        // Optional `reply_to`: the seq of a message to reply to. The hub pushes the
        // reply only to that message's author and warns if they've left.
        const replyTo =
          a.reply_to !== undefined && a.reply_to !== null ? Number(a.reply_to) : undefined;
        // No handle on the wire: the hub resolves the caller's identity (from the
        // tool_use_id) to its handle in the group and sends AS it. If the identity
        // owns no handle in the group, the hub returns a "join first" error.
        // The hub replies with read-receipts: who confirmed surfacing the message
        // within the read window (read) vs the rest of the group (sent — offline or
        // slower than the window).
        const r = expect(
          await request(
            {
              t: "send",
              group,
              message,
              ...(to ? { to } : {}),
              ...(replyTo !== undefined ? { reply_to: replyTo } : {}),
            },
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
          r.read.length === 0 && r.sent.length === 0 && !r.warning
            ? " No other members in the group."
            : "";
        const replyLine = replyTo !== undefined ? ` (reply to seq ${replyTo})` : "";
        const warnPart = r.warning ? `\nNote: ${r.warning}` : "";
        return text(
          `Sent to '${group}' (seq ${r.seq})${replyLine}. ${readPart}${sentPart}${noOthers}${warnPart}`,
        );
      }
      case "list_members": {
        const group = String(a.group);
        const r = expect(await request({ t: "list_members", group }, toolUseId), "members");
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
        const r = expect(await request({ t: "show_member", group, member }, toolUseId), "member");
        if (!r.member) return text(`No member '${member}' in '${group}'.`);
        const m = r.member;
        // No separate last-seen is tracked under the unified-handles model (it
        // would equal joined_ts), so we don't render a misleading "last seen".
        return text(
          `${m.name} in '${group}': ${m.attached ? "attached" : "detached"}, ` +
            `joined ${m.joined_ts}`,
        );
      }
      case "list_group_messages": {
        const group = String(a.group);
        const last_n = a.last_n === undefined ? 20 : Number(a.last_n);
        const index_from_end = a.index_from_end === undefined ? 0 : Number(a.index_from_end);
        const r = expect(
          await request({ t: "history", group, last_n, index_from_end }, toolUseId),
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
        // Learn our own identity for the delivery gate (so we drop pushes meant for
        // other identities — e.g. subagents — that share this socket).
        if (r.identity_id) servedIdentities.add(r.identity_id);
        return text(
          `identity: ${r.identity_id}\nhost: ${r.host}\naliases:\n` +
            r.aliases.map((x) => `  ${x}`).join("\n"),
        );
      }
      case "resolve_alias": {
        const address = String(a.address);
        const r = expect(await request({ t: "resolve_alias", address }, toolUseId), "resolved");
        if (!r.identity_id) return text(`'${address}' does not resolve to any known identity.`);
        return text(
          `'${address}' -> identity ${r.identity_id} (${r.online ? "online" : "offline"}).`,
        );
      }
      case "list_directory": {
        const r = expect(await request({ t: "list_directory" }, toolUseId), "directory");
        if (r.entries.length === 0) return text("Directory is empty.");
        return text(
          "Directory:\n" +
            r.entries
              .map((e) => {
                // aliases[0] is the default alias `<id>@<host>` (already shown in the
                // heading); list only the REGISTERED aliases after it.
                const registered = e.aliases.slice(1);
                const aliases = registered.length ? registered.join(", ") : "(default only)";
                const groupsPart = e.groups.length ? ` groups: ${e.groups.join(", ")}` : "";
                return `  ${e.identity_id}@${e.host} [${e.online ? "online" : "offline"}] aliases: ${aliases}${groupsPart}`;
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

// Connect the MCP stdio transport FIRST, then open the WS. Keeps the transport
// live before any WS activity (the prior transport-ordering fix). The fresh-process
// adapter-status notice no longer fires inline from `welcome`: that moment is too
// early — the MCP handshake may be incomplete, so Claude Code hasn't subscribed to
// the channel and the push would be silently dropped. Instead the notice fires from
// the oninitialized-gated latch (maybeFireAdapterNotice). Safe ordering: the WS path
// is fully event-driven and self-reconnecting, and tool calls gate on hub-link
// readiness independently (request() -> waitReady()), so MCP-before-WS cannot race a
// tool call.
//
// Assign `oninitialized` BEFORE connect() so it can't miss the client's
// `notifications/initialized`. It fires once per fresh process when the MCP
// handshake completes — the earliest reliable moment Claude Code has subscribed to
// the channel — and arms the second half of the fresh-process-notice latch.
mcp.oninitialized = () => {
  dbg("oninitialized");
  mcpInitialized = true;
  maybeFireAdapterNotice();
};
dbg("boot:before-mcp-connect", { debugLogPath: DEBUG_LOG_PATH });
await mcp.connect(new StdioServerTransport());
dbg("boot:after-mcp-connect");
connect();
watchDmReads(); // tail the display hook's DM read-signal file and emit dm_read
