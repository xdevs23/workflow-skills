import type { RouteSectionProps } from "@solidjs/router"
import Sidebar from "../components/sidebar"
import ConnBanner from "../components/conn-banner"

// The app shell: a two-pane grid (sidebar + routed thread), with a connection banner
// overlaid when the socket is down or an auth error needs the token.
export default function AppLayout(props: RouteSectionProps) {
  return (
    <div class="h-screen w-screen overflow-hidden bg-bg text-on-bg grid grid-cols-[354px_1fr]">
      <Sidebar />
      <main class="bg-surface flex flex-col min-w-0 min-h-0 relative">
        <ConnBanner />
        {props.children}
      </main>
    </div>
  )
}
