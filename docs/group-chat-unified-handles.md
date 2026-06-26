# Group-chat: handles are aliases — unified identity, membership is derived

## The model (authoritative)

**Identity is the one first-class thing. A handle is just a name owned by an
identity.** There is no separate "member" entity.

- An identity (a session, today 1:1) owns zero or more **handles**.
- A handle's string encodes everything: `alice@aludepp` is a registered alias on a
  host; `hub-hoster@workflow-skills._group` is a group handle whose `._group`
  suffix encodes the group.
- **Group membership is DERIVED, not stored separately:** "who is in group `ws`" =
  the identities that own a handle ending `@ws._group`. "What is identity X's handle
  in `ws`" = X's handle ending `@ws._group`.
- A session has exactly **one** identity, so it has **at most one** handle per
  group. The "multiple handles in one group for me, can't pick" situation is
  therefore **impossible by construction** — the bug that motivated this.

This supersedes:
- the separate `members` table + in-memory `Member` struct + `member.conn`;
- `owner_session` (redundant — the handle already belongs to an identity);
- the whole `name_taken` / takeover machinery from the (uncommitted)
  session-owned-membership change — it solved the problem in the wrong layer.

## Why the previous shape was wrong

`members(group_name, handle, owner_session)` was a SECOND registry of
"name owned by an identity," parallel to `aliases(name, host, owner_session_id)`.
Two registries for the same concept → the adapter tried to track per-session group
handles itself, merged multiple sessions' identity files into one
`group → handles` map, and a handle-less group tool then couldn't pick among the
(wrongly) merged handles. Deriving membership from the single handle table removes
the duplication and the bug.

## Storage: one handle table

Replace `aliases` + `members` with a single durable handle table (decisions:
**unique by full handle string**, **durable like an alias**):

```sql
CREATE TABLE handles (
  handle         TEXT PRIMARY KEY,        -- full string, globally unique
  owner_session  TEXT NOT NULL,           -- the identity that holds it
  created_ts     TEXT
);
```

- **Registered alias:** `handle = '<name>@<host>'`. Dash-free `<name>` rule
  unchanged (anti-impersonation).
- **Default alias:** `'<session-id>@<host>'` — still implicit (not stored; the
  session IS its own default address), resolvable directly.
- **Group handle:** `handle = '<member-name>@<group>._group'`. Created by `join`,
  removed by `leave`. Durable: survives disconnect / hub restart; the owning
  session reclaims on reconnect (it re-registers the same handle, owner matches →
  no-op).
- **First-holder-wins** uniformly: registering/joining a handle owned by a
  DIFFERENT identity → `handle_taken`. Same owner → idempotent.

> Migration: this is a schema change. Per project policy, use a proper versioned
> migration (the `user_version` pattern already in the hub). Since current data is
> throwaway, the migration may rebuild into the new `handles` table; the mechanism
> must remain for future changes. (See Open questions for whether to fold the old
> aliases rows in or clean-slate.)

## How each operation transforms

- **join(group, as):** register handle `'<as>@<group>._group'` owned by the calling
  identity (resolved from the call's `tool_use_id` via the existing PreToolUse
  correlation). `handle_taken` if a different identity owns it; idempotent for the
  owner. (The session still picks its display name via `as`.)
- **leave(group):** delete the calling identity's `'<*>@<group>._group'` handle.
  No `as` needed — an identity has at most one handle in a group, so it's
  unambiguous (this is exactly what fixes the "can't pick" error).
- **submit_message(group, message):** the hub resolves the calling identity from
  `tool_use_id`, finds that identity's `@<group>._group` handle, and sends AS that
  handle. Handle-less on the wire — the adapter sends only the group + tool_use_id;
  the hub picks the sender. (No per-message `as`, no adapter-side handle map.)
  - Not a member (identity owns no `@<group>._group` handle) → honest error
    "join '<group>' first".
- **list_members(group):** `SELECT handle FROM handles WHERE handle LIKE
  '%@<group>._group'` → the member names (strip the suffix) + whether each owner is
  currently online (live connection for that session). Membership is durable;
  "online" is derived from live connections, never stored.
- **resolveAddress(`<handle>@<group>._group`):** look up the handle row → its
  `owner_session`. **Independent of connection state** (durable identity) — unlike
  today's `members.get(h).conn.sessionId` which required attachment. DM-ing a
  group member resolves even if they're momentarily detached (delivery still waits
  on the durable-DM queue if offline). Registered-alias and group-derived
  resolution become the SAME query.
- **fan-out (broadcast):** to push a group message, find the online connections of
  the identities owning a `@<group>._group` handle (excluding the sender), and send
  to each. "Online connection of identity X" uses the existing
  `sessionConns: session → live connections` map. No `member.conn` field.

## Adapter becomes dumb for group identity too

- Delete the adapter's `joinedGroups` per-session/handle tracking, `recordMembership`,
  `desiredAttachments`'s handle/session emission, the `attachedGroups` set, and the
  "multiple handles, can't pick" branch.
