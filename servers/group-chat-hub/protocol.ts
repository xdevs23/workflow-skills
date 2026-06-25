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

export const PROTOCOL_VERSION = 3;

// ---- adapter -> hub -------------------------------------------------------

export type ClientFrame =
  // first frame; authenticates the socket and binds the account. `host` is the
  // adapter's own device hostname (used to namespace registered aliases).
  | { t: "hello"; token: string; protocol: number; host: string }
  | { t: "list_groups" } // discover groups on the hub
  | { t: "create_group"; group: string } // explicit create (join also auto-creates)
  | { t: "join"; group: string; as: string } // join (or create+join) a group under name `as`
  | { t: "leave"; group: string; as?: string } // `as` disambiguates when one conn holds several handles in the group
  // `as` = which of this conn's handles to send as (multi-session on one socket).
  // `to` = optional group HANDLES to restrict the live push to (still logged for all).
  | { t: "send"; group: string; message: string; as?: string; to?: string[] }
  | { t: "list_members"; group: string }
  | { t: "show_member"; group: string; member: string }
  | { t: "history"; group: string; last_n: number; index_from_end: number } // pull scrollback
  | { t: "ack"; group: string; seq: number } // gap-resend bookkeeping: confirms received up to `seq`
  | { t: "read"; group: string; seq: number } // READ RECEIPT: this member surfaced message `seq` to its session
  // ---- identity / aliases (v3) ----
  | { t: "register_alias"; name: string } // claim <name>@<myhost>; dash-free [A-Za-z0-9_]{1,64}
  | { t: "release_alias"; name: string } // relinquish an owned alias
  | { t: "list_aliases" } // my own aliases (default + registered)
  | { t: "whoami" } // my session id, host, aliases
  | { t: "resolve_alias"; address: string } // resolve an address to a session id + online flag
  | { t: "list_directory" } // every known session id + aliases + groups + online
  // ---- direct messages (v3) ----
  | { t: "dm"; to: string; message: string } // send a DM to any address form
  | { t: "dm_history"; peer: string; last_n: number; index_from_end: number } // DM scrollback for a thread
  | { t: "dm_ack"; from_session: string; seq: number } // DM received (arrival ack)
  | { t: "dm_read"; from_session: string; seq: number } // DM read (surfaced by display hook)
  // ---- hook -> hub session correlation ----
  // Sent by the PreToolUse hook (after hello/welcome, on a transient connection)
  // to register the REAL session id of an in-flight tool call. The hub keeps a
  // Map<tool_use_id, session_id>; the adapter's frame for that same call carries
  // the bare `tool_use_id` and the hub resolves the account from this map. See
  // group-chat-session-resolution.md.
  | { t: "map_session"; tool_use_id: string; session_id: string }
  | { t: "ping" };

// ---- hub -> adapter -------------------------------------------------------

export interface ChatMessage {
  group: string;
  seq: number; // per-group monotonic
  from: string; // member name
  ts: string; // ISO timestamp
  msg_id: string;
  text: string;
}

export interface MemberInfo {
  name: string;
  // `attached` is live info — is a socket currently bound to this member right
  // now — NOT a durable online/offline state. A member stays a member whether or
  // not attached; absence just means "not currently connected", which we can't
  // interpret as gone. (Signal/WhatsApp model.)
  attached: boolean;
  joined_ts: string;
  last_seen_ts: string;
}

// A direct message. Threaded by the unordered pair of participant SESSION ids
// (aliases are only routing — history records the alias the sender used). `seq`
// is monotonic per session pair; `state` advances sent→received→read.
export interface DirectMessage {
  seq: number; // per session-pair monotonic
  from_session: string;
  from_alias: string; // the alias the sender used to send (their own identity)
  to_session: string;
  to_alias: string; // the alias the message was addressed to
  ts: string; // ISO timestamp
  msg_id: string;
  text: string;
  state: "sent" | "received" | "read";
}

// A directory entry: one known session id with its aliases + group memberships,
// marked online when a live connection is currently bound to it.
export interface DirectoryEntry {
  session_id: string;
  host: string; // the host last reported for this session (default alias host)
  aliases: string[]; // registered alias names (host-qualified form rendered by the adapter)
  groups: string[]; // group names this session currently holds a handle in
  online: boolean;
}

// Frames carry a `rid` (request id) when they answer a specific client request,
// so the adapter can match a reply to the tool call that is awaiting it.
export type ServerFrame =
  | { t: "welcome"; protocol: number } // hello accepted
  | { t: "error"; rid?: string; code: string; message: string }
  | { t: "message"; msg: ChatMessage } // a live (or gap-resent) chat message to push as <channel>
  | { t: "groups"; rid?: string; groups: { name: string; members: number }[] }
  | { t: "joined"; rid?: string; group: string; as: string }
  | { t: "left"; rid?: string; group: string }
  | { t: "created"; rid?: string; group: string }
  | { t: "members"; rid?: string; group: string; members: MemberInfo[] }
  | { t: "member"; rid?: string; group: string; member: MemberInfo | null }
  | { t: "history"; rid?: string; group: string; messages: ChatMessage[] }
  // reply to a `send`: read = members who confirmed surfacing the message within
  // the read-receipt window; sent = the rest of the group (offline or slower
  // than the window — no positive confirmation, message still logged + fanned out)
  | { t: "sent"; rid?: string; group: string; seq: number; read: string[]; sent: string[] }
  // ---- identity / aliases (v3) ----
  | { t: "aliases"; rid?: string; aliases: string[] } // reply to list_aliases (host-qualified)
  | { t: "whoami"; rid?: string; session_id: string; host: string; aliases: string[] }
  | { t: "resolved"; rid?: string; address: string; session_id: string | null; online: boolean }
  | { t: "directory"; rid?: string; entries: DirectoryEntry[] }
  // ---- direct messages (v3) ----
  // reply to a `dm`: `read` iff the target was online & surfaced it in the
  // window, else `sent` (accepted/queued). No async read receipt is pushed later.
  | { t: "dm_sent"; rid?: string; seq: number; state: "sent" | "read" }
  | { t: "dm_message"; msg: DirectMessage } // a DM to surface as a <channel> direct message
  | { t: "dm_history"; rid?: string; peer_session: string; messages: DirectMessage[] }
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
// and lets a trusted in-process driver/test assert identity without the hook. The
// real adapter no longer sends it — it sends `tool_use_id` instead.
export type ClientEnvelope = ClientFrame & {
  rid?: string;
  session?: string;
  tool_use_id?: string;
};
