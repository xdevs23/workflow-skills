import { defineConfig } from "vite"
import solid from "vite-plugin-solid"
import tailwindcss from "@tailwindcss/vite"

// The hub host:port to proxy the dev WebSocket to. In production the SPA is served
// BY the hub on its own port, so the browser opens a same-origin WS; in dev vite
// serves the SPA on its own port and proxies the `/ws` upgrade to the hub.
const HUB = process.env.GROUP_CHAT_HUB ?? "127.0.0.1:8787"

export default defineConfig({
  plugins: [solid(), tailwindcss()],
  server: {
    port: 5175,
    proxy: {
      // The browser always opens `ws(s)://<origin>/ws`; the hub upgrades ANY path,
      // so `/ws` works in production (same origin) and is proxied here in dev.
      "/ws": {
        target: `ws://${HUB}`,
        ws: true,
        changeOrigin: true,
      },
    },
  },
})
