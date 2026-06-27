// Shared wire protocol between the group-chat hub and the per-instance channel
// adapter. Both ends import these types so the contract stays in one place.
//
// Transport: a single WebSocket per adapter (one Claude instance). The adapter
// may be joined to several groups over that one socket; every frame that is
// group-scoped therefore names its `group`.
//
// Delivery model (design decision B): the hub does NOT replay group history on
// join. A member receives only group messages broadcast while it is live in a
// group. To make "no missed messages while live" a real guarantee despite
// unacknowledged delivery, the hub stamps every message with a per-group
// monotonic `seq`, fans out only after the log append, and on reconnect re-sends
// the gap of messages whose seq is newer than what the connection last acked.
//
// v3 adds an IDENTITY LAYER on top of groups: every connection binds to an
// account (a real Claude Code session id) at `hello`, addressable by aliases,
// and sessions can DIRECT-MESSAGE one another by alias independent of groups.
// Unlike group messages, DMs are a DURABLE QUEUE — stored and delivered (one
// `<channel>` per DM) when the recipient reconnects, with sent→received→read
// receipt states. See group-chat-direct-messages.md for the full design.
//
// v4 UNIFIES handles: there is no separate "member" entity. An identity owns
// HANDLES; a group handle is just a handle whose string ends `@<group>._group`.
// Group membership is DERIVED (the identities owning a `@<group>._group` handle),
// not a separate registry. Consequences on the wire: `join` still carries the
// chosen `as`, but `leave`/`send`/`list_members` carry only `group` — the hub
// resolves the calling identity (from `tool_use_id`) to its one handle in the
// group. A session has one identity, so it has at most one handle per group; the
// per-message `as` and the "which handle?" disambiguation are gone. Group ops now
// REQUIRE a resolved identity (they own/derive handles), and a collision on a
// handle owned by a different identity is `handle_taken`. See
// docs/group-chat-unified-handles.md.
//
// v5 adds RECONNECT IDENTITY: a per-process `adapter_id`. The hub mints a UUID
// on first connect and returns it in `welcome`; the adapter holds it in memory
// and echoes it on every subsequent `hello`. The hub keeps a DURABLE lease
// (`adapter_sessions`, one row per (adapter_id, session) the adapter serves),
// so on reconnect — including a HUB RESTART — the hub re-binds all the sessions
// that adapter was serving with no tool call, restoring delivery routes and push
// delivery. See docs/group-chat-adapter-reconnect.md.
//
// v6 DECOUPLES IDENTITY FROM SESSION (and adds reply-to). The hub mints an opaque
// `identity_id` per identity and maps `session_key -> identity_id`; a session is a
// pure socket credential. Wire fields that named a session id now name an IDENTITY
// id (`whoami.identity_id`, `resolved.identity_id`, `directory.identity_id`,
// `dm.from_identity`/`to_identity`, `dm_history.peer_identity`, the dm_ack/dm_read
// `from_identity`). The group `message` frame GAINS `to_identity` (the stamped
// recipient identity, for the adapter's delivery gate). `submit_message`/`send`
// gains an optional `reply_to: <seq>`, pushed only to that message's author. Two
// new frames: `release_session{session_key}` (a /resume's SessionEnd → hub drops
// the old session) and the `sent.warning` field (author-left reply). The ONE place
// a real session key crosses the wire is `map_session.session_id`, which now
// carries the composite `"<session_id>[:<agent_id>]"` (opaque to the hub). See
// docs/group-chat-identity-decouple.md.

export const PROTOCOL_VERSION = 6;

// ---- adapter -> hub -------------------------------------------------------

