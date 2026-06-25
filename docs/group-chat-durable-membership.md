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

### Half 2 — Adapter identity recovery (fixes the reload / next-day / resume bug)

A fresh adapter has no memory of its handle. Recovering it correctly turned out
to hinge on a single hard fact about how Claude Code launches the adapter:

> **The adapter is per-INSTANCE, not per-session, and the session id it is born
> with is the boot/empty session — NOT the real session whose tool calls it
> serves.**

Concretely: the CLI starts the adapter once for the instance, handing it whatever
`CLAUDE_CODE_SESSION_ID` it booted under. Unless the instance was launched with
`--resume <id>`, that boot session is a *phantom* — it has its own id (e.g.
`c9c178e5…`) but no transcript and an empty `identity-<id>.json` (`{}`). The
**real** session you `/resume` into routes its tool calls through this same
adapter, but the adapter's env still names the phantom. So **init-time identity is
structurally unreliable** and must not be the key.

What every real tool call DOES carry, reliably, is
`_meta["claudecode/toolUseId"]` — and a toolUseId appears in exactly one
session's transcript. That is the thread we pull to find the real session.

Three components:

1. **SessionStart hook** (`group-chat/session-identity-hook.ts`). Fires on
   `source: startup | resume | compact`, reads its `transcript_path` (on stdin),
   computes the `{group: handle}` map from the session's `join`/`leave` tool calls
   (multi-group; a later `leave` cancels its `join`), and writes it to
   **`$CLAUDE_PLUGIN_DATA/identity-<session_id>.json`**, keyed by the session id it
   authoritatively knows (the hook DOES get the real id on stdin). Unchanged.

2. **Adapter — per-call identity resolution (the fix).** State is **keyed per
   real session id**, never global:
   - On each tool call, read `toolUseId` from `_meta`.
   - Resolve it to the real session id by scanning the project's transcript dir,
     `~/.claude/projects/<slug>/*.jsonl`, for the toolUseId; the basename of the
     file that contains it IS the real session id. `<slug>` is derived from
     `CLAUDE_PROJECT_DIR` (the launch dir, stable per project) with `/`→`-`.
   - Look up / lazy-init that session's state: `identity-<realSessionId>.json` →
     its `{group: handle}` → that session's `joinedGroups`.
   - Cache `toolUseId → sessionId` (immutable) and reuse the per-session state
     map across calls, so the scan happens once per session.

   The scan is a **forward, cursored, streaming** scan — not a whole-file read:
   - Per file we keep a byte cursor (`scanned: Map<path, offset>`) of how far
     we've looked. A lookup resumes each file from its cursor and reads only the
     newly-appended bytes (transcripts are append-only, and a new toolUseId is
     always appended *after* the last one we resolved).
   - We read in 64 KiB chunks and test line by line, discarding each line as we
     go (flat memory — a transcript can be many MB). A trailing partial line (an
     in-progress append) is never tested and never consumed; it's re-read whole
     next time.
   - On a hit we **stop at the matching line** and advance *that file's* cursor to
     just past it (match + 1) — never to EOF. A non-matching file's cursor is left
     **untouched** (advancing it would skip that file's own not-yet-resolved ids
     and we'd never rescan that region — corrupting another session's resolution).

3. **Per-session state map.** `Map<sessionId, Map<group, handle>>` replaces the
   single global `joinedGroups`. One adapter can serve more than one session over
   its life (resume into a different session ⇒ a *different member*), so each
   session's membership is isolated. On every (re)connect the adapter re-attaches
   the union of all known sessions' groups (hub re-attach is idempotent).

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

**Miss handling — no guessing.** If the toolUseId isn't found in any transcript
yet (the line not flushed, or a brand-new session), a group-scoped tool returns
the existing honest error ("not joined … call join() first"). We do **not** fall
back to the env/boot session id: that risks assuming a *different* member's
identity (impersonation), the worst possible failure. Re-issuing `join` already
works and is the clean recovery.

#### Investigation note: why this took so long

Several dead ends were chased and rejected (recorded so they aren't re-tried):
- A `.mcp.json` `env` block does NOT interpolate `${...}` — only `args`/`command`
  do (and only `${CLAUDE_PLUGIN_ROOT|PLUGIN_DATA|PROJECT_DIR}`, no session var).
  So the session id cannot be passed via `.mcp.json` at all.
- `extra.sessionId` on a tool call is `undefined` for stdio (verified by probe —
  the key is absent from the serialized `extra`). Only
  `_meta["claudecode/toolUseId"]` is injected. The toolUseId→transcript
  correlation is therefore the ONLY per-call path to the real session id — it is
  load-bearing, not optional.
- The earlier belief that "each adapter's own env session id is correct for
  itself" was **wrong** and is the bug this revision fixes. Probe evidence:
  `env_session = c9c178e5…` (a phantom with no transcript and an empty identity
  file) while the real session serving the calls was `ea322652…` (55-byte
  identity with real groups), discoverable only via the call's toolUseId.

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
