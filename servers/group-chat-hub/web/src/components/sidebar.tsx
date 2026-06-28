import { createSignal, createMemo, For, Show, type JSX } from "solid-js"
import { useNavigate, useLocation } from "@solidjs/router"
import Search from "lucide-solid/icons/search"
import { selfIdentity } from "../lib/connection"
import {
  conversations,
  search,
  identityLabel,
  identitySubtitle,
  suggestedGroups,
  suggestedAgents,
  type Conversation,
} from "../store/selectors"
import type { Identity } from "../store/types"
import { joinGroup } from "../lib/actions"
import { recency } from "../lib/format"
import { renderInlineMarkdown } from "../lib/markdown"
import Avatar from "./avatar"
import Pill from "./pill"
import Brand from "./brand"

type Filter = "all" | "groups" | "direct"

export default function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const [query, setQuery] = createSignal("")
  const [filter, setFilter] = createSignal<Filter>("all")

  const searching = () => query().trim().length > 0
  const results = createMemo(() => search(query(), selfIdentity()))

  const convs = createMemo<Conversation[]>(() => {
    const all = conversations(selfIdentity())
    const f = filter()
    if (f === "groups") return all.filter((c) => c.kind === "group")
    if (f === "direct") return all.filter((c) => c.kind === "dm")
    return all
  })

  const sugGroups = createMemo(() => suggestedGroups(selfIdentity()))
  const sugAgents = createMemo(() => suggestedAgents(selfIdentity()))

  const activeId = createMemo(() => {
    const p = location.pathname
    if (p.startsWith("/g/")) return `group:${decodeURIComponent(p.slice(3).split("/")[0] ?? "")}`
    if (p.startsWith("/dm/")) return `dm:${decodeURIComponent(p.slice(4))}`
    return ""
  })

  function openConv(c: Conversation) {
    if (c.kind === "group") navigate(`/g/${encodeURIComponent(c.name)}`)
    else navigate(`/dm/${encodeURIComponent(c.peer)}`)
  }

  function openGroup(name: string, joined: boolean) {
    // Click-to-act: join first if we're not a member yet, then open the thread.
    // (Join under the console identity's own handle name.)
    if (!joined) joinGroup(name, "user")
    setQuery("")
    navigate(`/g/${encodeURIComponent(name)}`)
  }

  function startDm(peerId: string) {
    // Open the DM thread immediately; the first send creates the durable thread.
    setQuery("")
    navigate(`/dm/${encodeURIComponent(peerId)}`)
  }

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "groups", label: "Groups" },
    { key: "direct", label: "Direct" },
  ]

  return (
    <aside class="bg-bg border-r-2 border-border-subtle flex flex-col min-h-0">
      <Brand />

      {/* search */}
      <div class="relative mx-[1.125rem] mb-2.5">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-[1.0625rem] h-[1.0625rem] text-on-bg-secondary" />
        <input
          type="search"
          value={query()}
          onInput={(e) => setQuery(e.currentTarget.value)}
          placeholder="Search people, agents & groups…"
          class="w-full font-data text-sm bg-surface text-on-surface placeholder-on-surface-secondary border-2 border-border-subtle rounded-xl pl-10 pr-3.5 py-3 focus:border-apricot focus:outline-none transition-colors"
        />
      </div>

      {/* segmented filter */}
      <Show when={!searching()}>
        <div class="flex gap-1.5 mx-[1.125rem] mb-3">
          <For each={filters}>
            {(f) => (
              <button
                type="button"
                onClick={() => setFilter(f.key)}
                class={`flex-1 cursor-pointer type-label font-semibold py-1.5 rounded-lg transition-colors ${
                  filter() === f.key
                    ? "bg-on-bg text-bg"
                    : "text-on-bg-secondary hover:text-on-bg"
                }`}
              >
                {f.label}
              </button>
            )}
          </For>
        </div>
      </Show>

      {/* list / search results */}
      <div class="flex-1 overflow-y-auto px-3 pb-4 min-h-0">
        <Show
          when={searching()}
          fallback={
            <>
              <ConvList convs={convs()} activeId={activeId()} onOpen={openConv} />
              <Suggested
                groups={sugGroups()}
                agents={sugAgents()}
                onOpenGroup={openGroup}
                onStartDm={startDm}
              />
            </>
          }
        >
          {/* groups */}
          <Show when={results().groups.length > 0}>
            <SectionHeader>Groups</SectionHeader>
            <For each={results().groups}>
              {(g) => (
                // Whole row is the action: open if joined, else join-then-open. Joined
                // groups show a pill; unjoined ones just open+join on click.
                <GroupRow
                  name={g.name}
                  members={g.members}
                  joined={g.joined}
                  onClick={() => openGroup(g.name, g.joined)}
                />
              )}
            </For>
          </Show>

          {/* identities */}
          <Show when={results().identities.length > 0}>
            <SectionHeader>People &amp; agents</SectionHeader>
            <For each={results().identities}>
              {(ident) => (
                // Subtitle = the alias best matching the query (else first/default).
                <AgentRow
                  ident={ident}
                  subtitle={identitySubtitle(ident.identity_id, query())}
                  onClick={() => startDm(ident.identity_id)}
                />
              )}
            </For>
          </Show>

          <Show when={results().groups.length === 0 && results().identities.length === 0}>
            <div class="font-data text-sm text-on-bg-secondary text-center px-4 py-8">
              Nothing matches “{query()}”.
            </div>
          </Show>
        </Show>
      </div>
    </aside>
  )
}

