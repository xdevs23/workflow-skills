# Group-chat: web-console group deletion

## Problem

Once a group is created it lives **forever**. `join`/`create_group` insert a row into
the durable `groups` table (hub.ts) and there is **no client frame that removes one** —
not a missing button, a missing capability. The closest thing, `leave`/`remove_member`,
only drops a single `<name>@<group>._group` **handle**; the `groups` row, the group's
stored `messages`, and the in-memory `Group` (window + delivered cursors) all persist.
So an abandoned or mistakenly-named group clutters the directory, the sidebar's
Suggested-groups, and the firehose snapshot indefinitely; the only cleanup is the
hoster hand-deleting rows from the hub sqlite.

This feature adds a **privileged group deletion**: the web console can delete an entire
group — its `groups` row, **every** member handle, **all** its messages, and its
in-memory state — in one action. It is the group-level sibling of the member kick
(docs/group-chat-member-removal.md): "kick every member + drop the group + drop its
history." Like the kick, it deliberately crosses the owner-scoping boundary the rest of
the design draws and is gated to the console.

## Decisions (set by the human)

| # | Decision | Choice |
|---|----------|--------|
| 1 | Mechanism | **Web console delete button** in the group thread header. |
| 2 | Message history on delete | **Delete everything.** Drop the `groups` row, all member handles, AND all stored `messages`. A same-named group recreated later starts fresh (seq from 1, no resurrected history). |
| 3 | Confirm step in the UI | **`confirm()` dialog**, mirroring the existing Leave action (not immediate, not type-to-confirm). |
| 4 | Notify online members | **Only if online.** Reuse the existing per-member `evicted` notice for each member's live connections; offline members are told nothing. |

## Authorization

Reuse the **existing** `._admin`-ownership predicate — the same gate as
`admin_subscribe` and `remove_member`. No new flag, no schema change; the console/admin
distinction stays **behavioral/capability**, not a stored boolean.

A `delete_group` frame is honored **only if** `stmt.selectAdminHandleForOwner.get(caller)`
returns a row; otherwise the hub replies `err(conn, "admin_forbidden", ...)`, exactly as
`admin_subscribe`/`remove_member` do. (v1 has no browser auth — the `._admin` suffix is
the seam where auth gets added later.)

## Data model

**No schema change.** Deletion removes rows from three existing tables and the in-memory
`groups` map:

- `handles` — every `%@<group>._group` row (matched via `groupHandlePattern(group)`,
  the same escaped-LIKE pattern `membersOf` uses).
