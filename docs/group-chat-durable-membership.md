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

A fresh adapter process has no memory of its handle. We recover it from the
**transcript**, which durably records every `join`/`leave` tool call, via a
**SessionStart hook** (the component that reliably receives `transcript_path`).

Flow:

1. **SessionStart hook** (`group-chat/session-identity-hook.ts`) fires on
   `source: startup | resume | compact`. It reads its `transcript_path`, scans for
   this session's `join`/`leave` tool *results* across **all** groups, computes the
   current identity **map** `{group: handle}` — **a session can be in several
   groups at once, under possibly different handles**, so this is always a map, one
   entry per still-active group (a later `leave` cancels an earlier `join` for that
   group). Writes it to **`$CLAUDE_PLUGIN_DATA/identity-<session_id>.json`**.
2. **Adapter**, on startup, reads `$CLAUDE_PLUGIN_DATA/identity-<session_id>.json`
   and seeds its `joinedGroups` from the **whole map**. Then its existing reconnect
   logic auto-re-attaches to **every** group in the map on the first `welcome` —
   *before* any `submit_message` runs. Re-attach iterates all entries; it is never
   single-group.

Both channels are documented: `CLAUDE_PLUGIN_DATA` is the plugin's persistent data
dir (exported to hooks); `transcript_path` + `session_id` arrive in the
SessionStart hook's stdin JSON.

#### Locating the plugin data dir from the adapter (the tricky part)

The hook (run by Claude Code) gets `CLAUDE_PLUGIN_DATA` and writes the identity
file to `~/.claude/plugins/data/<plugin>-<marketplace>/`. The adapter must read
the SAME directory. Two real-world traps, both hit during live restarts:

1. A plugin MCP server spawned from `.mcp.json` does **NOT** inherit
   `CLAUDE_PLUGIN_DATA` in its environment.
2. `.mcp.json` interpolates `${...}` in `command`/`args` but **NOT inside the
   `env` block** — passing `"CLAUDE_PLUGIN_DATA": "${CLAUDE_PLUGIN_DATA}"` in
   `env` delivered the *literal string* `${CLAUDE_PLUGIN_DATA}` to the process
   (confirmed by reading the live adapter's `/proc/PID/environ`).

So we pass the values as **CLI args** (where interpolation works, same as the
proven `${CLAUDE_PLUGIN_ROOT}`):

```json
"args": [
  "${CLAUDE_PLUGIN_ROOT}/group-chat/adapter.ts",
  "--plugin-data", "${CLAUDE_PLUGIN_DATA}",
  "--session-id", "${CLAUDE_CODE_SESSION_ID}"
]
```

The adapter resolves the data dir most-trusted-first, with a guard that rejects
any un-interpolated `${...}` literal:

1. `--plugin-data` arg (intended path)
2. `CLAUDE_PLUGIN_DATA` env (if real)
3. **inferred** `~/.claude/plugins/data/workflow-skills-workflow-skills` — the
   documented resolution of `${CLAUDE_PLUGIN_DATA}` for this plugin, derived from
   `$HOME`. This is the 99% case and works even if BOTH the arg and env fail to
   interpolate, making recovery resilient to harness-interpolation quirks.
4. temp dir — last resort.

Session id resolves arg → `GROUP_CHAT_SESSION_ID` → `CLAUDE_CODE_SESSION_ID`,
same placeholder guard. With it, the adapter reads `identity-<session>.json`
directly; without it, it falls back to the newest identity file (one session =
one adapter).

#### Wiring the session id to the adapter

The hook keys its file by `session_id` (from stdin). The adapter must read the
*same* file. The adapter is spawned from `.mcp.json`; we pass the session id in via
the args/env there using the harness's `session_id` substitution if available, or
fall back to the newest `identity-*.json` in `CLAUDE_PLUGIN_DATA` if the exact id
isn't resolvable. (Implementation note: verify what `.mcp.json` can interpolate;
if nothing, the adapter picks the most-recently-written identity file as a
pragmatic fallback, since one session = one adapter — note "one adapter per
session" still holds even though that one adapter may be in many groups.) The file
itself is a multi-group map regardless of how it's located, so the adapter always
re-attaches to the full set of groups it finds there.

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
