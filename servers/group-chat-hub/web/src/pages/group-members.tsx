import { createMemo, For, Show } from "solid-js"
import { useParams, useNavigate, A } from "@solidjs/router"
import ArrowLeft from "lucide-solid/icons/arrow-left"
import { store } from "../store/store"
import { membersOf, identityLabel } from "../store/selectors"
import { selfIdentity } from "../lib/connection"
import ThreadHead from "../components/thread-head"
import IconButton from "../components/icon-button"
import Avatar from "../components/avatar"
import Pill from "../components/pill"

// A group's member list, derived from the store (the `<name>@<group>._group` handles).
export default function GroupMembers() {
  const params = useParams()
  const navigate = useNavigate()
  const group = () => decodeURIComponent(params.name ?? "")
  const members = createMemo(() => membersOf(group()).slice().sort((a, b) => a.name.localeCompare(b.name)))

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
        subtitle={`${members().length} members`}
        actions={
          <IconButton title="Back to thread" onClick={() => navigate(`/g/${encodeURIComponent(group())}`)}>
            <ArrowLeft class="w-[1.125rem] h-[1.125rem]" />
          </IconButton>
        }
      />
      <div class="flex-1 overflow-y-auto px-6 py-5">
        <div class="type-label font-bold uppercase tracking-[0.16em] text-on-surface-secondary px-2 pb-3">
          Members
        </div>
        <For each={members()}>
          {(m) => (
            <A
              href={`/i/${encodeURIComponent(m.owner)}`}
              class="flex items-center gap-3 px-2 py-2.5 rounded-2xl hover:bg-hover-on-surface transition-colors"
            >
              <Avatar
                label={m.name}
                tintKey={m.owner}
                kind="dm"
                size="sm"
                online={m.attached}
              />
              <div class="flex-1 min-w-0">
                {/* The name itself is a DM action (navigate /dm/<owner>); the rest of
                    the row still opens the identity detail. Skip for your own row. */}
                <Show
                  when={m.owner !== selfIdentity()}
                  fallback={
                    <div class="font-data text-sm font-medium text-on-surface truncate">{m.name}</div>
                  }
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      navigate(`/dm/${encodeURIComponent(m.owner)}`)
                    }}
                    title={`Direct message ${m.name}`}
                    class="block max-w-full text-left cursor-pointer font-data text-sm font-medium text-on-surface truncate hover:text-apricot-strong transition-colors"
                  >
                    {m.name}
                  </button>
                </Show>
                <div class="type-precise-sm text-on-surface-secondary truncate">
                  {identityLabel(m.owner)} · {m.attached ? "online" : "offline"}
                </div>
              </div>
              <Show when={m.owner === selfIdentity()}>
                <Pill variant="neutral">you</Pill>
              </Show>
            </A>
          )}
        </For>
      </div>
    </Show>
  )
}
