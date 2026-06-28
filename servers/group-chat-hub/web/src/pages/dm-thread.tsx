import { createMemo, Show } from "solid-js"
import { useParams } from "@solidjs/router"
import type { ChatMessage } from "../lib/protocol"
import { selfIdentity } from "../lib/connection"
import { store } from "../store/store"
import { identityById, identityLabel, dmThreadMessages } from "../store/selectors"
import { sendDm } from "../lib/actions"
import ThreadHead from "../components/thread-head"
import MessageList from "../components/message-list"
import Composer from "../components/composer"

// A DM thread with a single peer identity. DMs carry no group `to:`/`reply_to`, so the
// composer has neither targeting nor reply. Messages are mapped into the shared
// MessageList row shape (DM seq → row seq), keyed by the sender identity.
export default function DmThread() {
  const params = useParams()
  const peer = () => decodeURIComponent(params.id ?? "")

  const peerIdent = createMemo(() => identityById(peer()))
  const peerName = createMemo(() => identityLabel(peer()))

  // The peer's address to send to: prefer a registered alias (aliases[1]), else the
  // default alias `<identity_id>@<host>` (aliases[0]) — the host lives in that alias,
  // there is no standalone host field. Returns undefined when the identity is only a
  // presence stub (aliases still empty, e.g. a `presence` event arrived before its
  // `identity_upsert`): the raw `peer()` id has no `@host` and the hub would reject it
  // as `no_such_address`, so we withhold sending until a routable alias exists rather
  // than emit a bare uuid.
  const peerAddress = createMemo<string | undefined>(() => {
    const ident = peerIdent()
    return ident?.aliases[1] ?? ident?.aliases[0]
  })

  // Map each DM into a ChatMessage-shaped row; `from` is the sender identity id so the
  // list's mine/agent/display resolvers can key off it.
  const rows = createMemo<ChatMessage[]>(() => {
    const self = selfIdentity()
    if (!self) return []
    return dmThreadMessages(self, peer()).map((dm) => ({
      group: "dm",
      seq: dm.seq,
      from: dm.from_identity,
      ts: dm.ts,
      msg_id: dm.msg_id,
      text: dm.text,
    }))
  })

  const subtitle = () => {
    const ident = peerIdent()
    if (!ident) return "no shared history yet"
    return ident.online ? "online" : "offline"
  }

  function onSend(text: string) {
    const to = peerAddress()
    if (!to) return // no routable alias yet (presence-only stub); drop rather than send a bare uuid
    sendDm(to, text)
  }

  return (
    <Show
      when={selfIdentity()}
      fallback={
        <div class="m-auto font-data text-sm text-on-surface-secondary text-center px-6">
          Connecting…
        </div>
      }
    >
      <ThreadHead
        title={peerName()}
        tintKey={peer()}
        kind="dm"
        subtitle={subtitle()}
        online={peerIdent()?.online}
      />

      <MessageList
        messages={rows()}
        mineOf={(from) => from === selfIdentity()}
        agentOf={(from) => from !== selfIdentity() && store.identities[from]?.role !== "human"}
        // In a DM thread `from` IS the sender identity id, so its derived role is a
        // direct identity-store lookup (a human peer's DM gets the human badge, and is
        // NOT also styled as a lavender agent handle).
        humanOf={(from) => store.identities[from]?.role === "human"}
        tintOf={(from) => from}
        displayOf={(from) => (from === selfIdentity() ? "You" : identityLabel(from))}
        onReply={() => {
          /* DMs have no reply-to in the protocol; the row's reply affordance is a
             no-op here (composer shows no reply chip for DMs). */
        }}
      />

      <Composer placeholder={`Message ${peerName()}…`} onSend={onSend} />
    </Show>
  )
}
