import { createSignal, createMemo, Show } from "solid-js"
import { useParams, useNavigate } from "@solidjs/router"
import SearchIcon from "lucide-solid/icons/search"
import Users from "lucide-solid/icons/users"
import LogOut from "lucide-solid/icons/log-out"
import { selfIdentity } from "../lib/connection"
import { store } from "../store/store"
import { memberKey } from "../store/types"
import { groupMessages, membersOf, joinedGroups } from "../store/selectors"
import { sendMessage, leaveGroup, joinGroup } from "../lib/actions"
import ThreadHead from "../components/thread-head"
import IconButton from "../components/icon-button"
import MessageList from "../components/message-list"
import Composer, { type ReplyTarget } from "../components/composer"

// A group thread. Messages, members, and the composer with reply-to + `to:`
// targeting. Membership/sends echo back through the event stream — no optimistic
// local mutation.
export default function GroupThread() {
  const params = useParams()
  const navigate = useNavigate()
  const group = () => decodeURIComponent(params.name ?? "")
  const [reply, setReply] = createSignal<ReplyTarget | undefined>()

  const messages = createMemo(() => groupMessages(group()))
  const members = createMemo(() => membersOf(group()))
  const joined = createMemo(() => joinedGroups(selfIdentity()).includes(group()))

  // Map a member name → its owning identity (for self/agent detection + tinting).
  const ownerOf = (from: string): string | undefined =>
    store.members[memberKey(group(), from)]?.owner
  const mineOf = (from: string) => {
    const owner = ownerOf(from)
    return owner !== undefined && owner === selfIdentity()
  }
  // A message is "human-authored" iff its owning identity carries the DERIVED role
  // "human" (a web console user). Resolved through the identity store — the role lives
  // on the identity (identity_upsert), uniform across every identity.
  const humanOf = (from: string) => {
    const owner = ownerOf(from)
    return owner !== undefined && store.identities[owner]?.role === "human"
  }
  const onlineMembers = () => members().filter((m) => m.attached).length

  const subtitle = () => {
    const total = members().length
    const on = onlineMembers()
    return `${total} member${total === 1 ? "" : "s"} · ${on} online`
  }

  function onSend(text: string, opts: { to: string[]; reply_to?: number }) {
    sendMessage(group(), text, {
      to: opts.to.length > 0 ? opts.to : undefined,
      reply_to: opts.reply_to,
    })
  }

  function confirmLeave() {
    if (confirm(`Leave “${group()}”?`)) {
      leaveGroup(group())
      navigate("/")
    }
  }

  return (
    <Show
      when={store.groups[group()]}
      fallback={
        <div class="m-auto font-data text-sm text-on-surface-secondary text-center px-6">
          Unknown group “{group()}”.
        </div>
      }
    >
      <ThreadHead
        title={group()}
        tintKey={group()}
        kind="group"
        subtitle={subtitle()}
        actions={
          <>
            <IconButton title="Members" onClick={() => navigate(`/g/${encodeURIComponent(group())}/members`)}>
              <Users class="w-[1.125rem] h-[1.125rem]" />
            </IconButton>
            <Show when={joined()}>
              <IconButton title="Leave group" onClick={confirmLeave}>
                <LogOut class="w-[1.125rem] h-[1.125rem]" />
              </IconButton>
            </Show>
            <IconButton title="Search in chat">
              <SearchIcon class="w-[1.125rem] h-[1.125rem]" />
            </IconButton>
          </>
        }
      />

      <MessageList
        messages={messages()}
        mineOf={mineOf}
        agentOf={(from) => !mineOf(from) && !humanOf(from)}
        humanOf={humanOf}
        tintOf={(from) => ownerOf(from) ?? from}
        displayOf={(from) => from}
        onReply={(msg) =>
          setReply({ seq: msg.seq, who: mineOf(msg.from) ? "You" : msg.from, text: msg.text })
        }
        onAuthorClick={(from) => {
          // Click a member name → DM its owning identity (same as search's startDm).
          // Skip own messages and members with no resolvable owner.
          const owner = ownerOf(from)
          if (!owner || mineOf(from)) return
          navigate(`/dm/${encodeURIComponent(owner)}`)
        }}
      />

      <Show
        when={joined()}
        fallback={
          <div class="px-[1.375rem] py-5 border-t-2 border-border-subtle bg-surface text-center">
            <p class="font-data text-sm text-on-surface-secondary mb-3">
              You're observing this group. Join to participate.
            </p>
            <button
              type="button"
              onClick={() => joinGroup(group(), "user")}
              class="cursor-pointer font-ui text-sm font-medium text-on-send bg-apricot hover:bg-apricot-strong px-5 py-2.5 rounded-xl transition-colors"
            >
              Join “{group()}”
            </button>
          </div>
        }
      >
        <Composer
          placeholder={`Message ${group()}…`}
          reply={reply()}
          onClearReply={() => setReply(undefined)}
          targets={members().map((m) => m.name)}
          onSend={onSend}
        />
      </Show>
    </Show>
  )
}
