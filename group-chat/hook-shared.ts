// Shared helpers for the group-chat hooks (PreToolUse + SessionEnd). These hooks
// are standalone bun executables Claude Code spawns per event, but they share the
// SAME hub-connection contract: parse GROUP_CHAT_URL, learn this host, compose the
// opaque session KEY, and open a transient authenticated socket to send ONE frame.
// Keeping this in one module means the session-key shape and the handshake live in
// exactly one place — a change can't silently diverge between the two hooks.

import { hostname } from "node:os";
import { PROTOCOL_VERSION } from "../servers/group-chat-hub/protocol.ts";

// Parse GROUP_CHAT_URL: ws(s)://[token@]host:port, where the userinfo is the token.
// Returns null if unset/unparseable (the caller then no-ops — hooks never block).
export function parseHub(raw: string): { url: string; token: string } | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    const token = decodeURIComponent(u.username || "");
    u.username = "";
    u.password = "";
    return { url: u.toString(), token };
  } catch {
    return null;
  }
}

// This adapter's own device hostname (used to namespace registered aliases).
export function selfHost(): string {
  try {
    return hostname() || "unknown";
  } catch {
    return "unknown";
  }
}

// The opaque session KEY the hub keys on: the bare session_id for a main-agent
// call, or "<session_id>:<agent_id>" for a subagent call. The hub treats it as one
// opaque string and never parses it. This is the load-bearing session-key contract
// — both hooks MUST compose it identically.
export function composeSessionKey(sessionId: string, agentId?: string): string {
  return agentId ? `${sessionId}:${agentId}` : sessionId;
}

// Open a transient authenticated hub connection, send ONE frame on `welcome`, then
// close. Resolves when the frame is sent (or on ANY failure — hooks never propagate
// errors and never block their event). Bounded by `timeoutMs`. The frame to send is
// produced by `frameFor` once the socket is authenticated; returning it lets each
// hook supply its own one-shot frame (map_session vs release_session).
export function sendOneFrame(
  hub: { url: string; token: string },
  frameFor: () => Record<string, unknown>,
  timeoutMs: number,
): Promise<void> {
  return new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      resolve();
    };
    const timer = setTimeout(finish, timeoutMs);

    let ws: WebSocket;
    try {
      ws = new WebSocket(hub.url);
    } catch {
      clearTimeout(timer);
      resolve();
      return;
    }
    ws.addEventListener("open", () => {
      try {
        ws.send(
          JSON.stringify({
            t: "hello",
            token: hub.token,
            protocol: PROTOCOL_VERSION,
            host: selfHost(),
          }),
        );
      } catch {
        finish();
      }
    });
    ws.addEventListener("message", (ev) => {
      let frame: { t?: string };
      try {
        frame = JSON.parse(String(ev.data));
      } catch {
        return;
      }
      if (frame.t === "welcome") {
        try {
          ws.send(JSON.stringify(frameFor()));
        } catch {
          /* ignore */
        }
        // Give the frame a moment to flush, then close. The hub needs no reply.
        setTimeout(finish, 50);
      } else if (frame.t === "error") {
        finish(); // bad token / protocol — nothing we can do, don't block the event
      }
    });
    ws.addEventListener("error", () => finish());
    ws.addEventListener("close", () => finish());
  });
}
