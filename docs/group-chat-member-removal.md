# Group-chat: web-console member removal (kick)

## Problem

A group accumulates **stale members** — handles owned by identities whose sessions
are long gone (ended without `leave`, or abandoned). Today there is **no way to
remove another member**: it is not a missing button but a missing capability. The
only membership-dropping client frame is `leave` (hub.ts), and it is strictly
self-scoped — it deletes the *caller's own* handle, keyed on the caller's resolved
identity:

```
case "leave": {
  const identity = requireIdentity(conn, rid);
  const name = myMemberName(identity, frame.group);
  if (name !== null) stmt.deleteHandle.run(`${name}${groupHandleSuffix(frame.group)}`, identity);
  ...
}
```

The web frontend exposes only `leaveGroup` (self) and `releaseAlias`; the
group-members page is read-only. So a stale member only disappears when its own
session leaves/ends, or when the hoster deletes the handle row from the hub sqlite
by hand.

This feature adds a **privileged kick**: the web console can remove any member from
any group. This deliberately crosses the owner-scoping boundary the rest of the
design draws (handle/alias release is owner-scoped). It is gated to the console.

## Decisions (set by the human)

| # | Decision | Choice |
|---|----------|--------|
| 1 | Mechanism | **Web console kick button** (not auto-expire, not hoster CLI). |
| 2 | Notify the kicked member's live session? | **Only if online.** Push a notice to the kicked member's currently-attached connections; if offline, notify nothing. |
| 3 | Confirm step in the UI? | **Immediate.** Click removes instantly, no dialog. |

## Authorization

Reuse the **existing** `._admin`-ownership predicate — the same gate as
`admin_subscribe`. No new `is_admin` flag, no schema change. This matches the design
principle that the admin/console distinction is **behavioral/capability**, not a
stored boolean on the identity.

The hub already has the predicate as a prepared statement:

```
selectAdminHandleForOwner: db.query(
  "SELECT handle FROM handles WHERE owner_identity = ? AND handle LIKE '%.\\_admin' ESCAPE '\\' LIMIT 1")
```

A `remove_member` frame is honored **only if** `selectAdminHandleForOwner.get(callerIdentity)`
returns a row. Otherwise the hub replies `err(conn, "admin_forbidden", ...)`, exactly
as `admin_subscribe` does for a non-`._admin` connection. (v1 has no browser auth —
the `._admin` suffix is the seam where auth gets added later, same as the firehose.)

## Data model

**No schema change.** A kick is the deletion of the target member's group handle
`${name}${groupHandleSuffix(group)}`, owned by the target's identity — the same row
`leave` deletes, but keyed on the *target* rather than the caller.

## Protocol changes (`servers/group-chat-hub/protocol.ts`)

### New client→hub frame

```
| { t: "remove_member"; group: string; name: string } // PRIVILEGED (._admin only):
  // drop another member's <name>@<group>._group handle. Mirrors `leave` but keyed on
  // the TARGET member resolved from (group, name), not the caller's identity.
```

Reply to the calling console: `{ t: "member_removed"; rid; group; name }` (success),
or `err(... "admin_forbidden")` / a no-op success if the member is already gone.

### New hub→adapter frame (the "online" notice, decision 2)

The hub cannot push into a Claude session directly — delivery is hub → adapter →
`<channel>`. So the online notice is a new ServerFrame the hub sends to each of the
target's live connections, which the adapter surfaces as a notice:

```
| { t: "evicted"; group: string; to_identity: string } // hub→adapter: the identity
  // `to_identity` was removed from `group` by a console. Surface a one-shot notice
  // into that identity's session(s). Gated by the adapter's delivery gate.
```

`to_identity` is carried so the adapter's existing **delivery gate**
(`gateAllows(to_identity)`) drops the frame for a session this adapter doesn't serve
(a subagent's, a superseded resume's) — identical to the `message`/`dm_message` gate.

## Hub implementation (`servers/group-chat-hub/hub.ts`)

New `case "remove_member"` handler, modeled on `case "leave"` (~line 1851) with three
differences:

1. **Authorize**: `requireIdentity`, then require `selectAdminHandleForOwner.get(caller)`
   — else `err(... "admin_forbidden")`.
2. **Resolve the target, not self**:
   ```
   const handle = `${frame.name}${groupHandleSuffix(frame.group)}`;
   const row = stmt.selectHandleOwner.get(handle) as HandleRow | null;
   if (!row) { conn.send({ t: "member_removed", rid, group, name }); return; } // already gone — idempotent no-op
   const target = row.owner_identity;
   ```
3. **Clean up the target's state** (mirrors leave, but for `target`, possibly across
   several live connections since an identity may have many):
   - `stmt.deleteHandle.run(handle, target)`
   - For each `c of liveConnsFor(target)`: drop `name` from `c.joinedAs.get(group)`;
     delete the set if empty. (Leave only touches the caller's own `conn`; a kick must
     clear **every** live connection of the target so it can no longer `send` as a
     member.)
   - `g?.delivered.delete(name)`
   - Firehose: `emitAdmin({ type: "member_remove", group, name })`,
     `emitAdmin(groupUpsertEvent(group))`, `emitAdmin(identityUpsertEvent(target))` —
     the same three events `leave` emits.