- `messages` — every row `WHERE group_name = <group>`.
- `groups` — the single `WHERE name = <group>` row.
- in memory — `groups.delete(group)` (drops the `Group`'s `window` and `delivered`).

The three DB deletes MUST run in **one `db.transaction(...)`** so a crash mid-delete
can't leave a group row without its handles (or vice-versa). Model it on the existing
`assignAndInsertMessage`/`assignAndInsertDm` transaction closures (hub.ts ~line 622).

## Protocol changes (`servers/group-chat-hub/protocol.ts`)

### New client→hub frame

```
| { t: "delete_group"; group: string } // PRIVILEGED (._admin only): delete an ENTIRE
  // group — its groups row, every <name>@<group>._group handle, all its messages, and
  // its in-memory Group. The group-level sibling of remove_member. Honored only for a
  // connection that owns an `._admin` handle (same gate as admin_subscribe); else the
  // hub replies err `admin_forbidden`. Deleting an absent group is an idempotent no-op
  // success. See docs/group-chat-group-deletion.md.
```

Reply to the calling console: `{ t: "group_deleted"; rid?; group }` (success), or
`err(... "admin_forbidden")`.

### New firehose event: `group_remove`

The kick reuses `member_remove`, but there is **no** group-scoped removal event yet.
Add one, sibling to `MemberRemove`:

```
export interface GroupRemove {
  type: "group_remove"
  name: string
}
```

…added to the `AdminEvent` union (in BOTH `servers/group-chat-hub/protocol.ts` and the
web mirror `web/src/lib/protocol.ts`). The client reducer folds it into a single store
mutation that drops the group, all its members, and its thread (see web section) — so
we do **not** additionally emit per-member `member_remove` events for a delete; one
`group_remove` carries the whole group's removal.

### Reuse the existing `evicted` frame (decision 4)

No new adapter frame. The hub already has
`{ t: "evicted"; group; to_identity }` (the kick's online notice), and the adapter
already handles it (gate → `pushEvictionNotice`). A deleted group's members are removed
from the group exactly as a kick removes one, so the same "you were removed from
'<group>'" notice is semantically correct. **No adapter change is required.**

## Hub implementation (`servers/group-chat-hub/hub.ts`)

### New prepared statements (in the `stmt` block)

```
deleteGroupHandles:  db.query("DELETE FROM handles WHERE handle LIKE ? ESCAPE '\\'"),
deleteGroupMessages: db.query("DELETE FROM messages WHERE group_name = ?"),
deleteGroupRow:      db.query("DELETE FROM groups WHERE name = ?"),
```

### One transaction closure (near `assignAndInsertMessage`)

```
const deleteGroupTx = db.transaction((group: string): void => {
  stmt.deleteGroupHandles.run(groupHandlePattern(group));
  stmt.deleteGroupMessages.run(group);
  stmt.deleteGroupRow.run(group);
});
```

### New `case "delete_group"` handler (modeled on `case "remove_member"`)

1. **Authorize**: `const caller = requireIdentity(conn, rid)`; then require
   `stmt.selectAdminHandleForOwner.get(caller)` — else `err(... "admin_forbidden")`.
2. **Idempotent no-op if absent**: if `!groups.has(frame.group)` →
   `conn.send({ t: "group_deleted", rid, group })` and return. (`groups` mirrors the
   durable table — `recoverGroups` loads it at boot, `getOrCreateGroup` keeps them in
   sync, nothing else deletes from it — so it is the authoritative liveness check,
   matching how `remove_member` treats an already-gone handle.)
3. **Snapshot members BEFORE deleting**: `const members = membersOf(frame.group)` and
   `const owners = new Set(members.map((m) => m.owner))`. Needed after deletion for
   `joinedAs` cleanup, per-owner `identity_upsert`, and the online notices — the same
   "snapshot once, nothing mutates it in between" reasoning as the kick.
4. **Delete durable state**: `deleteGroupTx(frame.group)`.
5. **Delete in-memory state**: `groups.delete(frame.group)`.
6. **Clean `joinedAs` on every live connection of every member**: for each
   `m of members`, for each `c of liveConnsFor(m.owner)`, `c.joinedAs.delete(frame.group)`
   (delete the whole group key — the group is gone, not just one name). This is what
   stops any still-open member connection from `send`-ing to the dead group.
7. **Firehose**: `emitAdmin({ type: "group_remove", name: frame.group })`, then for each
   `owner of owners` `emitAdmin(identityUpsertEvent(owner))` (each member's group set
   shrank — same shape as the kick's per-target `identity_upsert`, now one per distinct
   owner). Do **not** emit `groupUpsertEvent` (the group no longer exists) nor per-member
   `member_remove` (subsumed by `group_remove`).
8. **Online notices (decision 4)**: for each `m of members`, for each
   `c of liveConnsFor(m.owner)`, `c.send({ t: "evicted", group: frame.group, to_identity: m.owner })`.
   Offline members (no live conns) get nothing. (Snapshot `liveConnsFor` per owner once
   and reuse it for steps 6 and 8, exactly like the kick reuses its `live` array.)
9. **Ack the console**: `conn.send({ t: "group_deleted", rid, group: frame.group })`.

## Adapter implementation (`group-chat/adapter.ts`)

**None.** The `evicted` frame + `pushEvictionNotice` already exist and are reused
verbatim. (Do not touch adapter.ts — editing it forces a full Claude Code restart.)

## Web implementation

### `web/src/lib/protocol.ts`

- Add the outbound client frame: `{ t: "delete_group"; group: string }`.
- Add `GroupRemove` interface + add it to the `AdminEvent` union (mirror the hub).

### `web/src/store/store.ts`

New `case "group_remove"` in `applyEvent`, one `produce` mutation that removes the
group and everything scoped to it (so no dangling references break the selectors):

```
case "group_remove": {
  setStore(produce((s) => {
    delete s.groups[event.name]
    for (const key of Object.keys(s.members))
      if (s.members[key]?.group === event.name) delete s.members[key]
    delete s.threads[event.name]
  }))
  return
}
```

(The console's own `self.groups` array shrinks via the `identity_upsert` the hub emits
per owner, so `joinedGroups`/`conversations` drop the group reactively too.)

### `web/src/lib/actions.ts`

```
// PRIVILEGED: delete an entire group (console only). The group + its members + thread
// vanish when the `group_remove` firehose event echoes back — no optimistic mutation.
export function deleteGroup(group: string): void {
  send({ t: "delete_group", group })
}
```

### `web/src/pages/group-thread.tsx`

Add a **danger** trash `IconButton` to the thread header `actions`, alongside
Members/Leave/Search, shown regardless of joined state (a console can delete any group).
Guard with a `confirm()` (decision 3), mirroring the existing `confirmLeave`:

```
function confirmDelete() {
  if (confirm(`Delete “${group()}” for everyone? This removes the group, all members, and its entire message history. This cannot be undone.`)) {
    deleteGroup(group())
    navigate("/")
  }
}
```

Use a `Trash2` icon from `lucide-solid/icons/trash-2`, `<IconButton danger …>`. The
group + thread vanish when the `group_remove` firehose event echoes back — do not
optimistically mutate the store (server-authoritative, consistent with the rest of the
console).

## Plugin version

Bump `.claude-plugin/plugin.json` `version` `0.3.0` → `0.4.0` (a new privileged
capability, mirroring the kick's `0.2.x` → `0.3.0` bump).

## Goals to verify at the end

1. A console (`._admin`) `delete_group{group}` deletes the `groups` row, **every**
   `%@<group>._group` handle, and **every** `messages` row for that group, atomically
   (transaction), and removes the in-memory `Group`.
2. A **non-`._admin`** connection sending `delete_group` is rejected with
   `admin_forbidden` and changes nothing.
3. Deleting an **absent** group is an idempotent no-op success (no error, no events).
4. The firehose emits **one `group_remove`** plus one `identity_upsert` per distinct
   former member owner; it emits **no** `group_upsert` and **no** `member_remove` for the
   delete. Every subscribed console's store drops the group, its members, and its thread.
5. Each member that is **online** receives exactly one `group-removed` notice in its
   session; **offline** members receive nothing.
6. After deletion, a former member can **no longer `send`** to the group even on a
   still-open connection (its `joinedAs` group key was cleared, and the group is gone).
7. A same-named group **recreated** after deletion starts fresh: member count 0, seq
   from 1, no resurrected messages.
8. The web group thread header shows a danger delete button; clicking it and confirming
   deletes the group and navigates home; dismissing the `confirm()` does nothing.
9. After a hub **restart**, a deleted group does **not** reappear (`recoverGroups` finds
   no row).

## Rejected alternatives

- **Keep messages orphaned (drop group + handles only).** Rejected by decision 2: a
  same-named group would then resume old seq numbers (`groupHead` reads `MAX(seq)` from
  `messages`), and orphaned rows accumulate with no UI to reach them. "Delete" should
  mean gone.
- **Reuse `member_remove` per member instead of a new `group_remove` event.** Would work
  (N `member_remove` + a client-side "group now empty → drop it" heuristic) but leaves
  the empty `groups` row/entry on every console until a `group_upsert(0)` and needs the
  client to infer group death. A single explicit `group_remove` is unambiguous and
  idempotent, and matches the durable-delete intent.
- **Hoster CLI / direct sqlite delete.** Same rejection as the kick: skips the in-memory
  `joinedAs`/`delivered` cleanup and the firehose events, leaving live state inconsistent
  until a restart; and the point is self-service from the console already open.
- **Type-to-confirm / no-confirm.** Decision 3 chose a plain `confirm()` — stronger than
  the kick's immediate action (deletion is heavier and hits everyone) but without the
  friction of a type-the-name modal.

---

## Appendix — verbatim design record

Byte-for-byte record of the human's contributing messages, so a future reader can catch
any contradiction between this doc and what was actually asked.

> Make it possible for me to delete a group from the web UI

**Q (History — message history on delete):** "When a group is deleted, what happens to
its message history in the DB?"
**A:** Delete everything (drop the group row, all member handles, AND all its stored
messages; a recreated same-named group starts fresh).

**Q (Placement — where the delete control lives + confirmation):** "Where should the
delete control live, and how much confirmation?"
**A:** Thread header, `confirm()` (a danger trash icon in the group thread header,
guarded by a browser `confirm()` dialog like the existing Leave action; deletes
regardless of joined state; navigates home on success).
