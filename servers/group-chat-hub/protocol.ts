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

// v7 adds the ADMIN EVENT STREAM (the web console). It is purely ADDITIVE: every
// v6 frame is untouched, and the hub still ACCEPTS a v6 hello (so the existing
// adapter, hooks and tests keep working verbatim) — v7 only UNLOCKS the new
// surface. A new client frame `admin_subscribe` asks the hub for an omniscient,
// ordered stream of everything it does, expressed as a tagged `event` family of
// IDEMPOTENT upserts (identity_upsert, group_upsert, member_upsert/remove,
// message_append, dm_append, presence, snapshot_end). The hub first replays a
// SNAPSHOT of durable state as those same events, then keeps pushing them LIVE for
// every mutation — snapshot and live tail are the SAME frames, so a client applies
// ONE code path. The browser binds the reserved `user@<host>._admin` identity (a
// new reserved suffix parallel to `._group`); `admin_subscribe` is honored only on
// a connection bound to an `._admin` identity. See docs/group-chat-web-frontend.md.

// v8 adds AGENT-TO-AGENT FILE TRANSFER. It is purely ADDITIVE: every v6/v7 frame is
// untouched, and the hub still ACCEPTS a v6/v7 hello (so the existing adapter, hooks,
// tests and web console keep working verbatim) — a pre-v8 client simply never offers
// or approves files. A sender OFFERS files alongside a normal `submit_message`
// (`send.attach`); the offer rides on the delivered `message` as `attachments` (name +
// size metadata only — NO bytes, NO path); a receiver APPROVES by seq (`approve_files`)
// and the hub replies per-file (`files_approved`). ONLY THEN do bytes move, over a
// SEPARATE streamed HTTP channel (`/xfer/<transfer_id>` on the hub) — never over this
// WebSocket. The hub wakes the two adapters with two SILENT control frames
// (`xfer_pull` → receiver, `xfer_push` → sender) handled WITHOUT an LLM notification,
// mirroring the inbound `dm_ack` silent-handler shape. The hub is a pure relay: it
// spools nothing to disk and reads nothing fully into memory. The receiver only ever
// writes a basename under `<CLAUDE_PROJECT_DIR>/.cache/received-files/`. See
// docs/group-chat-file-transfer.md.

export const PROTOCOL_VERSION = 8;
// The hub accepts a hello from any client speaking a protocol in this set. v8 is a
// strict superset of v6/v7 on the wire (additive frames only), so a v6/v7 client — the
// pre-v8 adapter, the hooks, the test harness, the web console — connects unchanged; it
// simply never sends the v8-only `attach`/`approve_files`/`xfer_*`. The check stays an
// explicit allow-set rather than `>=` so an unknown future/garbage version is still
// rejected honestly.
export const ACCEPTED_PROTOCOL_VERSIONS: readonly number[] = [6, 7, 8];

// ---- derived identity role (v7, additive) ---------------------------------
// The role of WHO is talking, so a receiving instance (and the web UI) can tell a
// HUMAN (the web console user) from an agent peer. It is DERIVED, never stored or
// declared: nobody sets a role, there is no role column / set_role frame / hello
// assertion. The hub computes it as a PURE FUNCTION of facts it already holds at the
// moment it builds an identity/message event (`roleForIdentity`). The enum is OPEN:
// adding a future role is one new derivation rule, no schema/wire change.
//   "human"  — the identity owns a `user@<host>._admin` handle (a web console).
//   "agent"  — every other identity (the unmarked default).
//   "system" — reserved for a future distinguishing fact (no rule today).
export type Role = "human" | "agent" | "system";

