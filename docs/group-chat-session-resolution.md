# Group-chat: hub-correlated session resolution (PreToolUse → hub)

## Problem

A stdio MCP server cannot learn the REAL Claude Code session id of a tool call:
- env `CLAUDE_CODE_SESSION_ID` is a phantom boot/wrapper id (PROVEN live: the
  adapter's env id `633846f0…` has no transcript; the real session is `ea322652…`).
- The MCP `initialize` handshake carries no session id; `_meta` carries only
  `claudecode/toolUseId`; `extra.sessionId` is undefined for stdio; `Mcp-Session-Id`
  is HTTP-only. (PROVEN via docs + live probe — there is NO supported per-call
  session id for stdio MCP.)

The previous design had the adapter resolve the session by **scanning the
transcript** for the call's `toolUseId` (basename of the containing `.jsonl` = the
session id). This is structurally broken for the case that matters:

- **Self-referential flush race (PROVEN):** the current call's `tool_use` line is
  written to the transcript only AFTER the call returns — but the call can't return
  until it resolves. So a fresh adapter (empty cache) can never resolve; retrying
  is futile (each retry is a new id with the same race).
- It also had a **cursor-inflation bug** (`scanFileForward` counted `slice(0,nl+1)`
  instead of `slice(from,nl+1)`, inflating the per-file cursor ~hundreds× → later
  scans short-circuit). Fixed in commit `7c8fc39`, but the whole approach is being
  replaced, so this code is being **deleted**.

## Decision: the hub correlates, via a PreToolUse hook

Invert it. The `PreToolUse` hook fires BEFORE each tool call and authoritatively
receives the REAL `session_id` + the `tool_use_id` on stdin (PROVEN live: the hook
saw `session_id=ea322652…` — the real session, NOT the phantom — and
`tool_use_id=toolu_0123f1…`, the same id the adapter receives in
`_meta["claudecode/toolUseId"]`; same id confirmed in the transcript). So:

- **The hook sends `(tool_use_id, session_id)` straight to the HUB** (not to the
  adapter, not via a file). It opens a transient authenticated hub connection
  (`hello` + token from `GROUP_CHAT_URL`), sends one `map_session` frame, closes.
- **The adapter becomes a dumb pipe for identity:** it attaches the bare
  `_meta.toolUseId` to each frame and does NO session resolution. All of
  `resolveSessionId`, `scanFileForward`, the per-file scan cursor, the
  transcript-scan path of `ensureSessionState`, and the SESSIONLESS bucket are
  **removed from the adapter**.
- **The hub correlates:** it keeps `Map<tool_use_id, session_id>`. On a frame
  carrying a `tool_use_id`, it resolves the session from the map and binds the
  account exactly as `bindSession` does today.

### The ordering race → a promise rendezvous (no polling, no files)

The hook→hub registration and the adapter→hub frame travel on **separate
connections**, so "hook fires first" does not guarantee "registration arrives
first." Handle it with a completable:

- Hub holds `Map<tool_use_id, session_id>` (resolved) AND `Map<tool_use_id,
  Promise>` (pending).
- On a frame with `tool_use_id`:
  - if mapped → resolve immediately;
  - else → `await` a promise keyed by that `tool_use_id`; the `map_session`
    registration resolves it and frame processing resumes cleanly.
- **Timeout** the await (bounded, e.g. `SESSION_MAP_WAIT_MS`). On timeout: identity
  /DM tools return an **honest error** ("could not resolve your session"); group
  tools that don't need a session **proceed without one** (unchanged group
  behavior). No transcript-scan fallback — the scan code is gone.

### Why not the alternatives (rejected)

- **Adapter reads a local mapping file the hook writes.** Rejected: clutters the FS
  and writes bytes to disk for ephemeral per-call data; keeps resolution logic in
  the adapter. The hub-correlation path keeps the adapter dumb and the data
  in-memory.
- **Transcript scan (the old design), even as a fallback.** Rejected: it's the
  source of the self-referential race and the cursor bug; keeping it as a fallback
  would retain all the machinery we're trying to delete. Honest error on
  map-timeout instead.
- **Adapter resolves via the env / `initialize` / `_meta` session id.** Impossible
  — none of these carry the real session id for stdio (PROVEN).
- **Hook delivers via a lighter no-handshake frame.** Rejected in favor of the full
  `hello`+token handshake for consistency with the adapter and a single trust path
  on the hub. (Per-call handshake overhead is acceptable; the hook is already a
  short-lived process.)

### Security / trust

Not a security concern beyond DoS (out of scope). The `tool_use_id` is
cryptographically unguessable within the window that matters, so a racing attacker
cannot pre-register someone else's `tool_use_id → session` binding over the
network. The hub accepts a `map_session` only over an authenticated (token)
connection.

## Wire protocol additions

- **adapter → hub**: frames already carry `_meta.toolUseId`? No — add it: the
  adapter attaches `tool_use_id` (from `_meta`) to each `ClientEnvelope` instead of
  the `session` field it used to attach after resolving. The `session` field is NOT
  removed from the protocol: it is retained as an optional direct-assertion path
  used by push-response frames the adapter still sends (`dm_ack`, `dm_read`, which
  carry the recipient session verbatim) and by trusted in-process drivers/tests; the
  hub binds it verbatim when present. The real adapter just no longer sends `session`
  on MCP tool-call frames — it sends `tool_use_id` and lets the hub resolve.
- **hook → hub**: `{ t: "map_session", tool_use_id: string, session_id: string }`
  (sent after `hello`/`welcome`).
- The hub binds the connection's account from the resolved session (as
  `bindSession` does now), keyed off the frame's `tool_use_id` via the map.

## Lifecycle / cleanup

- Map entries are per-call; prune on a TTL or LRU bound (a `tool_use_id` is used at
  most a few times — the call's frames). Avoid unbounded growth.
- Hub restart loses the in-memory map; in-flight calls then honest-error and the
  next call (with a fresh hook registration) works. Consistent with "no durable
  per-call state."

## Affected existing docs (update to point here)

- `group-chat-durable-membership.md` — its Half-2 "adapter resolves identity via
  toolUseId→transcript scan" is SUPERSEDED; the adapter no longer resolves identity.
  Keep the durable-membership model; replace the resolution mechanism with a pointer
  to this doc.
- `group-chat-direct-messages.md` — its "per-call session resolution reuses the
  toolUseId→transcript mechanism" lines are SUPERSEDED; identity now comes from the
  hub's PreToolUse correlation.
