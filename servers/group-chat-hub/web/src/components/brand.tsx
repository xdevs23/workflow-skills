import { Show } from "solid-js"
import MessageCircle from "lucide-solid/icons/message-circle"
import { connState, selfHost } from "../lib/connection"

// The sidebar brand block: the apricot mark, the "Aubergine" serif-role title (our
// --font-data carries the title role per the design), a status sub-line, and a live
// connection indicator.
export default function Brand() {
  const status = () => {
    const s = connState()
    if (s === "live") return "dusk channel"
    if (s === "snapshotting") return "syncing…"
    if (s === "connecting") return "connecting…"
    return "offline"
  }
  return (
    <div class="flex items-center gap-3 px-[1.375rem] pt-[1.375rem] pb-4">
      <div class="grid place-items-center w-[2.375rem] h-[2.375rem] rounded-xl bg-gradient-to-br from-apricot to-apricot-strong text-on-send shrink-0">
        <MessageCircle class="w-5 h-5" />
      </div>
      <div class="flex flex-col leading-tight min-w-0">
        <h1 class="font-data text-[1.4375rem] font-semibold tracking-tight text-on-bg">Aubergine</h1>
        <div class="flex items-center gap-1.5">
          <span
            class={`w-1.5 h-1.5 rounded-full ${
              connState() === "live" ? "bg-jade" : connState() === "closed" ? "bg-on-bg-secondary" : "bg-gold"
            }`}
          />
          <span class="type-label uppercase tracking-[0.14em] font-semibold text-on-bg-secondary truncate">
            {status()}
          </span>
        </div>
      </div>
      <Show when={connState() === "live"}>
        <span class="ml-auto type-precise-sm text-on-bg-secondary truncate" title={`user@${selfHost}._admin`}>
          @{selfHost}
        </span>
      </Show>
    </div>
  )
}
