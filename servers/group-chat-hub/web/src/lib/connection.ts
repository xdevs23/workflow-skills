import { createSignal } from "solid-js"
import { PROTOCOL_VERSION, type ClientEnvelope, type ServerFrame } from "./protocol"
import { applyEvent, resetStore } from "../store/store"

// The single WebSocket connection to the hub. Owns the handshake (hello →
// admin_subscribe), reconnection, and the stable identity binding the browser
// presents on every reconnect. Action frames go out through `send`; inbound events
// flow into the store via the ONE reducer (applyEvent) — snapshot replay and live
// tail are the same code path.

// ── stable, reload-persistent credentials (localStorage) ──
// The session KEY binds the browser to a stable hub identity across reloads (the
// hub maps session_key → identity_id durably). The adapter_id lets the hub re-bind
// the leased session on reconnect with no extra round-trip. The host namespaces the
// reserved `user@<host>._admin` handle.

const LS = {
  session: "gc.session_key",
  adapter: "gc.adapter_id",
  token: "gc.token",
} as const

function persisted(key: string, mint: () => string): string {
  const existing = localStorage.getItem(key)
  if (existing) return existing
  const fresh = mint()
  localStorage.setItem(key, fresh)
  return fresh
}

function uuid(): string {
  return crypto.randomUUID()
}

// A stable per-browser session key (reused across reloads → same hub identity).
const SESSION_KEY = persisted(LS.session, () => `web:${uuid()}`)
// A stable per-browser adapter id (the relay endpoint id the hub re-binds on
// reconnect). Persisted so a reload re-attaches the leased session immediately.
const ADAPTER_ID = persisted(LS.adapter, () => uuid())
// The host the console identity is namespaced by: `user@<host>._admin`. The browser
// presents its own hostname (the hub host as the browser addresses it).
const HOST = location.hostname || "localhost"

export function getToken(): string {
  return localStorage.getItem(LS.token) ?? ""
}
export function setToken(token: string): void {
  localStorage.setItem(LS.token, token)
}

// ── reactive connection state (UI reads these) ──
export type ConnState = "connecting" | "live" | "snapshotting" | "closed"
const [state, setState] = createSignal<ConnState>("connecting")
const [identityId, setIdentityId] = createSignal<string | null>(null)
const [lastError, setLastError] = createSignal<string | null>(null)
export { state as connState, identityId as selfIdentity, lastError as connError }

// The console identity's host (for rendering its `user@<host>._admin` address).
export const selfHost = HOST

let ws: WebSocket | null = null
let reconnectTimer: number | undefined
let backoff = 500
let ridCounter = 0

function wsUrl(): string {
  const proto = location.protocol === "https:" ? "wss:" : "ws:"
  // Always `/ws`: the hub upgrades ANY path (same origin in production), and the
  // dev server proxies `/ws` to the hub.
  return `${proto}//${location.host}/ws`
}

// Send an action frame. Every account-bound frame carries the stable `session` key
// (the hub's direct-assertion binding path) so the hub resolves it to the console
// identity. Returns the `rid` stamped, for callers that await a reply (none do — the
// browser mirrors via the event stream, not replies).
export function send(frame: ClientEnvelope): string | null {
  if (!ws || ws.readyState !== WebSocket.OPEN) return null
  const rid = `r${++ridCounter}`
  const envelope: ClientEnvelope = { ...frame, rid, session: SESSION_KEY }
  ws.send(JSON.stringify(envelope))
  return rid
}

function open(): void {
  setState("connecting")
  const sock = new WebSocket(wsUrl())
  ws = sock

  sock.addEventListener("open", () => {
    backoff = 500
    // hello binds the socket (v7) and re-binds the leased session via adapter_id.
    sock.send(
      JSON.stringify({
        t: "hello",
        token: getToken(),
        protocol: PROTOCOL_VERSION,
        host: HOST,
        adapter_id: ADAPTER_ID,
      } satisfies ClientEnvelope),
    )
  })

  sock.addEventListener("message", (ev) => {
    let frame: ServerFrame
    try {
      frame = JSON.parse(ev.data as string) as ServerFrame
    } catch {
      return
    }
    onFrame(frame)
  })

  sock.addEventListener("close", () => {
    if (ws === sock) {
      ws = null
      setState("closed")
      scheduleReconnect()
    }
  })

  sock.addEventListener("error", () => {
    // The close handler drives reconnect; just record a hint.
    setLastError("connection error")
  })
}

function onFrame(frame: ServerFrame): void {
  switch (frame.t) {
    case "welcome": {
      // Handshake accepted. Persist the adapter id the hub acknowledged (it echoes the
      // one we presented; if the hub ever re-mints, we adopt its value rather than
      // staying stuck on our stale local one), learn our own identity (whoami), then
      // start the omniscient stream. Reset the store so the fresh snapshot replays into
      // a clean slate (deterministic re-snapshot).
      const acked = (frame as { adapter_id?: string }).adapter_id
      localStorage.setItem(LS.adapter, acked || ADAPTER_ID)
      setLastError(null)
      resetStore()
      setState("snapshotting")
      send({ t: "whoami" })
      send({ t: "admin_subscribe" })
      return
    }
    case "error": {
      const e = frame as { code: string; message: string }
      setLastError(`${e.code}: ${e.message}`)
      return
    }
    case "event": {
      const f = frame as { event: Parameters<typeof applyEvent>[0] }
      applyEvent(f.event)
      if (f.event.type === "snapshot_end") setState("live")
      return
    }
    default: {
      // whoami reply: capture our own identity id (own-bubble + DM threading).
      if (frame.t === "whoami" && typeof frame.identity_id === "string") {
        setIdentityId(frame.identity_id)
      }
      // Other v6 reply frames (joined/sent/dm_sent/…) are not state-bearing — the
      // browser mirrors via the event stream — so they are accepted and ignored.
      return
    }
  }
}

function scheduleReconnect(): void {
  if (reconnectTimer !== undefined) return
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = undefined
    backoff = Math.min(backoff * 2, 8000)
    open()
  }, backoff)
}

// Start the connection (called once at app boot).
export function connect(): void {
  if (ws) return
  open()
}

// Force a fresh reconnect (e.g. after the user sets a token).
export function reconnect(): void {
  if (ws) {
    const old = ws
    ws = null
    old.close()
  }
  if (reconnectTimer !== undefined) {
    clearTimeout(reconnectTimer)
    reconnectTimer = undefined
  }
  backoff = 500
  open()
}