export type ClientFrame =
  // first frame; authenticates the socket and binds the account. `host` is the
  // adapter's own device hostname (used to namespace registered aliases).
  // `adapter_id` is OPTIONAL: omitted on first connect (the hub mints one and
  // returns it in `welcome`); present on every reconnect (the held id), so the
  // hub recognizes the same per-process relay endpoint and re-binds its leased
  // sessions. See docs/group-chat-adapter-reconnect.md.
  | { t: "hello"; token: string; protocol: number; host: string; adapter_id?: string }
  | { t: "list_groups" } // discover groups on the hub
  | { t: "create_group"; group: string } // explicit create (join also auto-creates)
  | { t: "join"; group: string; as: string } // join (or create+join) a group under name `as` (registers the handle <as>@<group>._group owned by the caller's identity)
  | { t: "leave"; group: string } // leave the group: drops the caller identity's <*>@<group>._group handle (unambiguous — one handle per identity per group)
  // The hub resolves the sender's handle from the caller's identity (no `as`).
  // `to` = optional MEMBER NAMES to restrict the live push to (still logged for all).
  // `reply_to` = optional seq of a prior message in this group: the reply is logged
  // for all but pushed ONLY to that message's author (or nobody if they left).
  | { t: "send"; group: string; message: string; to?: string[]; reply_to?: number }
  | { t: "list_members"; group: string }
  | { t: "show_member"; group: string; member: string }
  | { t: "history"; group: string; last_n: number; index_from_end: number } // pull scrollback
  | { t: "ack"; group: string; seq: number } // gap-resend bookkeeping: confirms received up to `seq`
  | { t: "read"; group: string; seq: number } // READ RECEIPT: this member surfaced message `seq` to its session
  // ---- identity / aliases (v3) ----
  | { t: "register_alias"; name: string } // claim <name>@<myhost>; dash-free [A-Za-z0-9_]{1,64}
  | { t: "release_alias"; name: string } // relinquish an owned alias
  | { t: "list_aliases" } // my own aliases (default + registered)
  | { t: "whoami" } // my identity id, host, aliases
  | { t: "resolve_alias"; address: string } // resolve an address to an identity id + online flag
  | { t: "list_directory" } // every known identity id + aliases + groups + online
  // ---- direct messages (v3) ----
  | { t: "dm"; to: string; message: string } // send a DM to any address form
  | { t: "dm_history"; peer: string; last_n: number; index_from_end: number } // DM scrollback for a thread
  // dm_ack/dm_read are ATTRIBUTION-ONLY: `from_identity` names the SENDER's identity;
  // the envelope's `session` field carries the RECIPIENT's identity so the hub threads
  // the receipt. They never bind/supersede/release.
  | { t: "dm_ack"; from_identity: string; seq: number } // DM received (arrival ack)
  | { t: "dm_read"; from_identity: string; seq: number } // DM read (surfaced by display hook)
  // ---- hook -> hub session correlation ----
  // Sent by the PreToolUse hook (after hello/welcome, on a transient connection)
  // to register the REAL session KEY of an in-flight tool call. `session_id` carries
  // the composite `"<session_id>[:<agent_id>]"` (opaque to the hub — the one place a
  // real session key crosses the wire). The hub keeps Map<tool_use_id, session_key>;
  // the adapter's frame for that same call carries the bare `tool_use_id` and the hub
  // resolves the key (then its identity) from this map. See
  // group-chat-session-resolution.md / group-chat-identity-decouple.md.
  | { t: "map_session"; tool_use_id: string; session_id: string }
  // Sent by the SessionEnd hook on a genuine /resume (or /clear): release the OLD
  // session key so it stops receiving pushes. Idempotent. See the decouple doc.
  | { t: "release_session"; session_key: string }
  | { t: "ping" };

// ---- hub -> adapter -------------------------------------------------------

export interface ChatMessage {
  group: string;
  seq: number; // per-group monotonic
  from: string; // member name
  ts: string; // ISO timestamp
  msg_id: string;
  text: string;
  reply_to?: number; // seq of the message this one replies to (omitted for non-replies)
  to?: string[]; // member names this was push-TARGETED to (omitted for a plain broadcast).
  // Display-only: surfaces the `to:` directed-push targeting to the recipient as a marker.
  // The push is still directed by the hub's fan-out; this just makes targeting legible.
}

// A group member is DERIVED from a handle `<name>@<group>._group`; there is no
// separate member entity. `name` is the handle's local part. `attached` is live
// info — does the OWNING identity have a connection bound right now — NOT a
// durable online/offline state. Membership is durable (the handle row); absence
// of a live connection just means "not currently connected". (Signal/WhatsApp
// model.) `joined_ts`/`last_seen_ts` both reflect the handle's created_ts (we no
// longer track a separate per-member last-seen).
export interface MemberInfo {
  name: string;
  attached: boolean;
  joined_ts: string;
  last_seen_ts: string;
}

// A direct message. Threaded by the unordered pair of participant IDENTITY ids
// (aliases are only routing — history records the alias the sender used). `seq`
// is monotonic per identity pair; `state` advances sent→received→read.
export interface DirectMessage {
  seq: number; // per identity-pair monotonic
  from_identity: string;
  from_alias: string; // the alias the sender used to send (their own identity)
  to_identity: string;
  to_alias: string; // the alias the message was addressed to
  ts: string; // ISO timestamp
  msg_id: string;
  text: string;
  state: "sent" | "received" | "read";
}