4. **Online notice (decision 2)**: `const live = liveConnsFor(target)`; if non-empty,
   `for (const c of live) c.send({ t: "evicted", group, to_identity: target })`. If the
   target is offline (`live` empty), nothing is sent — exactly "only if online".
5. Ack the console: `conn.send({ t: "member_removed", rid, group, name })`.

## Adapter implementation (`group-chat/adapter.ts`)

New inbound branch in the hub-frame dispatch (alongside `frame.t === "message"`):

```
if (frame.t === "evicted") {
  if (!gateAllows(frame.to_identity)) return;   // not our session
  void pushEvictionNotice(frame.group);
  return;
}
```

`pushEvictionNotice` mirrors `pushAdapterStatus` (a hub-independent
`notifications/claude/channel` push) with a distinct `notice="group-removed"` meta and
`role="system"`, content stating plainly that this session was removed from
`<group>` and will no longer receive its messages or be able to post to it.

**Crucially this does NOT need the reconnect-notice poll-until-acked / engagement
pre-flight machinery** (`runReconnectNotice`, `transcriptHasNotice`). That machinery
exists solely to defeat the post-`oninitialized` channel-subscription race on a
**fresh** adapter process. A kicked member is by definition an **already-engaged,
already-subscribed** session (it has been receiving this group's messages), so a
single `pushChannel`-style push delivers — exactly like a normal inbound group
`message`. Reusing the simple path is correct and intended.

## Web implementation

### `web/src/lib/protocol.ts`

- Add the client frame to the outbound union: `{ t: "remove_member"; group: string; name: string }`.
- `MemberRemove` (inbound `member_remove` event) **already exists** and already updates
  the store — the kicked member vanishes from the list reactively when the firehose
  event arrives. No store change needed.

### `web/src/lib/actions.ts`

```
export function removeMember(group: string, name: string): void {
  send({ t: "remove_member", group, name })
}
```

### `web/src/pages/group-members.tsx`

Add a remove control to each member row **except your own** (`m.owner !== selfIdentity()`).
On click: `e.preventDefault(); e.stopPropagation(); removeMember(group(), m.name)` —
**immediate**, no confirm (decision 3). The row already stops navigation propagation
for the DM button; the remove button follows the same pattern. The list updates when
the `member_remove` firehose event echoes back (do not optimistically mutate the
store — keep it server-authoritative, consistent with the rest of the console).

## Goals to verify at the end

1. A console (`._admin`) `remove_member{group,name}` deletes that member's group
   handle; the member disappears from `list_members` and from every firehose snapshot.
2. A **non-`._admin`** connection sending `remove_member` is rejected with
   `admin_forbidden` and changes nothing.
3. Removing an **already-absent** member is an idempotent no-op success (no error, no
   spurious events).
4. A kicked member that is **online** receives exactly one `group-removed` notice in
   its session; an **offline** kicked member receives nothing.
5. After a kick, the target can **no longer `send`** to that group (the membership
   check fails) even on a still-open connection — its `joinedAs` was cleared on all
   live connections.
6. The web group-members page shows a remove control on other members' rows (not your
   own), and clicking it removes the member immediately with no confirm dialog.
7. The firehose emits `member_remove` + `group_upsert` + `identity_upsert` on a kick,
   so every subscribed console converges.

## Rejected alternatives

- **Auto-expire detached handles (TTL).** Drop a member's group handles once its
  session has been detached longer than some TTL. Rejected: the human wants an
  explicit, on-demand action, not silent aging — and a TTL risks evicting a member
  during a legitimate long offline stretch (a resume, a reboot). Membership is meant
  to be **durable** (see docs/group-chat-durable-membership.md); silent expiry fights
  that. A kick is deliberate and observable.
- **Hoster CLI / direct sqlite delete.** Keep removal out of the UI; hoster deletes the
  handle row by hand. Rejected: the whole point is self-service from the console the
  human already has open; a DB poke also skips the in-memory `joinedAs`/`delivered`
  cleanup and the firehose events, leaving live state inconsistent until a restart.

---

## Appendix — verbatim design record

Byte-for-byte record of the human's contributing messages, so a future reader can
catch any contradiction between this doc and what was actually asked.

> Is it possible to remove a member from a group from the web ui?
> that way i can remove members that are stale

**Q (mechanism):** "How do you want stale-member removal to work?"
**A:** Web console kick button — *"Add a new privileged hub frame (e.g.
remove_member{group,name}) + a remove control on the group-members page. Any console
user could evict any member. Crosses the owner-scoping boundary — a new admin
capability."*

**Q (kick notice):** "When a currently-attached member is kicked, should their session
be told?"
**A:** only if online

**Q (confirm UX):** "Should the web kick button require a confirm step?"
**A:** Immediate
