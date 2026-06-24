// Shared wire protocol between the group-chat hub and the per-instance channel
// adapter. Both ends import these types so the contract stays in one place.
//
// Transport: a single WebSocket per adapter (one Claude instance). The adapter
// may be joined to several groups over that one socket; every frame that is
// group-scoped therefore names its `group`.
//
// Delivery model (design decision B): the hub does NOT replay history on join.
// A member receives only messages broadcast while it is live in a group. To
// make "no missed messages while live" a real guarantee despite unacknowledged
// delivery, the hub stamps every message with a per-group monotonic `seq`,
// fans out only after the log append, and on reconnect re-sends the gap of
// messages whose seq is newer than what the connection last acked.

export const PROTOCOL_VERSION = 1;

// ---- adapter -> hub -------------------------------------------------------

export type ClientFrame =
  | { t: "hello"; token: string; protocol: number } // first frame; authenticates the socket
  | { t: "list_groups" } // discover groups on the hub
  | { t: "create_group"; group: string } // explicit create (join also auto-creates)
  | { t: "join"; group: string; as: string } // join (or create+join) a group under name `as`
  | { t: "leave"; group: string }
  | { t: "send"; group: string; message: string } // broadcast to everyone in `group`
  | { t: "list_members"; group: string }
  | { t: "show_member"; group: string; member: string }
  | { t: "history"; group: string; last_n: number; index_from_end: number } // pull scrollback
  | { t: "ack"; group: string; seq: number } // connection confirms it received up to `seq` in `group`
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
  status: "online" | "offline";
  joined_ts: string;
  last_seen_ts: string;
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
  | { t: "ok"; rid?: string }
  | { t: "pong" };

// The adapter tags its requests with a rid by wrapping the ClientFrame:
export type ClientEnvelope = ClientFrame & { rid?: string };