- The adapter no longer attaches a handle or `session`/`owner_session` to group
  frames — only the bare `tool_use_id` (as it already does for identity tools). The
  hub resolves identity → handle.
- `join` still carries `as` (the chosen name); `leave`/`submit_message`/
  `list_members` carry only `group` + `tool_use_id`.
- `loadIdentity` and the whole identity-file-merge go away for membership purposes —
  the hub is the source of truth for who owns which handle. (The SessionStart hook's
  identity files may still seed re-join intent, but the adapter no longer derives
  per-session handle maps from ALL files.)

## Reconnect / durability

- On reconnect, the adapter re-asserts the calling identity's group handles by
  re-issuing `join` (idempotent: same owner re-registers the same handle → no-op).
  Because handles are durable in the DB, a hub restart preserves them; an identity
  reclaims by matching `owner_session`.
- No takeover/name_taken dance: a returning identity owns its handle by identity,
  not by connection. A DIFFERENT identity claiming a held handle is `handle_taken`
  (genuine collision), same as aliases.

## What does NOT change

- DM model (durable queue, sent→received→read), the PreToolUse hub-correlation
  session resolution, online-only group push + brief-reconnect window, no-backfill.
- The `._group` suffix and address forms (they're now just handle strings).

## Rejected alternatives

- **Keep `members` table; just drop `owner_session` / fix loadIdentity.** Leaves two
  parallel registries for "name owned by identity" and the adapter still tracking
  per-group handles. Doesn't remove the duplication that caused the bug.
- **Adapter resolves its own session and tracks per-session handle maps.** Keeps
  identity logic in the adapter; the hub already resolves identity per call —
  membership should be derived there.
- **`owner_session` on a member row.** Redundant: the handle is already owned by an
  identity; the column duplicates what the handle's ownership encodes.

## Open questions — RESOLVED at implementation

- **O1 — DECIDED: full clean-slate.** The `v1` migration creates the new schema
  (`handles`, `groups`, `messages`, `dms`, `dm_delivery` + `dms_by_pair`) and does
  NOT carry old `aliases`/`members` rows. Data was throwaway. The `user_version`
  mechanism remains for future incremental migrations (append a new entry; each
  applied in its own transaction with the version bumped after).
- **O2 — DECIDED: keep `owner_session`.** The handle column stays session-neutral
  in name (`owner_session`), since identity == session today; it becomes the
  identity id unchanged when identities decouple from sessions in future.
- **O3 — DONE: swept all readers.** Every reader of the old `members` table moved
  to the derived query (`SELECT … FROM handles WHERE handle LIKE '%@<group>._group'`):
  `list_members`, `show_member`, `list_groups` member counts, `resolveAddress`
  (group form), `broadcast` fan-out, `buildDirectory` group memberships, and
  recovery (membership is no longer reloaded into memory — it's derived on demand).
  The old `aliases` table reads moved to the same `handles` table (an alias is a
  handle `<name>@<host>`; aliases = a session's handles NOT ending `._group`).

---

## Appendix: verbatim source record

### [V1] The reframe — handles are attributes of identity, not first-class

> Why is that even possible a session can only have one identity. The error shouldn't even be able to appear. The error shouldn't exist. The premise that a session can have two identities is impossible. It's always ONE identity, multiple handles on that identity. If it sends the message to a group, it had to pick the name it should appear in the group as, and that is the name. Explain why this is a problem. Do not talk too much, to not derive a conclusion, just answer directly.

### [V2] One instance, multiple sessions over time

> No, one adapter = one INSTANCE and within that instance only ONE SESSION, but the session can CHANGE.
> That is the entire point why we refactored to a map – an adapter can host multiple sessions simply because claude code works that way.
> So what do we do about this?

### [V3] Identity is authoritative; handle encodes group AND session; owner_session is redundant

> No, one adapter = one INSTANCE and within that instance only ONE SESSION, but the session can CHANGE.
> [...]
> Why would it undo a fix? i dont see the code, you are asking me questions about things you wrote. owner_session should not exist. the handle encodes which identity is in which group and it also encodes which session the identity belongs to. we haven't built anything that can move identities to other sessions so at the moment 1 session = 1 identity, but in the future this could change.

> The authoritative point is the identity. The identity is the one. When the agent sends a message to the group, the hub has to resolve its identity – once it knows the identity, it knows the handles. Each handle has a group name attached to it "hub-hoster@workflow-skills._group" so we know which group they are part of from handle name alone. That's all that's needed to establish group membership. Same thing in reverse, to find out who you need to send messages to, you just query the DB by asking which identities have a handle assigned that ends in @worflow-skills._group. So why do we have that owner stuff anyway?

### [V4] Decisions

- Storage: **Group handles ARE aliases** (one unified handle table; group handle =
  name ending `@<group>._group`; delete members table / Member / owner_session /
  takeover).
- Handle uniqueness: **unique by full handle string**.
- Durability: **yes — durable like aliases** (join registers a durable handle,
  leave releases it, survives reconnect/restart).
- Process: **design doc, then workflow.**
