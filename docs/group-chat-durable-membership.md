# Group-chat: durable membership + identity recovery

## Problem

Restarting the hub — or running `/reload-plugins`, or resuming a session the next
day — left members unable to send (`not_in_group`), even though the WebSocket
reconnected. Two distinct failures that looked identical:

1. **Hub restart.** The hub kept its member registry only in memory. On restart it
   forgot who was in every group. Adapters reconnected but the hub no longer knew
   them as members.
2. **`/reload-plugins` (or next-day resume).** This spawns a *fresh* adapter
   process whose in-memory `joinedGroups` map is empty. It reconnects but re-joins
   nothing, because only *Claude* knows it had joined — and Claude isn't prompted
   to re-issue `join`. So the first `submit_message` fails `not_in_group`.

Root cause: **membership was modeled as a property of a live connection.** When
either end's process restarted, the connection — and thus the "membership" — was
gone.

## Model (decided)

Membership works like Signal/WhatsApp: **durable and identity-based, not
connection-based.**

- You **join** a group once. You stay a member until you explicitly **leave**.
  Closing the laptop, restarting the hub, reloading the plugin, resuming tomorrow
  — none of these remove you.
- A **connection** is only a transient binding: "this socket is currently
  `<handle>` in `<group>`." When it drops, the binding clears but the membership
  persists.
- There is **no durable `offline` state.** You cannot know for certain whether an
  absent member is gone or just temporarily detached, so we don't pretend to. A
  member is simply a member; whether their socket is attached right now is
  incidental live info, not stored state.
- **No backfill on (re)attach** (decision B stands). A reconnecting member gets
  only live messages from then on; it calls `list_group_messages` to catch up on
  anything sent while detached.

## Two halves of the fix

### Half 1 — Hub: persist membership (fixes the hub-restart bug)

The hub persists each group's **member roster** (group + handle + joined_ts) to
disk, separately from the message log. On startup it reloads rosters, so a restart
preserves "who is in each group."

- `Member` loses the durable `status: "online"|"offline"` field. "Attached now" is
  derived live from `conn !== null`; it is never persisted.
- `join` becomes **idempotent re-attach**: if the handle is already a member of the
  group, binding a new connection to it is *re-attach*, not a new join and not a
  `name_taken` error. `name_taken` now only fires if a *different live connection*
  is currently attached as that handle (genuine concurrent claim).
- `leave` is the only thing that removes a member (and persists the removal).
- The per-member `delivered` cursor is reset to the group head on hub restart
  (consistent with no-backfill: a member detached across a hub restart gets only
  new messages; history via `list_group_messages`).
- Persistence file: `<DATA_DIR>/<group>.members.json` — `[{name, joined_ts}]`.
  Written on join/leave. The message log stays `<group>.jsonl` as today.

### Half 2 — Adapter identity recovery (fixes the reload / next-day bug)

A fresh adapter process has no memory of its handle, and — critically — **cannot
learn its own Claude Code session id** (see the constraint analysis below). So
recovery is **lazy** (on the first tool call, not at startup) and keyed off the
**per-call `toolUseId`**, which is the only deterministic per-session signal the
adapter actually receives.

Two components:

1. **SessionStart hook** (`group-chat/session-identity-hook.ts`) — UNCHANGED in
   role. Fires on `source: startup | resume | compact`, reads its
   `transcript_path` (which it reliably gets on stdin), computes the current
   `{group: handle}` map from the session's `join`/`leave` tool calls (multi-group;
   a later `leave` cancels its `join`), and writes it to
   **`$CLAUDE_PLUGIN_DATA/identity-<session_id>.json`**. The hook authoritatively
   knows `session_id`, so the file is correctly keyed.

2. **Adapter — lazy recovery on tool call.** When a group-scoped tool
   (`submit_message`, `list_members`, …) is called for a group the adapter is not
   joined to yet, it:
   a. reads `extra._meta["claudecode/toolUseId"]` from the call (Claude Code
      injects this on every tool call — verified);
   b. finds which transcript in the project's transcript dir contains that exact
      id (`rg -l --fixed-strings`); that file's name **is** the calling session's
      id. The toolUseId is globally unique and written into exactly the caller's
      transcript, so this is **deterministic, not a heuristic**;
   c. reads `identity-<that-session>.json`, takes the handle for the group, and
      `join`s (idempotent re-attach on the hub) before serving the call.
   If the toolUseId can't be correlated, it returns an honest error
   (`call join(group, as) explicitly`) — **no fallback guessing** (decided).

This needs only `${CLAUDE_PLUGIN_DATA}` and `${CLAUDE_PROJECT_DIR}` (both
substitutable in `.mcp.json` args) — never a session id passed to the adapter,
which isn't possible.

