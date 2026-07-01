// The slice of the group-chat hub wire protocol (v7) the web console speaks. This
// MIRRORS servers/group-chat-hub/protocol.ts — kept as the web package's own file so
// web/ stays a self-contained build (its own package.json / tsconfig). Only the
// frames the browser sends or the events it applies are declared here.

// ── hub → browser: the admin event family (snapshot replay AND live tail) ──

export interface ChatMessage {
  group: string
  seq: number // per-group monotonic
  from: string // member (handle local part) name
  ts: string // ISO timestamp
  msg_id: string
  text: string
  reply_to?: number // seq of the message this replies to (omitted for non-replies)
  to?: string[] // member names this was push-targeted to (omitted for a broadcast)
  role?: Role // author's DERIVED role (roleForIdentity of from_identity). The web reads
  // role off identity_upsert, not here, but it is on the wire — kept to honor the mirror.
}

export interface DirectMessage {
  seq: number // per identity-pair monotonic
  from_identity: string
  from_alias: string
  to_identity: string
  to_alias: string
  ts: string // ISO timestamp
  msg_id: string
  text: string
  state: "sent" | "received" | "read"
  role?: Role // sender's DERIVED role (roleForIdentity of from_identity); on the wire,
  // mirrored for completeness — the web badges humans off identity_upsert instead.
}

// The DERIVED identity role (mirrors the hub's `Role`). Open enum: "human" (owns a
// `._admin` console handle), "agent" (the default), "system" (reserved). Computed by
// the hub via roleForIdentity — never stored — so the web can badge a human uniformly.
export type Role = "human" | "agent" | "system"

export interface IdentityUpsert {
  type: "identity_upsert"
  identity_id: string
  // aliases[0] is ALWAYS the default alias `<identity_id>@<host>` (the host lives
  // here, not in a standalone field), then registered-alias handles.
  aliases: string[]
  groups: string[]
  online: boolean
  role: Role // the identity's DERIVED role — lets the UI badge a human console identity
}

export interface GroupUpsert {
  type: "group_upsert"
  name: string
  members: number
}

export interface MemberUpsert {
  type: "member_upsert"
  group: string
  name: string
  owner: string
  attached: boolean
}

export interface MemberRemove {
  type: "member_remove"
  group: string
  name: string
}

export interface GroupRemove {
  type: "group_remove"
  name: string
}

export interface MessageAppend {
  type: "message_append"
  msg: ChatMessage
}

export interface DmAppend {
  type: "dm_append"
  msg: DirectMessage
}

export interface Presence {
  type: "presence"
  identity_id: string
  online: boolean
}

export interface SnapshotEnd {
  type: "snapshot_end"
}

export type AdminEvent =
  | IdentityUpsert
  | GroupUpsert
  | MemberUpsert
  | MemberRemove
  | GroupRemove
  | MessageAppend
  | DmAppend
  | Presence
  | SnapshotEnd

// ── hub → browser: the ServerFrame tags the browser reads ──

export type ServerFrame =
  | { t: "welcome"; protocol: number; adapter_id: string }
  | { t: "error"; rid?: string; code: string; message: string }
  | { t: "event"; event: AdminEvent }
  | { t: "ok"; rid?: string }
  | { t: "pong" }
  // Other v6 reply frames may arrive (e.g. `joined`, `sent`, `dm_sent`); the browser
  // does NOT depend on them for state (it mirrors via the event stream), so they are
  // accepted and ignored. A catch-all keeps the union honest without enumerating all.
  | { t: string; [k: string]: unknown }

// ── browser → hub: the frames the console sends ──
// Every account-bound frame carries `session` (the stable localStorage key) on the
// envelope — the direct-assertion binding path the hub honors without a PreToolUse
// hook. `rid` correlates a reply when one is awaited.

export type ClientFrame =
  | { t: "hello"; token: string; protocol: number; host: string; adapter_id?: string }
  | { t: "admin_subscribe" }
  | { t: "join"; group: string; as: string }
  | { t: "leave"; group: string }
  // PRIVILEGED (._admin only): remove ANOTHER member from a group (the web console kick).
  | { t: "remove_member"; group: string; name: string }
  // PRIVILEGED (._admin only): delete an ENTIRE group (the web console group delete).
  | { t: "delete_group"; group: string }
  | { t: "send"; group: string; message: string; to?: string[]; reply_to?: number }
  | { t: "dm"; to: string; message: string }
  | { t: "register_alias"; name: string }
  | { t: "release_alias"; name: string }
  | { t: "whoami" }
  | { t: "ping" }

export type ClientEnvelope = ClientFrame & {
  rid?: string
  session?: string
  adapter_id?: string
}

export const PROTOCOL_VERSION = 7
