import type { ChatMessage, DirectMessage } from "../lib/protocol"
import { store } from "./store"
import { dmKey, memberKey, type Identity, type Member } from "./types"

// Derived views over the mirrored store. Pure reads — they recompute reactively as
// the store changes (Solid tracks the property accesses).

// ── identities ──

export function identityList(): Identity[] {
  return Object.values(store.identities)
}

export function identityById(id: string): Identity | undefined {
  return store.identities[id]
}

// A short, human-facing label for an identity: the local part of its first REGISTERED
// alias if it has one, else a truncated id. aliases[0] is the default alias
// `<id>@<host>` whose local part is the id itself (no nicer than the short id), so we
// prefer a registered alias (aliases[1+]) for the label. Used for avatars/headers.
export function identityLabel(id: string): string {
  const ident = store.identities[id]
  const registered = ident?.aliases[1]
  if (registered) return registered.split("@")[0] ?? registered
  return id.slice(0, 8)
}

// The alias to show as an identity's subtitle: the one best matching the search query
// (whole-alias substring match, host part included), else the first registered alias,
// else the default alias `<id>@<host>` (aliases[0]). Never a host fallback — the host
// only exists as the domain part of an alias.
export function identitySubtitle(id: string, query?: string): string {
  const ident = store.identities[id]
  if (!ident || ident.aliases.length === 0) return id
  const q = query?.trim().toLowerCase()
  if (q) {
    const match = ident.aliases.find((a) => a.toLowerCase().includes(q))
    if (match) return match
  }
  // prefer a registered alias (aliases[1+]) over the default alias (aliases[0]).
  return ident.aliases[1] ?? ident.aliases[0] ?? id
}

// ── groups + members ──

export function groupList(): { name: string; members: number }[] {
  return Object.values(store.groups)
}

export function membersOf(group: string): Member[] {
  return Object.values(store.members).filter((m) => m.group === group)
}

// The group names the console identity currently holds a member handle in.
export function joinedGroups(selfId: string | null): string[] {
  if (!selfId) return []
  const self = store.identities[selfId]
  return self ? self.groups : []
}

// ── group messages ──

export function groupMessages(group: string): ChatMessage[] {
  const thread = store.threads[group]
  if (!thread) return []
  return Object.values(thread.messages).sort((a, b) => a.seq - b.seq)
}

export function lastGroupMessage(group: string): ChatMessage | undefined {
  const msgs = groupMessages(group)
  return msgs[msgs.length - 1]
}

// ── DMs ──

export function dmThreadMessages(selfId: string, peer: string): DirectMessage[] {
  const thread = store.dms[dmKey(selfId, peer)]
  if (!thread) return []
  return Object.values(thread.messages).sort((a, b) => a.seq - b.seq)
}

// Every identity the console has an existing DM thread with.
export function dmPeers(selfId: string | null): string[] {
  if (!selfId) return []
  const peers: string[] = []
  for (const thread of Object.values(store.dms)) {
    if (thread.a !== selfId && thread.b !== selfId) continue
    const peer = thread.a === selfId ? thread.b : thread.a
    peers.push(peer)
  }
  return peers
}

export function lastDmMessage(selfId: string, peer: string): DirectMessage | undefined {
  const msgs = dmThreadMessages(selfId, peer)
  return msgs[msgs.length - 1]
}

// ── conversation list (groups joined + DM threads), recency-ordered ──

export type Conversation =
  | { kind: "group"; id: string; name: string; ts: number; preview: string; who?: string }
  | { kind: "dm"; id: string; peer: string; name: string; ts: number; preview: string }

function tsMs(iso: string | undefined): number {
  if (!iso) return 0
  const n = Date.parse(iso)
  return Number.isNaN(n) ? 0 : n
}