// ---- file transfer (v8) ---------------------------------------------------
// The OFFER SIDECAR carried per attachment on a `send`/`message`. Metadata ONLY:
//   - `transfer_id` is a hub-minted UUID (one per file, single-use), assigned when
//     the hub processes the `send`. It is the unguessable, hub-owned capability the
//     /xfer byte channel and the xfer_* control frames key off — NEVER sender-supplied.
//   - `name` is a BASENAME (the last path component), never a path. It is the only
//     thing the receiver learns about where the file lives; it lands at
//     <CLAUDE_PROJECT_DIR>/.cache/received-files/<name>.
//   - `size` is the file size in bytes, for the rendered offer.
// The sender's ABSOLUTE PATH is NEVER on the wire — it stays on the sender adapter,
// keyed by transfer_id, and is only echoed back to that same adapter in `xfer_push`.
export interface Attachment {
  transfer_id: string;
  name: string;
  size: number;
}

// The per-file outcome of an `approve_files`, reported in `files_approved`. `status`:
//   "ok"       — the file streamed in full and atomic-renamed into received-files/.
//   "rejected" — a name collision (basename already exists) — explicit, recoverable.
//   "failed"   — a stream/IO error (counterpart offline, aborted mid-stream, etc.).
export interface FileResult {
  transfer_id: string;
  name: string;
  status: "ok" | "rejected" | "failed";
  detail?: string;
}

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
  // PRIVILEGED (._admin only): drop ANOTHER member's <name>@<group>._group handle.
  // Mirrors `leave` but keyed on the TARGET member resolved from (group, name), not
  // the caller's identity. Honored only for a connection that owns an `._admin`
  // handle (same gate as admin_subscribe); else the hub replies err `admin_forbidden`.
  // Removing an already-absent member is an idempotent no-op success. See
  // docs/group-chat-member-removal.md.
  | { t: "remove_member"; group: string; name: string }
  // PRIVILEGED (._admin only): delete an ENTIRE group — its groups row, every
  // <name>@<group>._group handle, all its messages, and its in-memory Group. The
  // group-level sibling of remove_member. Honored only for a connection that owns an
  // `._admin` handle (same gate as admin_subscribe); else the hub replies err
  // `admin_forbidden`. Deleting an absent group is an idempotent no-op success. See
  // docs/group-chat-group-deletion.md.
  | { t: "delete_group"; group: string }
  // The hub resolves the sender's handle from the caller's identity (no `as`).
  // `to` = optional MEMBER NAMES to restrict the live push to (still logged for all).
  // `reply_to` = optional seq of a prior message in this group: the reply is logged
  // for all but pushed ONLY to that message's author (or nobody if they left).
  // `attach` (v8) = an optional FILE OFFER: per-file `name` (basename) + `size`, which
  // the sender adapter validated (project-dir confined, readable, regular file) before
  // sending. The hub MINTS a `transfer_id` per entry and stamps the resulting
  // `Attachment[]` onto the delivered message as `attachments` — the wire entries carry
  // NO transfer_id and NO path (the sender keeps the abs path locally, keyed by the
  // minted id the `sent` reply returns). See docs/group-chat-file-transfer.md.
  | {
      t: "send";
      group: string;
      message: string;
      to?: string[];
      reply_to?: number;
      attach?: { name: string; size: number }[];
    }
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
  // ---- admin event stream (v7) ----
  // Begin the omniscient admin stream on THIS connection: the hub replays a snapshot
  // of all durable state as `event` frames, then keeps pushing `event` frames LIVE
  // for every hub mutation (every group, every DM, regardless of membership).
  // Honored only for a connection bound to an `._admin` identity (the browser's
  // reserved `user@<host>._admin`); on any other connection the hub replies `error`
  // with code `admin_forbidden`. Idempotent: a second admin_subscribe just re-sends
  // a fresh snapshot. See docs/group-chat-web-frontend.md sections 1-3.
  | { t: "admin_subscribe" }
  // ---- reconnect-notice engagement pre-flight (v7, additive) ----
  // Asked by a FRESHLY-respawned adapter (a manual Reconnect / first launch) before
  // it decides whether to surface its one-shot adapter-status notice. `session_id`
  // is the adapter's env CLAUDE_CODE_SESSION_ID — trustworthy ONLY on fresh respawn
  // (it equals the live session then). The hub answers `engaged` = "has this session
  // id ever bound an identity?" purely from the durable `sessions` table, MAIN key
  // only (an exact `session_key == session_id` match, no `:` agent suffix). A first-
  // launch session that never touched group-chat has NO row → engaged:false → the
  // adapter stays silent; a Reconnect of a previously-engaged session HAS one →
  // engaged:true → the adapter nudges. This gate is what separates the two
  // (indistinguishable) fresh-process cases. See docs/group-chat-reconnect-notice.md.
  | { t: "session_engaged"; session_id: string }
  // ---- file transfer (v8) ----
  // Approve the file offer carried on group `group`'s message `seq` (the seq the offer
  // rode on). Identity-gated via `requireIdentity`/`tool_use_id` like every group op;
  // only a member who RECEIVED the offer may approve it, and an offer is approved once.
  // The hub then runs the rendezvous (park the receiver's GET, wake the sender's POST)
  // and replies `files_approved` with the per-file outcome. ONLY this moves bytes.
  | { t: "approve_files"; group: string; seq: number }
  // The RECEIVER adapter's outcome for one xfer_pull, sent back to the hub WITHOUT a
  // reply (a silent control frame, like dm_ack). `corr_id` is the per-transfer token the
  // hub minted on xfer_pull; the hub matches it to the pending `approve_files` collector
  // and folds this `status`/`detail` into the `files_approved` result. The SENDER adapter
  // does NOT report (its POST failing simply errors the receiver's GET, surfaced here).
  | {
      t: "xfer_result";
      corr_id: string;
      transfer_id: string;
      status: "ok" | "rejected" | "failed";
      detail?: string;
    }
  | { t: "ping" };