function ConvList(props: {
  convs: Conversation[]
  activeId: string
  onOpen: (c: Conversation) => void
}) {
  return (
    <Show
      when={props.convs.length > 0}
      fallback={
        <div class="font-data text-sm text-on-bg-secondary text-center px-4 py-10 leading-relaxed">
          No conversations yet. Search above to join a group or DM an agent.
        </div>
      }
    >
      <SectionHeader>Conversations</SectionHeader>
      <For each={props.convs}>
        {(c) => (
          <button
            type="button"
            onClick={() => props.onOpen(c)}
            class={`relative w-full text-left flex gap-3 items-center px-3 py-2.5 rounded-2xl cursor-pointer transition-colors ${
              props.activeId === c.id ? "bg-surface" : "hover:bg-hover-on-bg"
            }`}
          >
            <Show when={props.activeId === c.id}>
              <span class="absolute -left-3 top-3.5 bottom-3.5 w-1 rounded-r bg-gradient-to-b from-apricot to-rose" />
            </Show>
            <Avatar
              label={c.name}
              tintKey={c.kind === "group" ? c.name : (c as { peer: string }).peer}
              kind={c.kind}
              size="md"
            />
            <div class="flex-1 min-w-0">
              <div class="flex items-baseline justify-between gap-2">
                <span class="font-data text-sm font-semibold text-on-bg truncate">{c.name}</span>
                <span class="type-precise-sm text-on-bg-secondary shrink-0">{recency(tsIso(c))}</span>
              </div>
              <div class="flex items-center gap-1.5 mt-0.5 type-data-label text-on-bg-secondary truncate">
                <Show when={c.kind === "group" && c.who}>
                  <span class="text-on-bg font-medium shrink-0">{(c as { who?: string }).who}:</span>
                </Show>
                <span class="md-inline truncate" innerHTML={renderInlineMarkdown(c.preview)} />
              </div>
            </div>
            <div class="shrink-0">
              <Pill variant={c.kind === "group" ? "group" : "dm"}>{c.kind === "group" ? "grp" : "dm"}</Pill>
            </div>
          </button>
        )}
      </For>
    </Show>
  )
}

// The "Suggested" section: quick join/DM shortcuts below the conversation list when
// not searching. Rows reuse the SAME visual style + click-to-act as the search-result
// rows — group → join-then-open (unjoined), agent → open DM thread. Empty sub-lists
// hide; the whole section hides when both are empty.
function Suggested(props: {
  groups: { name: string; members: number; ts: number }[]
  agents: Identity[]
  onOpenGroup: (name: string, joined: boolean) => void
  onStartDm: (peerId: string) => void
}) {
  return (
    <Show when={props.groups.length > 0 || props.agents.length > 0}>
      <Show when={props.groups.length > 0}>
        <SectionHeader>Suggested groups</SectionHeader>
        <For each={props.groups}>
          {(g) => (
            // Suggested groups are unjoined → join-then-open on click.
            <GroupRow
              name={g.name}
              members={g.members}
              joined={false}
              onClick={() => props.onOpenGroup(g.name, false)}
            />
          )}
        </For>
      </Show>

      <Show when={props.agents.length > 0}>
        <SectionHeader>Online agents</SectionHeader>
        <For each={props.agents}>
          {(ident) => (
            <AgentRow
              ident={ident}
              subtitle={identitySubtitle(ident.identity_id)}
              onClick={() => props.onStartDm(ident.identity_id)}
            />
          )}
        </For>
      </Show>
    </Show>
  )
}

// A left-sidebar section label (Conversations / Groups / People & agents / Suggested…).
// One home for the uppercase-tracked header style, shared by every section.
function SectionHeader(props: { children: JSX.Element }) {
  return (
    <div class="type-label font-bold uppercase tracking-[0.16em] text-on-bg-secondary px-3 pt-3.5 pb-2">
      {props.children}
    </div>
  )
}

// A group row: avatar + name + member count, the whole row a click-to-act button
// (open if joined, else join-then-open). A `joined` group shows a status pill. Shared
// by the search results and the Suggested section so their row styling can't drift.
function GroupRow(props: {
  name: string
  members: number
  joined: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={() => props.onClick()}
      class="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-2xl cursor-pointer hover:bg-hover-on-bg transition-colors"
    >
      <Avatar label={props.name} tintKey={props.name} kind="group" size="sm" />
      <div class="flex-1 min-w-0">
        <div class="font-data text-sm font-medium text-on-bg truncate">{props.name}</div>
        <div class="type-precise-sm text-on-bg-secondary">{props.members} members</div>
      </div>
      <Show when={props.joined}>
        <Pill variant="group">joined</Pill>
      </Show>
    </button>
  )
}

// An identity row: avatar (with online dot) + label + subtitle, the whole row a
// click-to-act button that opens the DM thread. `subtitle` is computed by the caller
// (search passes a query for best-match alias surfacing; suggestions pass none).
// Shared by the search results and the Suggested section.
function AgentRow(props: { ident: Identity; subtitle: string; onClick: () => void }) {
  const label = () => identityLabel(props.ident.identity_id)
  return (
    <button
      type="button"
      onClick={() => props.onClick()}
      class="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-2xl cursor-pointer hover:bg-hover-on-bg transition-colors"
    >
      <Avatar
        label={label()}
        tintKey={props.ident.identity_id}
        kind="dm"
        size="sm"
        online={props.ident.online}
      />
      <div class="flex-1 min-w-0">
        <div class="font-data text-sm font-medium text-on-bg truncate">{label()}</div>
        <div class="type-precise-sm text-on-bg-secondary truncate">{props.subtitle}</div>
      </div>
    </button>
  )
}

// Recover the ISO ts of a conversation's last message for the recency label (the
// selector stored ms; re-derive a comparable string is overkill — pass ms-as-date).
function tsIso(c: Conversation): string | undefined {
  return c.ts > 0 ? new Date(c.ts).toISOString() : undefined
}
