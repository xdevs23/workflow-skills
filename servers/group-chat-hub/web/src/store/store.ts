import { createStore, produce, reconcile } from "solid-js/store"
import type { AdminEvent } from "../lib/protocol"
import { emptyStore, memberKey, dmKey, type ChatStore } from "./types"

// The single store mirroring hub state. One reducer (`applyEvent`) handles BOTH the
// snapshot replay and the live tail — they are the same idempotent-upsert frames.
const [store, setStore] = createStore<ChatStore>(emptyStore())

export { store }

// Reset to a clean slate. Called when a NEW connection begins its snapshot, so a
// reconnect re-snapshots to identical state without stale entries lingering. Uses
// reconcile so existing UI references diff rather than tear down wholesale.
export function resetStore(): void {
  setStore(reconcile(emptyStore()))
}

// Apply one admin event to the store. Idempotent: replaying any event converges to
// the same state. This is the ONE read path — snapshot and live tail both call it.
export function applyEvent(event: AdminEvent): void {
  switch (event.type) {
    case "identity_upsert": {
      setStore(
        "identities",
        event.identity_id,
        reconcile({
          identity_id: event.identity_id,
          aliases: event.aliases,
          groups: event.groups,
          online: event.online,
          role: event.role,
        }),
      )
      return
    }
    case "presence": {
      // Fold the thin online/offline transition into the identity entry (create a
      // stub if the identity isn't known yet — a self-contained upsert).
      setStore(
        produce((s) => {
          const existing = s.identities[event.identity_id]
          if (existing) existing.online = event.online
          else
            s.identities[event.identity_id] = {
              identity_id: event.identity_id,
              aliases: [],
              groups: [],
              online: event.online,
              // presence is a thin online/offline transition with no role info; default
              // to "agent" until a full identity_upsert supplies the derived role.
              role: "agent",
            }
        }),
      )
      return
    }
    case "group_upsert": {
      setStore("groups", event.name, { name: event.name, members: event.members })
      return
    }
    case "member_upsert": {
      setStore("members", memberKey(event.group, event.name), {
        group: event.group,
        name: event.name,
        owner: event.owner,
        attached: event.attached,
      })
      return
    }
    case "member_remove": {
      setStore(
        produce((s) => {
          delete s.members[memberKey(event.group, event.name)]
        }),
      )
      return
    }
    case "message_append": {
      const msg = event.msg
      setStore(
        produce((s) => {
          let thread = s.threads[msg.group]
          if (!thread) {
            thread = { group: msg.group, messages: {} }
            s.threads[msg.group] = thread
          }
          thread.messages[msg.seq] = msg
        }),
      )
      return
    }
    case "dm_append": {
      const msg = event.msg
      const key = dmKey(msg.from_identity, msg.to_identity)
      setStore(
        produce((s) => {
          let thread = s.dms[key]
          if (!thread) {
            const [a, b] =
              msg.from_identity < msg.to_identity
                ? [msg.from_identity, msg.to_identity]
                : [msg.to_identity, msg.from_identity]
            thread = { key, a, b, messages: {} }
            s.dms[key] = thread
          }
          // A receipt state change (sent→received→read) re-emits the same seq — the
          // assignment upserts it.
          thread.messages[msg.seq] = msg
        }),
      )
      return
    }
    case "snapshot_end": {
      setStore("live", true)
      return
    }
  }
}