// ---- admin event stream (v7) ----------------------------------------------
// The tagged `event` family the hub pushes to an admin_subscribe'd connection.
// SNAPSHOT and LIVE TAIL use the IDENTICAL frames, so the client applies one code
// path. Every event is an IDEMPOTENT UPSERT: it carries the full record needed to
// reconstruct the corresponding store entry, NOT a delta — replaying it any number
// of times (snapshot then live) converges to the same state. The hub wraps each in
// a `{ t: "event"; event: AdminEvent }` ServerFrame (below) so it never collides
// with the existing v6 ServerFrame tags.

// A connected/known identity. `aliases` are ALL the identity's host-qualified
// aliases: `aliases[0]` is ALWAYS the implicit default alias `<identity_id>@<host>`
// (this is where the host lives — there is no standalone `host` field), followed by
// the registered-alias handles it owns. `groups` are the group names it currently
// holds a handle in; `online` is whether it has a live connection right now. Upsert
// keyed by `identity_id`. (`presence` may carry the online bit alone; identity_upsert
// also carries it so a snapshot entry is self-contained.)
export interface IdentityUpsert {
  type: "identity_upsert";
  identity_id: string;
  aliases: string[];
  groups: string[];
  online: boolean;
  role: Role; // the identity's DERIVED role (roleForIdentity) — a UNIFORM property of
  // every identity, NOT a stored boolean. Lets the web badge a human console identity.
}

// A group and its current member count. Upsert keyed by `name`. Emitted on
// create/join/leave (membership changes the count) and in the snapshot.
export interface GroupUpsert {
  type: "group_upsert";
  name: string;
  members: number;
}

// A group member (a `<name>@<group>._group` handle). Upsert keyed by
// `(group, name)`. `owner` is the owning identity id; `attached` is whether that
// identity is currently online. Emitted on join and in the snapshot.
export interface MemberUpsert {
  type: "member_upsert";
  group: string;
  name: string;
  owner: string;
  attached: boolean;
}

// A member left a group: remove the `(group, name)` entry from the store. Emitted
// on leave. Idempotent: removing an absent member is a no-op for the client.
export interface MemberRemove {
  type: "member_remove";
  group: string;
  name: string;
}

// A group was deleted: remove the whole group — its entry, all its members, and its
// thread — from the store. The group-level sibling of MemberRemove. Emitted ONCE per
// delete_group (the client folds the whole group's removal in one mutation), so a
// delete does NOT additionally emit per-member member_remove events. Idempotent:
// removing an absent group is a no-op for the client.
export interface GroupRemove {
  type: "group_remove";
  name: string;
}

