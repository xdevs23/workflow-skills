# Group-chat: accounts, aliases & direct messages (SQLite hub)

## Summary

Adds a hub-side **identity layer** on top of the existing group chat: every
connected session has an **account** addressable by one or more **aliases**, and
sessions can **direct-message** each other by alias — independent of any group.
Group membership now sits on top of this identity layer.

Two more changes ship together:
- The hub's storage moves to **SQLite** (`bun:sqlite`, WAL) as the durable
  foundation — a clean slate; the old hand-rolled JSONL/`.members.json` files are
  abandoned (no migration).
- The group sender gains an optional **`to:`** push-filter.

The defining property is the **group / DM asymmetry**:

| | Group messages | Direct messages |
|---|---|---|
| Delivery | **online-only push** (+ brief-reconnect gap-resend within one hub lifetime) | **durable queue**, delivered on reconnect |
| Restart / genuinely offline | **never replayed**; catch up via `list_group_messages` (pull) | **replayed** from the queue, **one `<channel>` per DM** |
| Receipt states | `read` (surfaced in window) / `sent` | `sent → received → read`, shown in `list_direct_messages` |
| Durable delivery cursor | no (in-memory, resets on restart) | **yes** (per-recipient, persisted) |

## Clean break (operational note)

The hub starts on a **fresh SQLite DB**. Existing groups, rosters, and message
history in the old `*.jsonl` / `*.members.json` files **do not carry over** — they
are abandoned. After this ships and the hub restarts on the new code, it comes up
empty: members re-join fresh, prior scrollback is gone. This is intended, not a
bug; the hoster should expect the reset on restart.

## Identity model

### An address resolves to a session

The core primitive is **address → session**: every address form names "which
session do I deliver to." Three forms:

| Address form | Example | Resolution | Stored? |
|---|---|---|---|
| Default alias | `1ab3cf12-…@aludepp` | the session whose id is `1ab3cf12-…` | implicit (the session itself) |
| Registered alias | `alice@aludepp` | the session that owns registered alias `alice` on host `aludepp` | **yes**, durable |
| Group-derived | `alice@proj._group` | the session currently holding handle `alice` in group `proj` | **no**, derived live |

### Default alias — one per session, automatic

On connect every session **automatically** has `<session-id>@<host>`. No
registration, no `join`. It both sends and receives DMs immediately.

- `<session-id>` is the real Claude Code session id. It is resolved per-call by
  the HUB, which correlates the call's `tool_use_id` to the real session via the
  PreToolUse hook — see `group-chat-session-resolution.md`. (This replaces the
  earlier adapter-side toolUseId→transcript scan.) The hub never trusts a
  client-supplied id; it learns the binding from that correlation.
- `<host>` is the **session's own device hostname**, reported by the adapter at
  connect.

### Registered aliases — durable, owned, dash-free

A session may register any number of aliases, each `<name>@<host>`:

- **`<name>` must NOT contain a dash.** Session ids contain dashes; forbidding them
  in registered names makes it impossible to register a name shaped like a session
  id, so no one can impersonate a default alias. Allowed: `[A-Za-z0-9_]{1,64}`.
- **Ownership is bound to the registering session-id** (`alias → owner_session_id`).
  Only that same session-id reclaims the alias on reconnect — reuses per-call
  session resolution, no new secret.
- **First-holder-wins.** Registering a `<name>@<host>` owned by a *different*
  session → `alias_taken`. Re-registering your own → idempotent success.
- **Durable.** Survives disconnect / hub restart. While the owner is disconnected
  the alias is *reserved* (owned, unreachable); the owner reclaims on reconnect.
- **`release_alias(name)`** frees an alias the caller owns.

### Group-derived address — live, unstored, membership-free

Anyone in a group is also reachable at `<handle>@<group>._group`:

- Computed **on demand** from the group roster, never stored. Resolves to "the
  session currently holding `<handle>` in `<group>`."