#### Constraint analysis: why the adapter can't know its session id (all verified)

Every channel was probed against real Claude Code, not assumed:

- **Env:** `CLAUDE_CODE_SESSION_ID` IS in the adapter's env, but in multi-session
  setups it's a *different* (parent/wrapper) session than the one the adapter
  serves — observed `b3d85d0c…` when the serving session was `ea322652…`. Unusable.
- **`.mcp.json` substitution:** only THREE variables substitute in MCP configs —
  `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}`, `${CLAUDE_PROJECT_DIR}` (docs +
  observed). There is no session-id variable. `${CLAUDE_CODE_SESSION_ID}` passed
  through **literally un-interpolated**. And interpolation does NOT happen inside
  the `env` block at all — only in `args`/`command`.
- **Tool call:** `extra.sessionId` is a plain data property holding `undefined`
  for stdio (verified: not a getter, not a promise — descriptor `hasValue:true`,
  typeof `undefined`). The only Claude-Code-injected datum is
  `_meta["claudecode/toolUseId"]` — which is exactly the unique key we use.

So the toolUseId→transcript correlation is the *only* deterministic path, and it
works because the act of calling the tool writes that id into the caller's
transcript.

#### Locating the plugin data dir from the adapter

The hook writes the identity file to `${CLAUDE_PLUGIN_DATA}` =
`~/.claude/plugins/data/<plugin>-<marketplace>/`. The adapter must read the SAME
dir. Trap (verified): a plugin MCP server does NOT inherit `CLAUDE_PLUGIN_DATA`,
and `.mcp.json` substitutes `${...}` in `args` but NOT inside the `env` block. So
we pass it as a CLI **arg** (where substitution works):

```json
"args": ["${CLAUDE_PLUGIN_ROOT}/group-chat/adapter.ts", "--plugin-data", "${CLAUDE_PLUGIN_DATA}"]
```

The adapter resolves the data dir most-trusted-first, rejecting any
un-interpolated `${...}` literal: `--plugin-data` arg → `CLAUDE_PLUGIN_DATA` env →
**inferred** `~/.claude/plugins/data/workflow-skills-workflow-skills` (from
`$HOME`; the documented resolution, so recovery survives even if the arg fails to
interpolate) → temp dir. The transcript dir is derived the same way from
`${CLAUDE_PROJECT_DIR}` (the project path mangled: non-alphanumerics → `-`).

## Idempotent re-attach: the key invariant

`join(group, handle)` must be safe to call repeatedly:

- handle not a member yet → create membership (persist), attach this connection.
- handle already a member, no live attachment → **re-attach** this connection
  (no error, no duplicate).
- handle already a member, a *different* live connection attached → `name_taken`
  (genuine concurrent claim).
- handle already a member, *this same* connection attached → no-op success.

This makes both auto-re-attach (from the recovered identity) and any explicit
re-`join` Claude issues converge to the same correct state.

## Connection lifecycle (cold start / hub started later)

Reconnection and re-join are **automatic and bound to the connection lifecycle**,
NOT driven per-tool-call:

- The adapter retries `connect()` forever with backoff (250ms → cap 10s),
  scheduled from the WS `close` handler. So if the hub is down at adapter startup
  and comes up later, the adapter connects on the next retry.
- Re-join is bound to the `welcome` event: on every successful (re)connect the
  adapter replays its `joinedGroups` (seeded from recovered identity), so the hub
  re-attaches every group automatically — exactly once per connection, no per-call
  join dance.
- A tool call invoked **while the hub is still down** fails fast: `waitReady`
  waits ~5s then throws a clear, self-healing message ("not connected to hub at
  <host>; reconnecting automatically (attempt N); groups re-join on connect; retry
  in a moment"). The background reconnect+rejoin still heals on its own, so the
  next call once the hub is up works. Calls never hang a turn waiting on a
  long-down hub.

## What does NOT change

- No-backfill-on-join (decision B).
- No-self-echo, read receipts, per-group seq, gap re-send within a live
  attachment — all unchanged.
- The message log format and history pull.

## Rejected alternatives

- **Adapter reverse-engineers its transcript path from `CLAUDE_CODE_SESSION_ID`.**
  Works in probing but leans on undocumented session-id→path mangling that can
  break on a Claude Code update. The SessionStart hook gets `transcript_path`
  handed to it — no derivation needed. Rejected in favor of the hook.
- **Adapter-owned state file as source of truth.** Simple, but can drift from what
  Claude actually did, and duplicates state the transcript already holds durably.
  The transcript is the truth; `CLAUDE_PLUGIN_DATA` is just the hook→adapter
  handoff cache.
- **Hub-durable only, no adapter recovery.** Fixes hub restart but not
  `/reload-plugins`. Both must be fixed; they're different failures.