// A group message. Carries the full `ChatMessage` (which already names its group).
// Append/upsert keyed by `(group, seq)`. Emitted for EVERY group message — every
// group, regardless of whether the admin identity is a member — and in the snapshot
// (the in-memory window per group).
export interface MessageAppend {
  type: "message_append";
  msg: ChatMessage;
}

// A direct message. Carries the full `DirectMessage` (which names both identities).
// Append/upsert keyed by `(identity-pair, seq)`; a state change (sent→received→read)
// re-emits the same seq with the new `state`, so the client upserts it. Emitted for
// EVERY DM, between any two identities, and in the snapshot (durable DMs).
export interface DmAppend {
  type: "dm_append";
  msg: DirectMessage;
}

// An identity's online flag changed. Upsert keyed by `identity_id`. A thin variant
// of identity_upsert for the common online/offline transition; the client folds it
// into the same identity store entry. Emitted on connect (first conn) / disconnect
// (last conn).
export interface Presence {
  type: "presence";
  identity_id: string;
  online: boolean;
}

// Marks the snapshot/live boundary: every event before it (on this connection) was
// part of the initial snapshot; everything after is the live tail. The client may
// flip a "live" indicator on seeing it. NOT required for correctness — events are
// idempotent — purely a UI affordance.
export interface SnapshotEnd {
  type: "snapshot_end";
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
  | SnapshotEnd;

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
  role?: Role; // the author's DERIVED role (roleForIdentity of from_identity). Optional
  // for back-compat (old frames omit it); stamped by the hub on every send + history.
  // Surfaces "this message is a human talking" (role==="human") vs an agent peer.
  attachments?: Attachment[]; // the v8 FILE OFFER sidecar: per-file transfer_id + name
  // (basename) + size, stamped by the hub when the send carried `attach`. Omitted for a
  // plain message (a v7 reader that ignores the field renders the message normally). The
  // display hook renders it as a "📎 N file(s) offered on seq S" marker; the receiver
  // approves with `approve_files(group, seq)`. NOT persisted/re-derived for history (the
  // bytes move at most once, on approve — a live-only affordance, like the gap window).
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
  role?: Role; // the SENDER's DERIVED role (roleForIdentity of from_identity). A human's
  // DM is also a human talking. Optional for back-compat; stamped by the hub on send.
}