- Suffix is **`._group`** (leading underscore — never a real gTLD).
- Groups are **cross-device** → the address has **no hostname**; `@<group>._group`
  replaces the host part.
- **The sender need not be a member of the group.** It is an addressing mechanism,
  not an authorization one — knowing `alice@proj._group` is enough to DM that
  member without joining `proj`.
- If `<handle>` isn't a current member of `<group>` → `no_such_address`.

### Hostname

The adapter reports its **own machine's hostname** at connect (the `hello` frame
gains `host`). Registered-alias uniqueness is **per host** (`alice@aludepp` and
`alice@other` are distinct). Docker's differing hostname is the *container's*
problem to encode (out of scope); the hub takes what the adapter reports verbatim.

## Group messages — online-only push (unchanged model, made explicit)

A group message is pushed only to members **connected at that moment**.

- Offline / detached members **do not** get the push and it is **never replayed**
  to them. They catch up by pulling `list_group_messages`.
- **Brief-reconnect gap-resend is kept**: within a single hub lifetime, a momentary
  socket blip still re-sends the gap on reattach (so a flaky link doesn't drop
  pushes). Across a hub **restart** or a genuine offline period, **nothing
  replays**. The group delivery cursor therefore stays **in-memory** and resets on
  restart — no durable group cursor.
- **No-backfill-on-join** stands: a brand-new member starts at the group head; no
  history is pushed on join.

## Direct messages

### `direct_message(to, message)` — a separate tool

A distinct MCP call (not the group sender). `to` is any address form.

- **Threaded by session pair.** All DMs between session A and session B form one
  thread, regardless of which alias addressed them (aliases are routing; history
  records the alias used). The conversation key is the unordered pair of
  participant **session-ids**.
- **Durable queue + delivered on reconnect.** Each DM is stored with a
  per-recipient delivery cursor. If the target is offline the DM is queued and
  **pushed when that session reconnects** — **one `<channel>` event per DM**
  (batching only as a fallback if per-message delivery proves unreliable in
  real-world testing; default is one-per-message).
- **Channel framing.** A DM surfaces as a `<channel>` clearly marked a **direct
  message** (distinct from group), showing **both** the `to` alias and the sender's
  `from` alias (so a multi-alias recipient knows which identity was used). The
  display hook is updated to render DMs distinctly.

### Three receipt states: `sent → received → read`

Tracked end-to-end and shown in `list_direct_messages` (the sender learns eventual
state by **pulling**, not by a delayed push — `direct_message` returns once and is
not re-notified):

- **sent** — the hub accepted and (if target offline) queued the DM.
- **received** — the target's adapter acked arrival of the push (a DM arrival-ack,
  distinct from read).
- **read** — the target's **MessageDisplay hook** surfaced the DM to the assistant
  and the adapter sent a DM read-receipt. (We already have that hook; it fires
  exactly when the assistant sees the message, so "read" is observable, not
  guessed.)

`direct_message` returns the state at call time: `read` (target online & surfaced
within the window) or `sent`/`queued` (offline). No delayed read receipt is pushed
back to the sender; the state advances in storage and shows on the next
`list_direct_messages`.

### `list_direct_messages(peer, last_n?, index_from_end?)`

DM scrollback for the thread between the caller and `peer` (peer given as any
address, or a session-id). Newest-last; each message shows its `sent/received/read`
state and the from/to aliases used.

## Group push-filtering (`to:` on the group sender)

`submit_message(group, message, to?: string[])`:

