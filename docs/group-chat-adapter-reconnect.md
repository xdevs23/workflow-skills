# Group-chat: adapter_id — reconnect re-binds identity to the hub

## Problem (proven)

Group fan-out and `[attached]` status depend on the hub's `sessionConns` map
(`session → live connections`), written ONLY by `bindSession`, which runs ONLY when
a frame carries a resolvable session (a `tool_use_id` mapped by the PreToolUse hook,
or a direct `session`).

On a hub RESTART (or any reconnect to a fresh-state hub) the hub's
`tool_use_id → session` map is empty. The adapter's WS reconnects and sends `hello`,
but **nothing tells the new hub which session that connection serves** — there is no
per-tool-call hook frame yet. So the identity is `[detached]`: the durable handle/
membership exists in the DB, but no live connection is assigned to it →
`isOnline` false → group pushes SKIP that member. It self-heals only on the NEXT
tool call (which carries a fresh hook-mapped `tool_use_id`).

(The old reconnect mechanism — the adapter replaying `join` frames on `welcome` —
was removed: those joins carried no session, so they never bound. Useless. Gone.)

## The model (authoritative)

The adapter is a **stateless relay** that serves MANY sessions over its life (one
process, one socket; the active session changes via `/resume`). It cannot "remember
its session" — that premise doesn't exist.

The one thing the adapter holds is an **`adapter_id`**: a UUID the **HUB assigns**
on first connect, which the adapter keeps in **memory** and echoes on **every
subsequent `hello`**.

- **Hub-minted.** First connect: the adapter sends `hello` with NO `adapter_id`; the
  hub generates a UUID and returns it in `welcome`; the adapter holds it. Every
  later `hello` (reconnect) carries that held id, so the hub recognizes the same
  endpoint.
- **Per-process, NOT persisted.** The held id lives only in adapter memory. A
  restarted adapter process is (almost certainly) a fresh Claude Code session about
  which we can assume NO prior state — so it sends no id, gets a NEW one, and
  reacquires nothing stale.
- It survives **socket drops within one process** — exactly the reconnect case
  (hub restart, network blip) where the SAME adapter process re-establishes its WS
  and re-presents its held id.

So `adapter_id` is the stable handle for "this live relay endpoint," meaningful for
that process's lifetime. The hub differentiates a NEW adapter (unknown id) from a
RECONNECTING one (known id) and, for a reconnecting one, **re-binds all the push
channels (identities) that adapter was serving** — with no tool call, surviving a
hub restart (because the binding is durable, keyed by `adapter_id`).

## Mechanism (grounded in the code)

1. **Adapter:** holds `let adapterId: string | null = null` (in memory). On `hello`
   send `adapter_id` only if held: `{ t: "hello", token, protocol, host,
   ...(adapterId ? { adapter_id: adapterId } : {}) }` (adapter.ts:119). On `welcome`
   (adapter.ts:186), if it carries an `adapter_id` and we don't have one yet, store
   it: `adapterId = frame.adapter_id`.

2. **Hub `welcome`/`hello`:** `Connection` (hub.ts:314) gains `adapterId: string`.
   In the `hello` handler (hub.ts:805): if `frame.adapter_id` is present and known,
   use it; otherwise MINT a fresh `randomUUID()`. Set `conn.adapterId`. Return it in
   `welcome`: `{ t: "welcome", protocol, adapter_id: conn.adapterId }`.

3. **Durable lease table** (new `user_version` migration, append to MIGRATIONS
   hub.ts — per the versioned-migration policy):
   ```sql
   CREATE TABLE adapter_sessions (
     adapter_id  TEXT,
     session_id  TEXT,
     PRIMARY KEY (adapter_id, session_id)
   );
   ```
   One row per (adapter_id, session) the adapter is currently serving.

4. **`bindSession`** (hub.ts:1337): when it binds session `sid` for `conn`, UPSERT
   `(conn.adapterId, sid)` into `adapter_sessions`. This is the durable record of
   "adapter A serves session S."

5. **`hello` handler** (hub.ts:805): after auth, look up
   `SELECT session_id FROM adapter_sessions WHERE adapter_id = ?`; for each, call
   `bindSession(conn, sid)` immediately — repopulating `sessionConns` for this fresh
   connection BEFORE `welcome` returns. The reconnecting (or post-restart) adapter
   is re-attached with NO tool call and NO hook. (`bindSession` already flushes
   queued DMs for a session that was offline — that flush now also fires here.)