// A directory entry: one known identity with its aliases + group memberships,
// marked online when a live connection is currently bound to it. `host` is RETAINED
// here (unlike the admin IdentityUpsert event, which drops it) because the MCP
// `list_directory` tool renders the `<identity_id>@<host>` heading from it.
export interface DirectoryEntry {
  identity_id: string;
  host: string; // the host last reported for this identity (== aliases[0] host part)
  // ALL the identity's host-qualified aliases: aliases[0] is the default alias
  // `<identity_id>@<host>`, then its registered-alias handles.
  aliases: string[];
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
      // v8: the minted file offer (transfer_id + name + size per attached file), echoed
      // back IN THE SAME ORDER the sender's `attach` named them, so the sender adapter can
      // map each hub-minted transfer_id to the absolute path it kept locally (which never
      // crossed the wire). Omitted when the send carried no `attach`.
      attachments?: Attachment[];
    }
  // ---- identity / aliases (v3) ----
  | { t: "aliases"; rid?: string; aliases: string[] } // reply to list_aliases (host-qualified)
  // `host` is RETAINED here (unlike the admin IdentityUpsert event, which drops it as
  // derivable from aliases[0]) for the same reason DirectoryEntry keeps it: it is the
  // authoritative host of THIS live connection (`conn.host`) — the very value used to
  // build aliases[0] — and the MCP `whoami` tool renders a `host:` line from it.
  | { t: "whoami"; rid?: string; identity_id: string; host: string; aliases: string[] }
  | { t: "resolved"; rid?: string; address: string; identity_id: string | null; online: boolean }
  | { t: "directory"; rid?: string; entries: DirectoryEntry[] }
  // ---- direct messages (v3) ----
  // reply to a `dm`: `read` iff the target was online & surfaced it in the
  // window, else `sent` (accepted/queued). No async read receipt is pushed later.
  | { t: "dm_sent"; rid?: string; seq: number; state: "sent" | "read" }
  | { t: "dm_message"; msg: DirectMessage } // a DM to surface as a <channel> direct message
  | { t: "dm_history"; rid?: string; peer_identity: string; messages: DirectMessage[] }
  // ---- admin event stream (v7) ----
  // One wrapped admin event (snapshot replay or live tail) for an admin_subscribe'd
  // connection. The `event` envelope keeps the v7 firehose tag-disjoint from every
  // v6 ServerFrame, so a v6 client (which never subscribes) never sees one.
  | { t: "event"; event: AdminEvent }
  // Reply to a console `remove_member`: the target's group handle was deleted (or was
  // already gone — idempotent no-op success). `rid` correlates it to the awaiting
  // console request. The kicked member vanishes from every console via the
  // `member_remove` firehose event emitted alongside this ack. See
  // docs/group-chat-member-removal.md.
  | { t: "member_removed"; rid?: string; group: string; name: string }
  // Reply to a console `delete_group`: the group was deleted — its groups row, every
  // member handle, and all its messages dropped (or the group was already gone —
  // idempotent no-op success). `rid` correlates it to the awaiting console request.
  // The group vanishes from every console via the `group_remove` firehose event
  // emitted alongside this ack. See docs/group-chat-group-deletion.md.
  | { t: "group_deleted"; rid?: string; group: string }
  // hub→adapter: the identity `to_identity` was removed from `group` by a console.
  // Surface a ONE-SHOT notice into that identity's session(s). `to_identity` is carried
  // so the adapter's delivery gate drops the frame for a session this adapter doesn't
  // serve (a subagent's, a superseded resume's) — identical to the `message`/`dm_message`
  // gate. Sent ONLY to the target's currently-live connections (online-only notice).
  | { t: "evicted"; group: string; to_identity: string }
  // ---- reconnect-notice engagement pre-flight (v7, additive) ----
  // Reply to the `session_engaged` request: `engaged` is true iff the queried
  // `session_id` has a durable `sessions` row under its MAIN key (it bound an
  // identity via ≥1 group-chat tool call). The adapter fires its reconnect notice
  // only when this is true. `rid` correlates it to the awaiting request.
  | { t: "session_engaged"; rid?: string; session_id: string; engaged: boolean }
  // ---- file transfer (v8) ----
  // Reply to `approve_files`: the per-file outcome (which landed, which were rejected
  // for a name collision, which failed mid-stream). `rid` correlates it to the awaiting
  // tool call; the tool result renders `results`.
  | { t: "files_approved"; rid?: string; group: string; seq: number; results: FileResult[] }
  // The two SILENT control frames (hub → adapter) — handled in `onFrame` WITHOUT an
  // `mcp.notification`, so they cost no LLM turn (mirrors the inbound dm_ack pattern,
  // but hub→adapter). The hub references only the transfer_id; the LLM is never told a
  // transfer is happening.
  //   xfer_pull → the RECEIVER adapter: open `GET /xfer/<transfer_id>`, stream the body
  //     to a temp file under .cache/received-files/, atomic-rename to `name` on full
  //     success (reject if `name` already exists). `corr_id` (the hub's per-transfer
  //     correlation token) is echoed back on `xfer_result` so the hub matches the result.
  //   xfer_push → the SENDER adapter: look up its OWN abs path for `transfer_id` (kept
  //     locally since the offer — the path NEVER reached the hub), open it read-only and
  //     `POST /xfer/<transfer_id>` as a streamed body. Never reads the file fully into
  //     memory. The hub carries NO path here (it never had one); the sender adapter is
  //     the sole holder of the path, keyed by the hub-minted transfer_id.
  | { t: "xfer_pull"; transfer_id: string; corr_id: string; name: string }
  | { t: "xfer_push"; transfer_id: string; corr_id: string }
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