// A directory entry: one known identity with its aliases + group memberships,
// marked online when a live connection is currently bound to it.
export interface DirectoryEntry {
  identity_id: string;
  host: string; // the host last reported for this identity (default alias host)
  aliases: string[]; // registered alias names (host-qualified form rendered by the adapter)
  groups: string[]; // group names this identity currently holds a handle in
  online: boolean;
}

// Frames carry a `rid` (request id) when they answer a specific client request,
// so the adapter can match a reply to the tool call that is awaiting it.
export type ServerFrame =
  // hello accepted. `adapter_id` is the per-process relay id: the one the adapter
  // sent (reconnect) or a freshly minted UUID (first connect). The adapter holds
  // it and echoes it on every later `hello`.
  | { t: "welcome"; protocol: number; adapter_id: string }
  | { t: "error"; rid?: string; code: string; message: string }
  // a live (or gap-resent) chat message to push as <channel>. `to_identity` is the
  // STAMPED recipient identity (the identity this copy is destined for) — the
  // adapter's delivery gate drops it unless it currently serves that identity.
  | { t: "message"; msg: ChatMessage; to_identity: string }
  | { t: "groups"; rid?: string; groups: { name: string; members: number }[] }
  | { t: "joined"; rid?: string; group: string; as: string }
  | { t: "left"; rid?: string; group: string }
  | { t: "created"; rid?: string; group: string }
  | { t: "members"; rid?: string; group: string; members: MemberInfo[] }
  | { t: "member"; rid?: string; group: string; member: MemberInfo | null }
  | { t: "history"; rid?: string; group: string; messages: ChatMessage[] }
  // reply to a `send`: read = members who confirmed surfacing the message within
  // the read-receipt window; sent = the rest of the group (offline or slower
  // than the window — no positive confirmation, message still logged + fanned out).
  // `warning` is set only for a reply-to whose author left the group (or was
  // pre-migration): the reply was logged but pushed to no one — it names where the
  // author can be reached.
  | {
      t: "sent";
      rid?: string;
      group: string;
      seq: number;
      read: string[];
      sent: string[];
      warning?: string;
    }
  // ---- identity / aliases (v3) ----
  | { t: "aliases"; rid?: string; aliases: string[] } // reply to list_aliases (host-qualified)
  | { t: "whoami"; rid?: string; identity_id: string; host: string; aliases: string[] }
  | { t: "resolved"; rid?: string; address: string; identity_id: string | null; online: boolean }
  | { t: "directory"; rid?: string; entries: DirectoryEntry[] }
  // ---- direct messages (v3) ----
  // reply to a `dm`: `read` iff the target was online & surfaced it in the
  // window, else `sent` (accepted/queued). No async read receipt is pushed later.
  | { t: "dm_sent"; rid?: string; seq: number; state: "sent" | "read" }
  | { t: "dm_message"; msg: DirectMessage } // a DM to surface as a <channel> direct message
  | { t: "dm_history"; rid?: string; peer_identity: string; messages: DirectMessage[] }
  | { t: "ok"; rid?: string }
  | { t: "pong" };

// The adapter tags its requests with a rid by wrapping the ClientFrame. For
// account-bound ops it attaches the bare `tool_use_id` (the `_meta` toolUseId of
// the in-flight call); the hub correlates that id to the REAL session id via the
// Map populated by the PreToolUse hook's `map_session` frame, then binds the
// connection's account exactly as it would from a directly-asserted session. The
// hub never invents identity. See group-chat-session-resolution.md.
//
// `session` is retained as an OPTIONAL direct-assertion path (the hub binds it
// verbatim when present): it is what the hub binds AFTER resolving a tool_use_id,
// and lets a trusted in-process driver/test assert identity without the hook. For
// account-bound group/identity ops the real adapter no longer sends it — it sends
// `tool_use_id` instead — but it DOES still send `session` on `dm_ack`/`dm_read`,
// where the field carries the RECIPIENT's identity id for receipt attribution
// (see those frames in `ClientFrame`).
export type ClientEnvelope = ClientFrame & {
  rid?: string;
  session?: string;
  tool_use_id?: string;
};