6. **Resume-supersede (constraint: only the active identity receives pushes).** A
   socket that bound session A then resumes into B leaves A in `sessionConns`
   (it's the historical set, cleared only by `onDisconnect`, hub.ts:1404) — so A
   would keep getting pushes. Fix: when a connection's active session changes to a
   NEW session, supersede the prior one for THIS adapter — remove the old session
   from `sessionConns` for this conn AND delete its `adapter_sessions` row — so a
   resumed-away identity stops receiving pushes and stops being re-bound on
   reconnect. (Trigger: in `bindSession`, when the connection's ACTIVE bound
   session changes to a different non-null sid, detach the previous one.)

   **Anchor on the ACTIVE session, not the per-frame `sessionId`.** The supersede
   comparison must use a dedicated `conn.boundSession` (the last session
   `bindSession` established), NOT `conn.sessionId` (the per-FRAME account). Reason:
   `dm_ack`/`dm_read` are ATTRIBUTION-ONLY frames — they assert a `session` purely
   so the hub credits a DM receipt to the right account on a multi-session socket,
   referencing a possibly-DIFFERENT session than the live one. They are not a
   /resume. If the supersede compared `conn.sessionId`, such a receipt would look
   like an active-session change and tear down the live group session (drop it from
   `sessionConns` + its lease), silently detaching a member mid-session. So those
   two frame types stamp `conn.sessionId` for their handler to read but DO NOT call
   `bindSession` (no route, no lease, no supersede); only the real active-identity
   path (a directly-asserted `session` or a `tool_use_id`-resolved one) binds and
   moves `boundSession`. (Rejected: routing `dm_ack`/`dm_read` through `bindSession`
   and comparing `sessionId` — it regressed the existing adapter test by detaching
   the joined member as soon as a queued DM-read drained.)

7. **Gap-bridging is per-adapter_id.** The brief-reconnect group-push gap window
   (online-only, in-memory today) is keyed by `adapter_id` rather than by member/
   session, since the `adapter_id` is what reconnects and reacquires the channels.

8. **`onDisconnect`** (hub.ts:1401): unchanged in spirit — clears `sessionConns`
   for the dropped conn (member goes offline). It does NOT delete the
   `adapter_sessions` lease — that's what lets a reconnect re-bind. The lease is
   superseded only by a resume (step 6), and otherwise accumulates.

## Lifecycle summary

- **First connect:** unknown `adapter_id` → no lease → attaches normally as tool
  calls bind sessions (which also write the lease).
- **Socket drop / hub restart, same process:** same `adapter_id` at `hello` → hub
  finds the lease → re-binds its session(s) immediately → `[attached]`, pushes
  resume, no tool call needed.
- **/resume A→B:** B's first bind supersedes A (drops A from `sessionConns` +
  lease). Reconnect now re-binds B, never A.
- **Adapter process restart:** new `adapter_id` → no lease → starts fresh (correct:
  new session, no assumable state). The old adapter_id's lease rows are orphaned.

## Out of scope (explicit)

- **GC of orphaned `adapter_sessions`** (dead adapter_ids accumulate). Deferred —
  noted as a follow-up. Harmless to correctness; just unbounded growth over time.
- Heartbeat / proactive dead-socket detection (separate concern).

## Wire protocol

- `hello` (adapter→hub) gains `adapter_id: string`. Bump `PROTOCOL_VERSION` (→ 5)
  since `hello` shape changed and the hub now expects it; update test peers.

## Rejected alternatives (the 4 we discarded, why)

- **SessionStart-hook push of the active session.** SessionStart does NOT fire on a
  hub restart — so it can't re-attach after the exact event that breaks delivery.
- **Adapter writes an active-session file the adapter replays.** Same flaw (driven
  by SessionStart) + writes ephemeral bytes to disk.
- **Durable host→session reverse index, status-only.** Only makes the DISPLAY
  honest (`[reconnecting]`); does not re-route delivery — the member still misses
  pushes. Doesn't fix the actual problem.
- **In-memory adapter lease.** Identical to this design but the hub keeps the lease
  in memory → wiped on hub restart → useless for the hub-restart case, which is the
  whole point. The lease MUST be durable.
