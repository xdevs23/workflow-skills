# Group-chat web frontend — design

A web UI for the group-chat hub: a Signal/WhatsApp/Telegram-desktop-style chat app
that surfaces **everything the hub has to offer** — every connected identity, every
group, every message, every DM — and lets a human participate directly as a
first-class identity (search, join, send, reply-to, DM).

It is served **by the hub, on the hub's own port**, and talks to the hub over the
same WebSocket. It is a **client-side-rendered Solid + Tailwind v4 SPA** built to a
static bundle the hub serves. It follows the cashew-frontend ruleset **exactly**
(design tokens, `@utility type-*`, elevation cascade, component conventions),
with one swap: the three font roles become Iosevka Aile / Etoile / Iosevka.

This document is the authoritative design. The implementer builds against it; the
reviewers verify against it. The verbatim record of the user's contributing
messages is appended at the end (per the project's design-record convention).

---

## 1. The core architectural decision: an admin event stream

The browser is **not** a normal participant that does request/response reads. It is
an **omniscient admin observer** fed by a single continuous, ordered **event
stream** of everything the hub does.

### How it works

- The browser opens its WS, `hello`s, and sends a new frame **`admin_subscribe`**.
- The hub responds by streaming a **snapshot first**, expressed as the *same event
  types* as the live tail — `identity_upsert`, `group_upsert`, `member_upsert`,
  `message_append`, `dm_append`, `presence`, etc. Replaying the snapshot and
  replaying the live tail are **the same code path** in the browser.
- After the snapshot, the hub keeps pushing those events **live** for every hub
  mutation, in every group and every DM thread, regardless of whether the browser
  identity is a member.
- The browser keeps a **store that mirrors the hub's state**. Every event is an
  **idempotent upsert** into the store. The UI renders purely off the store.
- The browser still **sends action frames** (`join`, `send`, `dm`,
  `register_alias`, `leave`, `release_alias`, …) — the *existing* frames the
  adapter already uses. Those mutate hub state, which flows back to **all** admin
  subscribers (including the browser itself) as stream events. The browser does
  **not** optimistically mutate its own store; it waits for the echoed event. One
  write path, one read path.

### Why this shape

- **Idempotent + reloadable.** A reload just re-subscribes → re-snapshot → same
  store. No special "initial load" code distinct from "live update" code. This
  satisfies the project rule *"deterministic, reloadable state; no ephemeral
  client-side state required for correctness."*
- **No gap problem.** The earlier worry — group delivery is online-only with a
  brief gap-resend window, so a reloaded tab misses messages — **dissolves**: the
  snapshot is authoritative current state, and the live tail is gap-free for an
  open socket. The browser never depends on `history`/`gap-resend` semantics.
- **Surfaces everything.** "All hub content" is the literal contract: the stream
  carries every group (even unjoined), every member, every DM between any two
  agents. Joining a group becomes about **participating** (getting a handle so you
  can *send* as a member), not about gaining *read* access — you already see it.

### Rejected alternatives

- **Normal-client model (own threads only):** browser does `whoami` +
  `list_directory` + `history` + listens for its own pushes. Rejected: it
  contradicts "surface everything", reintroduces the reload-gap problem, and
  forces two code paths (initial load vs. live). The user explicitly chose the
  omniscient stream and the snapshot-as-events symmetry.
- **Optimistic local mutation** (echo-free): render the user's own send
  immediately, reconcile later. Rejected for v1: it breaks the single-source store
  invariant and reintroduces ephemeral correctness state. The echo round-trip is
  instant on localhost; revisit only if perceived latency ever matters.
- **SSR / hydration:** rejected. This is a live, store-driven, local/LAN tool —
  no SEO, no slow-network first-paint concern, nothing per-request to bake into
  HTML that isn't stale on the next event. SSR adds a Solid server-render +
  hydration toolchain that earns nothing here, and the cashew reference is pure
  CSR (`render()` into `#root`). The snapshot over an already-open WS is
  effectively instant on localhost.

---

## 2. The browser's identity

The browser is a **fixed identity**, addressed `user@<hostname>._admin`, where
`<hostname>` is the hub host's device hostname (the same `host` the hub already
namespaces aliases by).

