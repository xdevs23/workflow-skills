# Group-chat adapter: reconnect-notice delivery

## Problem

When the group-chat adapter respawns as a **fresh process** (a `/plugin` → Reconnect,
or a first launch), its hub link for the session must be re-established. Until the
next group-chat tool call re-binds the session (via the PreToolUse `map_session`
path), incoming `<channel>` messages are not delivered. The feature: surface a
one-shot **adapter-status notice** into the session so the model knows its link is
dark and a tool call re-establishes it.

The notice is pushed as a `notifications/claude/channel` event from the adapter,
exactly like a peer message, but carrying `notice="adapter-status"` meta instead of
group/from/seq.

## Root cause of the long-standing failure (PROVEN, 2026-06-28)

The notice **never surfaced** across four prior fix cycles. The cause was a **timing
race**, not meta-shape and not idle-drop:

- `server.oninitialized` (fires on the client's `notifications/initialized`) is
  necessary but **NOT sufficient**: Claude Code finishes wiring up the
  `notifications/claude/channel` listener some non-deterministic time **after** the
  MCP `initialized` handshake. A push in that gap hits the documented
  "session hasn't loaded your server as a channel yet" silent-drop.
- **Proof** (adapter debug log, two back-to-back reconnects, same code, only the
  delay differs):
  - No delay: `oninitialized @ T → push @ T → resolved @ T`. Notice NEVER appeared.
  - 5000ms delay: `oninitialized @ T → … → push @ T+5s → resolved`. Notice APPEARED,
    surfaced unprompted in-session, `ts` == the delayed-push time.

Authoritative spec (https://code.claude.com/docs/en/channels-reference): only
`content` is required; `meta` has no required keys (keys must be `[A-Za-z0-9_]`);
`await mcp.notification()` resolves on transport-write, NOT delivery; the only
documented drop causes are channel-not-loaded(-yet) and org-policy-off.

## Hard constraints (set by the human, non-negotiable)

1. **Session id is unknowable in general.** The adapter is process-persistent for
   the whole Claude Code lifetime and multiplexes many sessions (main + subagents,
   serially and concurrently). There is no single "my session." HOWEVER — on a
   **manual Reconnect**, the adapter is freshly respawned and its env
   `CLAUDE_CODE_SESSION_ID` DOES equal the current active session. **Verified live**
   (2026-06-28): adapter env id == the actively-written transcript jsonl == the live
   session's own id. We rely on this ONLY for the fresh-respawn path; the
   session-churn case (one adapter outliving a `/resume`) is explicitly stamped
   **not-implementable** and must not depend on the env id.

2. **Never nudge a session that never used group-chat.** Firing "your hub link needs
   re-establishing" into a session that has never touched the feature is wrong — it
   bugs an agent about a thing it isn't using. The nudge MUST be gated on prior
   engagement.

   **PROVEN harmful (2026-06-28, live):** with the unconditional probe, starting a
   FRESH Claude Code session in a fresh window (an unrelated project, halogenOS/XOS)
   fired the notice as the very first thing in the session, and the agent burned its
   entire first turn reasoning about an adapter-status notice it never asked for
   ("I'm ready — what would you like to work on?"). A first launch is, at the adapter
   level, INDISTINGUISHABLE from a Reconnect — both are a fresh process with a
   freshly-minted adapter_id, so the existing latch fires on both. The engagement
   gate (step 2 below) is precisely what separates them: a first-launch session has
   NO `sessions` row → silent; a Reconnect of a previously-engaged session HAS one →
   nudge. This is the core reason the gate is load-bearing, not cosmetic.

3. **No platform escape hatches exist** (verified from docs + @modelcontextprotocol/sdk):
   - No channel-ready event/callback after `oninitialized` (SDK Server exposes only
     `oninitialized`/`onclose`/`onerror`).
   - No delivery confirmation from the harness — the server is never told an event
     surfaced. (GitHub #61797 asks for this; closed not-planned.)

## Design (the one tractable path: manual Reconnect)

On fresh-process boot, after `oninitialized` AND a freshly-minted-adapter_id welcome
(the existing pending-latch — unchanged):

1. **Collect** `CLAUDE_CODE_SESSION_ID` from env (trustworthy on fresh respawn).
2. **Pre-flight the hub**: new request frame asking "has this session id ever bound
   an identity?" Answered from the hub's existing `sessions(session_key → identity_id)`
   table — a row exists iff the session made ≥1 group-chat tool call that resolved an
   identity. Check the MAIN key only (`session_key` with no `:` agent suffix).
   - **Engagement gate = "has a sessions row."** (Decision: simplest gate over
     existing state; a session that called even `whoami` once has engaged. Stricter
     "has group membership" was considered and rejected as unnecessary.)
3. **If not engaged → do nothing.** (Constraint 2.)
4. **If engaged → poll-until-acked.** We know the session id, so derive its
   transcript path and watch that ONE file:
   - Push the notice with a unique `corr_id` stamped in meta.
   - Wait 250ms; scan the known transcript jsonl for a record with
     `origin.kind == "channel"` whose content contains that `corr_id`.
   - If absent, resend; repeat every 250ms.
   - **Stop on match.** **Cap ~30s (~120 attempts)**, then give up quietly (no crash,
     no stderr spam beyond one debug line).

### Why the transcript is the ack source

A delivered channel event is written to the session transcript jsonl **at delivery
time, not turn time** — VERIFIED: the 19:11:58 notice's transcript record is
timestamped 19:11:58.449, ~20ms after the push, with no intervening user turn. Record
shape (real, from delivered data):
```
{"type":"user","message":{"role":"user","content":"<channel source=\"…\" notice=\"adapter-status\" …>…</channel>"},
 "isMeta":true,"origin":{"kind":"channel","server":"plugin:workflow-skills:group-chat"},
 "promptSource":"system","sessionId":"…","timestamp":"…"}
```
So the adapter can tail this file (it already has forward-tail jsonl machinery —
`drainDmReads`) and detect its OWN notice landing, turn-independently. The `corr_id`
is the match token so we confirm OUR notice, not a stale earlier one.

### Transcript path derivation

`~/.claude/projects/<slug>/<session-id>.jsonl` where `<slug>` = `CLAUDE_PROJECT_DIR`
with `/` → `-`. VERIFIED the derived slug matches the real directory. Fallback if the
derived path is absent: glob `*.jsonl` under the projects dir and match on `corr_id`
content (path-independent), but prefer the derived path since the session id is known.

## Rejected alternatives (and why)

- **Display-hook writes an ack signal file** (like dm-reads): REJECTED. The
  display-hook only runs on an assistant message render — the model might not respond
  for minutes, so the ack could lag arbitrarily. Not turn-independent.
- **Blind retransmit** (fire a few times unconditionally, no detection): REJECTED.
  Sends redundant pushes and never actually confirms landing; crude.
- **Fixed delay, tuned to a measured minimum**: REJECTED. The subscription lag is
  non-deterministic and hardware/load-dependent; any fixed value is a guess with no
  guarantee across machines.
- **Spray all hub-known sessions, hope it lands in the active one**: REJECTED unless
  proven a stray surface into an inactive/wrong session can't pollute it — which
  conflicts with Constraint 2. Kept only as a theoretical fallback, not implemented.
- **Meta-shape fixes (synthetic seq/group/from)**: REJECTED — proven irrelevant; the
  spec requires no meta keys, and shape was never the cause.

## Scope of change

- **Adapter** (`group-chat/adapter.ts`): replace the probe `setTimeout` delay with
  the pre-flight + poll-until-acked loop; add transcript-path derivation + a
  corr_id-matching tail; stamp `corr_id` in `pushAdapterStatus` meta.
- **Hub + protocol** (`servers/group-chat-hub/{hub,protocol}.ts`): new request/reply
  frame pair for the engagement pre-flight, answered from the `sessions` table
  (main-key query). Wire-protocol change → restart hub before reconnecting adapters.

## Not implemented (explicitly out of scope)

- Delivery to a session the adapter did NOT freshly respawn for (session churn /
  `/resume` reattach where env id ≠ active session). Stamped not-implementable per
  Constraint 1.