- `to` entries are **group handles** (names in *this* group's roster), not aliases.
- When present, the live **push** goes only to those members (plus no-self-echo);
  others get no push.
- **The message is still logged to group history for everyone** — push-targeting,
  NOT privacy. Read receipts await only the targeted recipients.
- **A `to` naming a non-member errors** (the whole send fails with a clear message;
  no partial/silent send) — decision O1.
- `to` omitted → unchanged (push to the whole group).

## New / changed MCP tool surface

**New:**
- `register_alias(name)` → `<name>@<myhost>`; `alias_taken` on conflict; no dashes.
- `release_alias(name)` → relinquish an owned alias.
- `list_aliases()` → my own aliases (default + registered).
- `whoami()` → my session-id, host, and all my aliases.
- `resolve_alias(address)` → the session-id an address points to + online flag, or
  unknown.
- `direct_message(to, message)` → send a DM.
- `list_direct_messages(peer, last_n?, index_from_end?)` → DM scrollback.
- `list_directory()` → every known session-id with its aliases and group
  memberships, each marked online/offline when knowable (after a restart all are
  provably offline until they reconnect — decision O3). Accumulates stale entries;
  pruning is explicitly a separate task.

**Changed:**
- `submit_message(group, message, to?: string[])` — push-filter.
- `join` / group tools — unchanged in shape; they presuppose the account, which
  exists automatically on connect.

## Wire protocol (v2 → v3)

Additive; bump `PROTOCOL_VERSION` to 3.

**adapter → hub**
- `hello` gains `host: string`.
- `register_alias { name }`, `release_alias { name }`, `list_aliases {}`
- `whoami {}`, `resolve_alias { address }`, `list_directory {}`
- `dm { to, message }`
- `dm_history { peer, last_n, index_from_end }`
- `dm_ack { from_session, seq }` — DM **received** (arrival ack)
- `dm_read { from_session, seq }` — DM **read** (surfaced by display hook)
- `send` gains `to?: string[]` (group handles to restrict the push to)

**hub → adapter**
- `aliases { rid, aliases }`
- `whoami { rid, session_id, host, aliases }`
- `resolved { rid, address, session_id: string | null, online: boolean }`
- `directory { rid, entries: { session_id, host, aliases, groups, online }[] }`
- `dm_sent { rid, seq, state: "sent" | "read" }` — send ack (read iff online &
  surfaced in window, else sent/queued)
- `dm_message { msg: DirectMessage }` — a DM to surface
- `dm_history { rid, peer_session, messages: DirectMessage[] }`
- error codes: `alias_taken`, `bad_alias_name`, `no_such_address`,
  `not_alias_owner`, `to_non_member`

`DirectMessage`: `{ seq, from_session, from_alias, to_session, to_alias, ts,
msg_id, text, state: "sent" | "received" | "read" }`.

## SQLite storage (`bun:sqlite`, WAL)

- One DB file: **`DATA_DIR/hub.db`** (`GROUP_CHAT_DATA` dir). WAL journaling for
  durability + write concurrency. Created with schema if absent; **loaded if
  present** (durable across restarts). PRAGMA `journal_mode=WAL`,
  `foreign_keys=ON`.
- Schema (indicative):

  ```sql
  -- groups & membership (durable roster; no durable delivery cursor)
  CREATE TABLE groups (name TEXT PRIMARY KEY, created_ts TEXT);
  CREATE TABLE members (
    group_name TEXT, handle TEXT, joined_ts TEXT, last_seen_ts TEXT,
    PRIMARY KEY (group_name, handle),
    FOREIGN KEY (group_name) REFERENCES groups(name)
  );
  CREATE TABLE messages (
    group_name TEXT, seq INTEGER, from_handle TEXT, ts TEXT, msg_id TEXT, text TEXT,
    PRIMARY KEY (group_name, seq)
  );

  -- accounts / aliases (default alias is implicit, not stored)
  CREATE TABLE aliases (
    name TEXT, host TEXT, owner_session_id TEXT, created_ts TEXT,
    PRIMARY KEY (name, host)
  );

  -- direct messages: threaded by sorted session pair (lo,hi)
  CREATE TABLE dms (
    lo_session TEXT, hi_session TEXT, seq INTEGER,
    from_session TEXT, from_alias TEXT, to_session TEXT, to_alias TEXT,
    ts TEXT, msg_id TEXT, text TEXT,
    state TEXT,           -- 'sent' | 'received' | 'read'
    PRIMARY KEY (lo_session, hi_session, seq)
  );
  -- per-recipient durable delivery cursor: highest dm seq the recipient has been
  -- delivered (pushed). Undelivered queue = dms past this cursor for that pair
  -- where the recipient is the target. Persisted so it survives hub restart.
  CREATE TABLE dm_delivery (
    lo_session TEXT, hi_session TEXT, recipient_session TEXT, delivered_seq INTEGER,
    PRIMARY KEY (lo_session, hi_session, recipient_session)
  );
  CREATE INDEX dms_by_pair ON dms (lo_session, hi_session, seq);
  ```

- **Group delivery is NOT cursored in the DB** (online-only push; brief-reconnect
  gap-resend uses the in-memory window as today).
- DM `seq` is monotonic **per session pair**. `state` advances `sent → received →
  read` via `dm_ack` / `dm_read`. The offline queue for a reconnecting session is a
  single indexed query: DMs in its pairs with `seq > delivered_seq` where it is the
  recipient.

## Connection / account lifecycle

- On `hello` (with `host`): the hub binds the connection to the resolving
  session-id, ensures the default alias is usable, and reclaims any registered
  aliases owned by that session-id. Then it flushes the session's **undelivered DM
  queue** (one `dm_message` per DM, advancing `dm_delivery`).
- On disconnect: connection detaches. Registered aliases stay owned+reserved; group
  memberships stay (durable); undelivered DMs remain queued in the DB.
- Account/identity resolution is hub-correlated: the PreToolUse hook reports the
  call's `(tool_use_id, session_id)`, the adapter forwards only the bare
  `tool_use_id`, and the hub resolves the account from its map (see
  `group-chat-session-resolution.md`). The hub does not invent identity.

## What does NOT change

- Durable group membership, no-backfill-on-join, group read receipts, per-group
  seq, brief-reconnect gap-resend, per-message `as` sender selection — all
  unchanged in semantics (now backed by SQLite instead of JSONL).
- `list_group_messages` behavior (pull scrollback).

## Rejected alternatives

- **Migrate the old JSONL data into SQLite.** Rejected per explicit decision:
  clean break, abandon old files. Removes the riskiest part (format reconciliation)
  and there's no production data worth keeping.
- **Persist group delivery cursors for at-least-once group redelivery.** Considered
  and rejected: group messages are online-only push and never replayed across
  restart/offline. Only DMs get a durable queue.
- **Aliases keyed by handle/connection instead of session-id.** Breaks
  reclaim-after-reconnect (a new connection couldn't prove ownership). Session-id
  binding reuses the trusted identity mechanism.
- **Allow dashes in registered alias names.** Lets a name mimic `<session-id>@host`
  → default-alias impersonation. Forbidding dashes partitions the namespaces.
- **`.group` suffix.** Collides with the real `.group` gTLD; `._group` cannot be a
  real TLD.
- **Group-derived addressing requires group membership.** Rejected: it's addressing,
  not authorization; keeps DMs orthogonal to group ACLs.
- **DM threads keyed by alias pair.** Fragments history; a released/re-pointed alias
  orphans a thread. Session-pair threading is stable.
- **DMs push-only / not stored, or delayed read-receipt pushed to sender.**
  Rejected: stored with `sent→received→read` shown on pull; the sender isn't
  re-notified asynchronously (it would race a long-returned tool call).
- **`to:` push-filter hides the message from history / makes it private.** Rejected:
  it filters the push only; the message stays in group history. Privacy is what DMs
  are for.
- **`to:` entries as full aliases.** The group sender is already group-scoped; group
  handles are the natural, less error-prone form.
- **Per-hub (not per-host) alias uniqueness.** The cross-device model means two
  devices can both have `alice`; host-namespacing keeps them distinct.