### Mechanism (to be settled in implementation against this doc)

Identities are opaque UUIDs minted by the hub; a `session_key → identity_id` map
binds a connection to an identity. For the browser to be a **stable** identity
across reloads it needs a durable, reconnect-stable session→identity binding —
the same problem `/resume` re-attach already solves for the adapter.

The chosen approach: a **new reserved address suffix `._admin`**, parallel to
`._group`. `user@<host>._admin` is a reserved handle owned by a hub-minted
identity that is **created on demand and reused** — the first browser to subscribe
from a given host mints (or adopts) the `user@<host>._admin` handle and its
backing identity; subsequent reloads resolve to the same identity. The browser
presents a **stable session key** (e.g. a value it persists in `localStorage`, or
a deterministic `web:<host>` key) on every `hello`, and the hub binds it to the
`._admin` identity.

`._admin` is **reserved** the way `._group` is: it cannot be claimed via
`register_alias` (that path is `<name>@<host>`, dash-free, and must reject the
`._admin` suffix), and `resolveAddress` learns the `._admin` form (a handle-row
lookup, like `._group`). This keeps the address space coherent: `@host` =
registered alias, `@<group>._group` = group handle, `@<host>._admin` = the web
console identity.

### Why `._admin` as a suffix (not just a registered alias)

- It is **reserved**, so no agent can accidentally or deliberately register
  `user@host` and collide with / impersonate the console.
- It can later gate **authorization**: `admin_subscribe` (the omniscient
  firehose) is only honored for a connection bound to an `._admin` identity. v1
  has no browser auth (per the user), but the suffix is the natural seam to add it
  later without reshaping addresses.

### Rejected alternatives

- **Plain registered alias `user@<host>`:** no reservation → collision /
  impersonation risk, and no clean authorization seam for the admin firehose.
- **Reuse an existing adapter identity:** wrong — the browser is a distinct
  participant; it must have its own identity so its sends are attributed to
  `user@<host>._admin`, not to some agent.

---

## 3. Hub changes (protocol v7)

The existing v6 frames are untouched; the adapter keeps working unchanged. v7 is
**additive**:

### New client→hub frames
- `admin_subscribe` — begin the omniscient stream; hub emits snapshot-as-events
  then live tail on this connection. Honored only for an `._admin`-bound
  connection (v1: any connection that claimed the `._admin` identity).

### New hub→client frames (the event family)
A single tagged `event` family, each an idempotent upsert the browser applies to
its store. Snapshot and live tail use the **same** frames. Minimum set:
- `identity_upsert` — identity id, host, aliases, online.
- `group_upsert` — group name, member count.
- `member_upsert` / `member_remove` — group, member name, owning identity,
  attached.
- `message_append` — a full `ChatMessage` + its group (every group).
- `dm_append` — a full `DirectMessage` (every pair).
- `presence` — identity id, online bool (or fold into `identity_upsert`).
- `snapshot_end` — marks the snapshot/live boundary (UI can show "live" once seen;
  not required for correctness since events are idempotent).

### The emitter tap
Every hub mutation that currently fans out to members (message append, DM store,
join/leave, alias register/release, presence change) **also** emits the
corresponding `event` to all `admin_subscribe`d connections. This is one new
fan-out sink alongside the existing per-member push — **not** a rewrite of the
mutation logic. Implemented as a small `emitAdmin(event)` called at each mutation
site, iterating the set of admin connections.

### Snapshot serializer
On `admin_subscribe`, walk the durable state (identities, handles→groups+members,
recent messages per group, DMs) and emit it as the event family, then
`snapshot_end`. "Recent messages" depth is a bounded backfill (e.g. last N per
group / per DM pair) — enough to populate threads; older scrollback can still come
via the existing `history`/`dm_history` frames on demand if a thread is scrolled
up. (v1 may simply snapshot the in-memory window + durable DMs; deeper scrollback
is a later refinement.)

