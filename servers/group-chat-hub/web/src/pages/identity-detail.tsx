import { createSignal, createMemo, For, Show } from "solid-js"
import { useParams, useNavigate } from "@solidjs/router"
import MessageSquare from "lucide-solid/icons/message-square"
import Plus from "lucide-solid/icons/plus"
import X from "lucide-solid/icons/x"
import { identityById, identityLabel } from "../store/selectors"
import { selfIdentity, selfHost } from "../lib/connection"
import { registerAlias, releaseAlias } from "../lib/actions"
import ThreadHead from "../components/thread-head"
import IconButton from "../components/icon-button"
import Pill from "../components/pill"

// An identity detail view: host, aliases, group memberships, online state. For the
// console's OWN identity it also offers register/release alias.
export default function IdentityDetail() {
  const params = useParams()
  const navigate = useNavigate()
  const id = () => decodeURIComponent(params.id ?? "")
  const ident = createMemo(() => identityById(id()))
  const isSelf = () => id() === selfIdentity()
  // Registered aliases only: aliases[0] is the default alias `<id>@<host>` shown as
  // the Address above, so the Aliases section (and its release affordance) lists the
  // registered aliases after it.
  const registeredAliases = createMemo(() => ident()?.aliases.slice(1) ?? [])
  const [newAlias, setNewAlias] = createSignal("")

  function addAlias(e: Event) {
    e.preventDefault()
    const name = newAlias().trim()
    if (name) registerAlias(name)
    setNewAlias("")
  }

  return (
    <Show
      when={ident()}
      fallback={
        <div class="m-auto font-data text-sm text-on-surface-secondary text-center px-6">
          Unknown identity.
        </div>
      }
    >
      <ThreadHead
        title={isSelf() ? "You" : identityLabel(id())}
        tintKey={id()}
        kind="dm"
        subtitle={ident()!.online ? "online" : "offline"}
        online={ident()!.online}
        actions={
          <>
            {/* human badge: the identity's DERIVED role is "human" (a web console user).
                Agents are the unmarked default. */}
            <Show when={ident()!.role === "human"}>
              <Pill variant="human">human</Pill>
            </Show>
            <Show when={!isSelf()}>
              <IconButton title="Direct message" onClick={() => navigate(`/dm/${encodeURIComponent(id())}`)}>
                <MessageSquare class="w-[1.125rem] h-[1.125rem]" />
              </IconButton>
            </Show>
          </>
        }
      />

      <div class="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-6">
        {/* address */}
        <section>
          <div class="type-label font-bold uppercase tracking-[0.16em] text-on-surface-secondary pb-2">
            Address
          </div>
          <div class="font-precise text-sm text-on-surface break-all">
            {isSelf() ? `user@${selfHost}._admin` : (ident()!.aliases[0] ?? id())}
          </div>
        </section>

        {/* aliases */}
        <section>
          <div class="type-label font-bold uppercase tracking-[0.16em] text-on-surface-secondary pb-2">
            Aliases
          </div>
          <Show
            when={registeredAliases().length > 0}
            fallback={<div class="font-data text-sm text-on-surface-secondary">No registered aliases.</div>}
          >
            <div class="flex flex-col gap-2">
              <For each={registeredAliases()}>
                {(alias) => (
                  <div class="flex items-center gap-2">
                    <span class="font-precise text-sm text-on-surface">{alias}</span>
                    <Show when={isSelf()}>
                      <button
                        type="button"
                        title="Release alias"
                        onClick={() => {
                          if (confirm(`Release ${alias}?`)) releaseAlias(alias.split("@")[0] ?? alias)
                        }}
                        class="grid place-items-center w-6 h-6 rounded-lg cursor-pointer text-on-surface-secondary hover:text-error hover:bg-hover-on-surface transition-colors"
                      >
                        <X class="w-3.5 h-3.5" />
                      </button>
                    </Show>
                  </div>
                )}
              </For>
            </div>
          </Show>
          <Show when={isSelf()}>
            <form onSubmit={addAlias} class="flex items-center gap-2 mt-3">
              <input
                type="text"
                value={newAlias()}
                onInput={(e) => setNewAlias(e.currentTarget.value)}
                placeholder="new alias name"
                class="font-precise text-sm bg-surface-raised text-on-surface-raised border-2 border-border-subtle rounded-lg px-3 py-1.5 focus:border-apricot focus:outline-none transition-colors"
              />
              <button
                type="submit"
                class="grid place-items-center gap-1 cursor-pointer type-label font-semibold text-on-send bg-apricot hover:bg-apricot-strong px-3 py-2 rounded-lg transition-colors"
              >
                <Plus class="w-3.5 h-3.5" />
              </button>
            </form>
          </Show>
        </section>

        {/* groups */}
        <section>
          <div class="type-label font-bold uppercase tracking-[0.16em] text-on-surface-secondary pb-2">
            Groups
          </div>
          <Show
            when={ident()!.groups.length > 0}
            fallback={<div class="font-data text-sm text-on-surface-secondary">Not in any group.</div>}
          >
            <div class="flex flex-wrap gap-2">
              <For each={ident()!.groups}>
                {(g) => (
                  <button
                    type="button"
                    onClick={() => navigate(`/g/${encodeURIComponent(g)}`)}
                    class="cursor-pointer"
                  >
                    <Pill variant="group">{g}</Pill>
                  </button>
                )}
              </For>
            </div>
          </Show>
        </section>
      </div>
    </Show>
  )
}
