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

### Half 2 — Identity recovery (fixes the reload / next-day / resume bug)

A fresh adapter has no memory of its handle. There are two distinct concerns:
**which groups+handles to re-attach** (membership recovery) and **which real
session a given call belongs to** (account resolution).

> **SUPERSEDED — account resolution moved off the adapter.** The original Half-2
> had the adapter resolve the caller's real session itself by scanning the
> project transcript for the call's `toolUseId` (basename of the containing
> `.jsonl` = the session id). That scan is **gone**: it had a self-referential
> flush race (a fresh call's `tool_use` line is written only *after* the call
> returns) and a cursor bug, and the whole machinery —
> `resolveSessionId`/`scanFileForward`/the per-file cursor/the SESSIONLESS
> bucket — is deleted. Account resolution is now **hub-correlated** via a
> PreToolUse hook. See **`group-chat-session-resolution.md`** for the
> authoritative design. In one paragraph: the PreToolUse hook fires before each
> tool call, authoritatively receives the real `session_id` + `tool_use_id`, and
> ships that pair straight to the hub (`map_session` over a transient
> authenticated connection); the adapter attaches only the bare `tool_use_id` to
> its frames; the hub keeps `Map<tool_use_id, session_id>`, resolves the account
> from it (awaiting the registration with a bounded timeout for the cross-
> connection race), and binds identity exactly as before. On timeout, identity/DM
> tools honest-error and group tools proceed without a session.

What remains on the adapter is only **membership recovery**:

1. **SessionStart hook** (`group-chat/session-identity-hook.ts`). Fires on
   `source: startup | resume | compact`, reads its `transcript_path` (on stdin),
   computes the `{group: handle}` map from the session's `join`/`leave` tool calls
   (multi-group; a later `leave` cancels its `join`), and writes it to
   **`$CLAUDE_PLUGIN_DATA/identity-<session_id>.json`**, keyed by the session id it
   authoritatively knows (the hook DOES get the real id on stdin). Unchanged.

2. **Adapter — membership map.** At startup the adapter merges **every**
   `identity-*.json` in the plugin-data dir into a single `joinedGroups`
   (`group -> handle`) map, and extends it on each explicit `join`. It no longer
   keys membership per session, because it no longer resolves which session a call
   belongs to — the hub binds the real account per-call from the `tool_use_id`.
   The handle is used only to re-attach (welcome-replay) and to send `as`; the hub
   validates each asserted `as` against what this connection actually joined as, so
   a wrong handle can never speak as another member.

**Inbound routing is single-target by construction.** One adapter = one stdio
pipe back to the CLI = the currently-active session. A `<channel>` push therefore
reaches the active session; there is no inbound fan-out across sessions to model.
The per-session map exists purely to make each *outbound* tool call act as the
correct member.