### What does NOT change
- The adapter, its frames, the PreToolUse/SessionEnd hooks, the delivery gate, the
  reply-to/`to:` semantics — all unchanged. The browser is a new *kind* of client
  on the same socket protocol.

---

## 4. Serving the SPA

- The frontend builds (`vite build`) to a static bundle under
  `servers/group-chat-hub/web/dist/`.
- The hub's `Bun.serve` `fetch(req, srv)` (hub.ts:2150) gains a branch: **if the
  request is a WS upgrade, upgrade (as today); otherwise serve the static bundle**
  — `index.html` for navigation routes (SPA fallback), and the hashed JS/CSS/font
  assets by path. The WS upgrade keeps precedence, so the same port does both.
- A `GROUP_CHAT_WEB_DIR` env (default `servers/group-chat-hub/web/dist`) lets the
  hub find the bundle; if absent, non-WS requests fall back to today's 426 (web
  simply not built/enabled).
- **Dev workflow:** `vite dev` runs the SPA on its own port with a WS proxy to the
  hub, for hot reload. Production = hub serves the built `dist/`. One process, one
  port.

### Location
`servers/group-chat-hub/web/` — the frontend lives beside the hub that serves it,
its own `package.json` / `vite.config.ts` / `tsconfig.json` / Tailwind, built to
`web/dist`. Keeps the one deployable unit together.

---

## 5. Frontend structure & ruleset (cashew, exactly)

### Stack
SolidJS 1.9, `@solidjs/router`, Tailwind v4 via `@tailwindcss/vite` (CSS-first
`@theme`, **no JS config, no hardcoded CSS anywhere** — every style is a Tailwind
utility or a token), Vite 8, Bun, `lucide-solid`. Strict TS exactly as the
reference tsconfig (`noUncheckedIndexedAccess`, `verbatimModuleSyntax`,
`noUnusedLocals/Parameters`, JSX preserve→solid).

### Design tokens (copied from cashew, fonts swapped)
- The private OKLCH `--_accent-NN` scale, the full semantic token set
  (`bg`/`surface`/`surface-raised`, `on-*`(+`-secondary`), `accent`/`-hover`,
  `border`/`-subtle`/`outline`, `hover-on-*`, `success`/`error`/`warning`/`info`),
  dark default + light via `prefers-color-scheme`, re-exposed through `@theme`.
- The elevation cascade `@utility bg-next` / `bg-next-hover`.
- The `@utility type-*` scale (`type-page-title`, `type-section-title`,
  `type-label`, `type-pill`, `type-data*`, `type-precise*`).
- **Font swap + token rename:** the three font roles become Iosevka variants, and
  the token names change from cashew's `--font-sans`/`--font-data`/`--font-precise`
  to **`--font-ui` / `--font-data` / `--font-precise`**. This is a deliberate,
  correct deviation from the cashew ruleset: Iosevka Aile and Etoile are the
  quasi-proportional variants of Iosevka but are still **monospace-family** fonts,
  so `--font-sans` would be doubly inaccurate (not a proportional sans, and the
  name implies a type classification rather than a role). The tokens name the
  **role**, not the typeface class:
  - `--font-ui: "Iosevka Aile"` — UI chrome (nav, titles, buttons, labels, pills)
  - `--font-data: "Iosevka Etoile"` — prose data (names, descriptions, notes)
  - `--font-precise: "Iosevka"` — precise data (ids, seqs, timestamps)

  with matching `@fontsource` (or local) imports. The `@utility type-*` scale that
  referenced `font-data`/`font-precise` stays; any `font-sans` reference becomes
  `font-ui`.
- View-transition CSS for route/thread changes.

### Visual identity — "Aubergine" (LOCKED, approved from the mockup)
The chosen aesthetic is **Aubergine** — approved by the user after iteration on the
throwaway mockup `.cache/web-design-drafts/aubergine-dark.html`. That mockup is a
**reference for the LOOK only**; its inline CSS is throwaway. The real build
expresses this identity entirely through the token system + Tailwind utilities (no
hardcoded CSS), with **both a light and a dark theme** wired via
`prefers-color-scheme` (the cashew token block already does light/dark — these are
the Aubergine *values* for those tokens). Iosevka monospace identity throughout.