export function conversations(selfId: string | null): Conversation[] {
  const out: Conversation[] = []
  for (const name of joinedGroups(selfId)) {
    const last = lastGroupMessage(name)
    out.push({
      kind: "group",
      id: `group:${name}`,
      name,
      ts: tsMs(last?.ts),
      preview: last?.text ?? "No messages yet",
      who: last?.from,
    })
  }
  if (selfId) {
    for (const peer of dmPeers(selfId)) {
      const last = lastDmMessage(selfId, peer)
      out.push({
        kind: "dm",
        id: `dm:${peer}`,
        peer,
        name: identityLabel(peer),
        ts: tsMs(last?.ts),
        preview: last?.text ?? "No messages yet",
      })
    }
  }
  return out.sort((a, b) => b.ts - a.ts)
}

// ── search across groups + identities ──

export interface SearchResults {
  groups: { name: string; members: number; joined: boolean }[]
  identities: Identity[]
}

export function search(query: string, selfId: string | null): SearchResults {
  const q = query.trim().toLowerCase()
  const joined = new Set(joinedGroups(selfId))
  const groups = groupList()
    .filter((g) => (q === "" ? true : g.name.toLowerCase().includes(q)))
    .map((g) => ({ name: g.name, members: g.members, joined: joined.has(g.name) }))
    .sort((a, b) => a.name.localeCompare(b.name))
  const identities = identityList()
    .filter((ident) => {
      if (selfId && ident.identity_id === selfId) return false
      if (q === "") return true
      // Match ONLY against alias strings (the WHOLE alias, host part included). Since
      // aliases[0] is the default alias `<id>@<host>`, a full identity_id paste still
      // matches exactly — but a short fragment like "a" no longer matches a raw id
      // hex such as "fed3a32f" (that is not "best-match surfacing", just noise), and
      // there is no standalone host field to match against.
      return ident.aliases.some((a) => a.toLowerCase().includes(q))
    })
    .sort((a, b) => identityLabel(a.identity_id).localeCompare(identityLabel(b.identity_id)))
  return { groups, identities }
}

// ── suggestions (left-sidebar "Suggested" section) ──

// Groups the console hasn't joined, surfaced most-recently-active first. ts is the
// last group message's ISO parsed to ms (0 when the group has no messages → sorts
// last). Top 5.
export function suggestedGroups(
  selfId: string | null,
): { name: string; members: number; ts: number }[] {
  const joined = new Set(joinedGroups(selfId))
  return groupList()
    .filter((g) => !joined.has(g.name))
    .map((g) => ({ name: g.name, members: g.members, ts: tsMs(lastGroupMessage(g.name)?.ts) }))
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 5)
}

// There is NO real last-seen timestamp in the hub (presence is boolean-only). We
// SYNTHESIZE a "recently active" signal per identity from the max ts across (a) every
// group-thread message it authored (resolving each message's `from` member name →
// owning identity via store.members) and (b) every DM thread it participates in. The
// whole table is built in ONE pass over store.threads + store.dms; rank a list by
// building it ONCE and reading it per item (not one pass per item).
function lastSeenMap(): Map<string, number> {
  const seen = new Map<string, number>()
  const bump = (id: string, ts: number) => {
    if (ts <= 0) return
    const prev = seen.get(id) ?? 0
    if (ts > prev) seen.set(id, ts)
  }
  for (const thread of Object.values(store.threads)) {
    for (const msg of Object.values(thread.messages)) {
      const owner = store.members[memberKey(thread.group, msg.from)]?.owner
      if (owner) bump(owner, tsMs(msg.ts))
    }
  }
  for (const thread of Object.values(store.dms)) {
    for (const msg of Object.values(thread.messages)) {
      const ms = tsMs(msg.ts)
      bump(msg.from_identity, ms)
      bump(msg.to_identity, ms)
    }
  }
  return seen
}

// Online identities worth suggesting a DM to: excludes self (the acting user knows
// its own id) and anyone already in a DM thread. Ordered by synthesized last-seen
// DESC. Top 5.
export function suggestedAgents(selfId: string | null): Identity[] {
  const already = new Set(dmPeers(selfId))
  const seen = lastSeenMap()
  return identityList()
    .filter((ident) => {
      if (!ident.online) return false
      if (selfId && ident.identity_id === selfId) return false
      if (already.has(ident.identity_id)) return false
      return true
    })
    .sort((a, b) => (seen.get(b.identity_id) ?? 0) - (seen.get(a.identity_id) ?? 0))
    .slice(0, 5)
}
