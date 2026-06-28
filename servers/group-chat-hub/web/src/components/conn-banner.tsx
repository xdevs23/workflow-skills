import { createSignal, Show } from "solid-js"
import { connState, connError, getToken, setToken, reconnect } from "../lib/connection"

// A slim banner across the top of the thread pane while the socket is not live.
// On an auth error it offers a token field (the hub may require GROUP_CHAT_TOKEN;
// the browser has no auth of its own yet, so the token is entered here).
export default function ConnBanner() {
  const [token, setLocalToken] = createSignal(getToken())
  const needsAuth = () => (connError() ?? "").startsWith("unauthorized")
  const show = () => connState() !== "live"

  function applyToken(e: Event) {
    e.preventDefault()
    setToken(token())
    reconnect()
  }

  return (
    <Show when={show()}>
      <div class="absolute inset-x-0 top-0 z-20 flex items-center justify-center gap-3 px-4 py-2 bg-surface-raised border-b-2 border-border-subtle">
        <span
          class={`w-2 h-2 rounded-full ${connState() === "closed" ? "bg-error" : "bg-gold"}`}
        />
        <span class="font-data text-sm text-on-surface-raised-secondary">
          <Show when={connState() === "connecting"}>Connecting to the hub…</Show>
          <Show when={connState() === "snapshotting"}>Syncing hub state…</Show>
          <Show when={connState() === "closed"}>
            {connError() ?? "Disconnected"} — retrying…
          </Show>
        </span>
        <Show when={needsAuth()}>
          <form onSubmit={applyToken} class="flex items-center gap-2">
            <input
              type="password"
              value={token()}
              onInput={(e) => setLocalToken(e.currentTarget.value)}
              placeholder="hub token"
              class="font-precise text-xs bg-surface text-on-surface border-2 border-border-subtle rounded-lg px-2.5 py-1 focus:border-apricot focus:outline-none transition-colors"
            />
            <button
              type="submit"
              class="cursor-pointer type-label font-semibold text-on-send bg-apricot hover:bg-apricot-strong px-3 py-1 rounded-lg transition-colors"
            >
              Connect
            </button>
          </form>
        </Show>
      </div>
    </Show>
  )
}