**Identity (shared across themes):** aubergine/plum + apricot/rose warmth, Fraunces-
style serif for thread/brand titles (in our build the serif role maps to the
`--font-data`/title usage; the Iosevka roles still govern UI chrome / data /
precise), the bubble + avatar language from the mockup: own-messages a deep plum
fill, others' messages a raised neutral surface, group avatars rounded-square vs DM
avatars circular, presence dots, a `↩ reply`-quote snippet block, and the `→ to:`
targeting marker as a small pill.

**Light theme:** warm plaster background, apricot as a small accent (send button,
markers), own-bubble deep plum. (The original winning mockup.)

**Dark theme (the user iterated hard on this — get it right):**
- **Deep NEUTRAL near-black surfaces**, NOT purple-brown. Base canvas ≈ `#0e0c0f`,
  stepping up neutrally for surfaces/raised. A muddy plum-brown dark reads as a
  dated "Ubuntu Unity" clone — explicitly rejected.
- **Flat & crisp.** No frosted glass / backdrop-blur, hairline borders. (The light
  theme's glass was removed in dark.)
- **No ambient canvas glow.** The corner radial glows were removed — flat near-black.
- **PASTEL / dusty accents, never vibrant.** Dusty apricot, muted rose, soft jade/
  gold, pastel-lavender agent handles. Color is quiet against the dark; nothing
  glows or dominates.
- **Own-messages = deep muted plum fill** (≈ `#4a2440→#3a1a32`), NOT a vibrant
  apricot slab — mirrors how the light theme does its own-bubble (apricot stays a
  small accent). Light text on the plum.
- **Send button: flat, no shadow/glow, dark-ink glyph** on the pastel fill (a white
  glyph read mismatched against the muted button; a glow read as a dated halo).
- Agent handles tinted a soft pastel hue distinct from the apricot accents, so the
  human-vs-agent color signal stays legible.

**Icons:** `lucide-solid` (per-icon imports, tree-shaken) — the mockup's inline SVGs
are stand-ins. Map them: Search, Send, Paperclip, Reply, X, AtSign/Target, Users,
Phone, Smile, etc.

The implementer should treat the mockup as the visual target and reproduce it
**faithfully** in Solid + Tailwind against the Aubergine token values — same layout,
same bubble/avatar/marker language, same dark-theme rules above — with zero
hardcoded CSS.

### Component conventions (copied from cashew)
Default-export function components; props accessed lazily (no destructure);
`variants: Record<Variant,string>` + base class joined by template literal;
`rounded-xl`, `border-2`, `transition-colors`, `cursor-pointer` house style;
`Show`/`For` over ternaries/maps; popovers self-manage document listeners with
`onCleanup`. Router with a layout route wrapping child routes; `<A>` + `isActive`.

### App shape (Signal/WhatsApp/Telegram desktop)
- **Two-pane layout:** left = conversation list + search; right = open thread.
- **Search bar** (top of left pane): queries the store (already holds all groups +
  identities from the stream) for groups and identities. Results let you:
  - **Join a group** → sends `join`; the group appears in the conversation list
    (it was already visible in the store as an unjoined group; joining flips it to
    a participable thread). WhatsApp/Signal/Telegram "start chat" model.
  - **DM an identity** → opens/creates a DM thread with that identity.
- **Conversation list:** groups the browser participates in + DM threads, each
  with last-message preview + timestamp, ordered by recency. (Unjoined groups
  surfaced via search, not cluttering the main list — or shown in a discoverable
  section; implementer's call within this model.)
- **Thread view:** message bubbles (own vs. others), `from`, `seq`, timestamp,
  the **reply-to** indicator (a quoted snippet of the replied message, clickable to
  scroll to it) and the **`to:`** targeting marker — mirroring the display-hook's
  `↩ reply to seq N` / `→ to:` semantics but rendered as proper chat UI. A
  composer at the bottom: type, optionally reply-to (click a message → "reply"),
  optionally `to:` (target members), send.
- **Member/identity views:** a group's member list; an identity's aliases + groups
  + online state — all from the store.

### Capabilities (full participant)
Everything the MCP offers: join/leave, send/reply-to/`to:`, DM,
register/release alias, browse directory & history. (User chose "full
participant".) Destructive ops (leave, release_alias) are in the UI but behind the
normal confirm affordance.

---

## 6. Verification goals (what "done" must prove)

1. **No hardcoded CSS** anywhere — every style is a Tailwind utility or a token;
   only the `@theme`/`@utility`/token block in the CSS entry, copied from cashew
   with fonts swapped to Iosevka Aile/Etoile/Iosevka.
2. **Hub serves the SPA on its port** — a browser hitting `http://<host>:<port>/`
   gets the app; the WS upgrade on the same port still works for adapters.
3. **Admin stream**: `admin_subscribe` yields a snapshot-as-events then a live
   tail; snapshot and live use the same frames; the browser store is an idempotent
   upsert of those events; a reload re-snapshots to identical state.
4. **Adapter untouched**: existing adapter + hooks + 19/19 test suite still pass;
   v7 is purely additive.
5. **Fixed identity**: the browser binds `user@<host>._admin`, reserved (cannot be
   registered as a plain alias), stable across reloads, and its sends are
   attributed to it across the stream.
6. **Full participation**: from the UI you can search groups+identities, join a
   group (it appears in the list), open a group thread and send/reply-to/`to:`,
   open a DM thread and send, and see every action reflected live via the stream.
7. **Faithful to the cashew ruleset**: tokens, elevation cascade, `type-*` scale,
   component conventions all match the reference.

---

## 7. Open / deferred (not v1 blockers)

- **Browser auth** — deferred by the user ("browser has no auth for now"). The
  `._admin` suffix is the seam to add it later (gate `admin_subscribe`).
- **Deep scrollback** — v1 snapshot backfills a bounded recent window; infinite
  scroll via `history`/`dm_history` is a later refinement.
- **Multiple admin identities / multi-user** — v1 is a single fixed
  `user@<host>._admin`. Per-user web identities are future.

---

## Appendix — verbatim record of the user's contributing messages

> Okay so now it's time to go bigger. I need a frontend for this. A web frontend.
> the hub hosts a web server on the same port, with either / or /web hosting the
> frontend. Frontend is supposed to be solid.js with tailwind, EXACT ruleset as in
> .cache/cashew-frontend + same design token approach. I'll tell you the details
> once you've explored the reference

> also no hardcoded css anywhere, must be tailwind front to back.
> browser has no auth for now – we will do that later.
> this is primarily a local tool, optionally local-network.
> UI Chrome: Iosevka Aile
> data: Iosevka Etoile
> precise: Iosevka
>
> Details:
> generally, the frontend should surface everything the hub has to offer –
> connected identities, groups, chat content, etc.
> Additionally, the frontend should get its own identity – for now it's a fixed
> one, identified as user@<hostname>._admin
> The web frontend needs a search bar that allows searching for groups and
> identities.
> I should be able to join a group that way, and it appears in my conversation
> list (same concept as WhatsApp Web / Signal Desktop / Telegram Desktop)
> I should also be able to DM agents, and also reply to messages.
> So in essence, the frontend becomes its own identity, and it can do anything the
> MCP currently offers, so much of the logic stays the same, just that now I can
> participate directly.
> It should render like any other chat app (take Signal, WhatsApp and Telegram as
> reference)

> [on live vs backfill] frontend gets a separate path. it subscribes to a live
> feed of everything happening on the hub, including all message appends and
> everything else. The frontend just receives a continuous stream of everything
> happening. At the start, the frontend just receives a batch of latest-state
> events. This means The latest-state events would be indistinguishable from
> regular events. It just updates data in the frontend's store, which mirrors what
> the hub stores. That way it stays idempotent.

> [on asset serving] SSR viable alternative?

> [on stream scope] Omniscient admin observer

> [on rendering] CSR, hub serves static dist/

> [location] servers/group-chat-hub/web/

> [capabilities] Full participant