**Outbound sender identity — per-message `as` on the wire.** Because one adapter
socket can hold several handles in the *same* group (two sessions both members of
`workflow-skills` under different names), the hub cannot derive the sender from
the connection alone. So `send` carries an explicit `as`, and the hub validates it
is a handle THIS connection actually joined under before broadcasting from it (a
connection can never speak as a member it didn't join as). The hub tracks
`joinedAs` as `Map<group, Set<handle>>` (a connection may be several members per
group); `leave` likewise carries `as` to pick which membership to drop, and
`ack`/`read`/disconnect fan out across all of the connection's handles in the
group (the one socket's delivery covers them all). This keeps a single socket per
instance while letting it multiplex many members — the additive `as` field is
backward-compatible (omitted ⇒ the old single-handle behavior).

**Miss handling — no guessing.** If we have no handle for the group (no identity
file recorded one and no explicit `join` this session), a group-scoped tool
returns the honest error ("not joined … call join() first") rather than guessing
a handle (impersonation, the worst failure). For ACCOUNT resolution the same
no-guessing rule lives hub-side now: if the `tool_use_id → session_id` mapping
hasn't arrived in time, identity/DM tools honest-error — no fallback to a boot/env
session id. Re-issuing `join` (or letting the next call's hook registration land)
is the clean recovery.

#### Investigation note: why this took so long

Several dead ends were chased and rejected (recorded so they aren't re-tried):
- A `.mcp.json` `env` block does NOT interpolate `${...}` — only `args`/`command`
  do (and only `${CLAUDE_PLUGIN_ROOT|PLUGIN_DATA|PROJECT_DIR}`, no session var).
  So the session id cannot be passed via `.mcp.json` at all.
- `extra.sessionId` on a tool call is `undefined` for stdio (verified by probe —
  the key is absent from the serialized `extra`). Only
  `_meta["claudecode/toolUseId"]` is injected — the only per-call thread to the
  real session. The adapter no longer pulls that thread itself (the transcript
  scan had a self-referential flush race); instead the PreToolUse hook reports the
  `(tool_use_id, session_id)` pair to the hub, which correlates it. See
  `group-chat-session-resolution.md`.
- The earlier belief that "each adapter's own env session id is correct for
  itself" was **wrong**. Probe evidence: `env_session = c9c178e5…` (a phantom with
  no transcript and an empty identity file) while the real session serving the
  calls was `ea322652…`, knowable only via the call's toolUseId — now correlated
  hub-side, not scanned adapter-side.

#### Locating the plugin data dir from the adapter

The hook writes to `${CLAUDE_PLUGIN_DATA}` =
`~/.claude/plugins/data/<plugin>-<marketplace>/`; the adapter reads the same dir.
A plugin MCP server does NOT inherit `CLAUDE_PLUGIN_DATA` via the `env` block
(no interpolation there), so we pass it as a CLI **arg** (where `${...}` works):

```json
"args": ["${CLAUDE_PLUGIN_ROOT}/group-chat/adapter.ts", "--plugin-data", "${CLAUDE_PLUGIN_DATA}"]
```

The adapter resolves the dir most-trusted-first, rejecting un-interpolated
`${...}` literals: `--plugin-data` arg → `CLAUDE_PLUGIN_DATA` env → **inferred**
`~/.claude/plugins/data/workflow-skills-workflow-skills` (from `$HOME`) → temp.

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

> The entries below about the **adapter-side transcript scan** (cursored stream,
> EOF-warming, per-file cursor advance, whole-file read) are retained as the
> historical record of how account resolution was first attempted. That whole
> approach has since been **superseded by hub-correlated resolution** — see
> `group-chat-session-resolution.md`. They no longer describe live code.

- **Adapter keys identity off its own `CLAUDE_CODE_SESSION_ID` (env/init id).**
  The original design. Wrong: the env id is the boot/phantom session, not the real
  one whose calls the adapter serves (except when launched with `--resume <id>`,
  where they coincide). It silently serves stale or empty identity after a
  `/resume` into a different session. Replaced by per-call toolUseId→transcript
  resolution.
- **Env/boot session id as a fallback when the toolUseId scan misses.** Tempting,
  but the boot id may belong to a *different* member — falling back to it risks
  impersonation. A miss returns an honest error instead; re-`join` recovers.
- **Adapter reverse-engineers its transcript path from a session id.** Leans on
  undocumented session-id→path mangling that can break on a Claude Code update.
  We instead scan the project transcript dir (derived from `CLAUDE_PROJECT_DIR`)
  for the toolUseId — no id→path mangling, just a directory listing + grep.
- **Adapter-owned state file as source of truth.** Simple, but can drift from what
  Claude actually did, and duplicates state the transcript already holds durably.
  The transcript is the truth; `CLAUDE_PLUGIN_DATA` is just the hook→adapter
  handoff cache.
- **Hub-durable only, no adapter recovery.** Fixes hub restart but not
  `/reload-plugins` / resume. Both must be fixed; they're different failures.
- **Whole-file `readFileSync().includes()` per lookup.** Simple, but loads the
  entire (multi-MB, growing) transcript into one string on every new toolUseId and
  re-reads from byte 0 each time. Replaced by the forward cursored stream above.
- **Scan to EOF on a hit and warm the cache with every id seen along the way.**
  An earlier attempt: read the whole matching file, remembering every `toolu_…` id
  → session as we passed it. Rejected — it forces the cursor *past* the match to
  EOF, and correctness then hinges on the id-extraction regex never missing an id
  (a missed id behind the advanced cursor is unrecoverable). Stopping at the match
  keeps the invariant simple: the cursor never passes a line we haven't attributed.
- **Advance every scanned file's cursor (matching or not).** Cheaper steady state
  for stable other-session transcripts, but only safe if every id in the skipped
  span was cached — same fragile dependency as above. We advance ONLY the matching
  file's cursor; non-matching files are re-scanned from their old offset (cheap —
  sub-second on real transcripts).
- **Per-session WebSocket to the hub (one socket per session id).** Would give each
  session its own connection and thus its own per-connection sender binding, no
  protocol change. Rejected: more sockets per instance, and it duplicates the
  reconnect/re-join machinery per session. The per-message `as` multiplexes many
  members over the one socket instead.
- **Accept one identity per group per instance (last `join` wins).** Simplest, and
  separate-instance usage never hits the collision. Rejected because two sessions
  on one instance joining the *same* group would silently send as the same member
  — a correctness trap. The per-message `as` removes the limit outright.
