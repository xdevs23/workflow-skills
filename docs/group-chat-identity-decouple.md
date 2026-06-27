# Group-chat: decouple identity from session id (+ reply-to)

## Why this exists

Today the group-chat hub uses the **Claude Code session id as the identity**
everywhere ownership or addressing happens. A handle's owner is `owner_session`;
a DM is threaded by `from_session`/`to_session`; the default alias a member is
reachable at is literally `<session-id>@<host>`. The comment on `handles.owner_session`
admits the conflation: *"the identity that holds it (today == a session id)."*

This is wrong and confusing in practice:

- The naming makes you trip over session-vs-identity constantly — a column called
  `owner_session` actually means *owner identity*, and the value just happens to be
  a session id today.
- A session id is **not durable**: a `/resume` mints a new session id, which today
  means a new identity. The adapter_id lease (v5) patched this at the *connection*
  layer (re-binding sessions on reconnect) but not at the *identity* layer.
- The session id **leaks into the UX**: `whoami` prints it, `resolve`/`list_directory`
  show it, and the default alias `<session-id>@<host>` bakes it into an address a
  human types to reach someone.

We want identity to be its own **opaque, stable thing** that does not need to be —
and is deliberately not linked to — the session id. The session id becomes a pure
internal credential: it authenticates a live socket and says which identity that
socket currently speaks for, and nothing else. It disappears from the UX entirely.

This is the foundation the **reply-to** feature needs anyway: a reply must be able
to name the author of a past message and tell you where to reach them *even after
they have left the group* — which requires a durable identity anchor on the message
row, not a handle string that gets deleted on `leave`.

## The decisions (settled with the user)

| Decision | Choice | Why |
|---|---|---|
| Identity minting | **Hub mints, `sessions` table maps** | Hub mints an opaque `identity_id` (UUID) the first time it sees a new **session key**, stores `sessions(session_key → identity_id)`. Many session keys can map to one identity over time. |
| Session key shape | **Composite `"<session_id>[:<agent_id>]"`** | The opaque string the hub keys on. Main-agent calls → `"<session_id>"`. Subagent calls → `"<session_id>:<agent_id>"`. The hook composes it; the hub treats it as one opaque string and never parses it (see "Subagents"). |
| Decouple scope | **Full decouple now** | The user rejected "rename later" as a half-fix in tension with the target. Do it as the foundation, build reply-to on top. |
| Existing data | **Backfill: one identity per existing session** | Mint one `identity_id` per distinct session already in the DB, build the `sessions` map 1:1, rewrite every owner/from/to/pair column. Zero data loss on the running hub. |
| identity_id visibility | **Exposed as the canonical address** | So the session id can *disappear* from the UX. identity_id replaces session id in whoami/directory/resolve/DM-addressing. |
| Default alias | **`<identity-id>@<host>`** | The one place the session id was baked into an address. The opaque-but-stable identity replaces the per-session id. |
| Routing layer | **Identity-keyed; an identity MAY have several live sessions** | `sessionConns` → `identityConns: Map<identityId → Set<Connection>>`. Multiple live connections per identity are allowed (a `Set`); a push fans out to all of them. The `adapter_sessions` lease stays session-keyed (transport recovery). |
| /resume supersede | **Explicit release on SessionEnd; crash needs nothing** | A genuine `/resume` (new session id, SAME surviving adapter process) releases the prior session via an explicit `release_session` from a SessionEnd hook. Process death (crash/kill/quit) needs no release — the socket drops and existing `onDisconnect` handles it. Subagents do NOT trigger this (they share the parent session id; no new session). See "Resume mechanism". |
| Delivery gate | **Adapter gates both paths by target session key** | The adapter drops (does not surface) any push whose target ≠ a session key it currently serves. DMs already carry the target; group `message` frames get a stamped recipient identity so they can be gated the same way. |

### Reply-to (the feature this enables), settled separately

| Decision | Choice |
|---|---|
| Visibility | **Logged for all, pushed to author** — reply is a normal group message in history; live push goes only to the replied-to author (reuses the existing `to` push-filter). |
| Reference data | **Just the seq** — store `reply_to: <seq>`; `<channel>` event gets `reply_to="N"`. No denormalized snapshot/quote. |
| Offline author | **Log only, no durable redelivery** — same as a normal group message to an offline member; no DM-style queue. |
| Tool surface | **Param on `submit_message`** — optional `reply_to: <seq>` arg, not a new tool. |
| Author left the group | **Log-only + a warning** in the result naming the author and the aliases (and canonical identity address) you can reach them on. |

## Data model

### New tables (migration v3)

```sql
-- The opaque identities the hub mints. identity_id is a UUID, never derived from
-- a session id. host is the identity's home host (for the default alias).
CREATE TABLE identities (
  identity_id TEXT PRIMARY KEY,
  host TEXT,
  created_ts TEXT
);

-- session id -> identity. A session is a CREDENTIAL that speaks for an identity.
-- Many sessions (e.g. across /resume) can map to one identity. The hub mints an
-- identity + inserts here the first time it sees a new session.
CREATE TABLE sessions (
  session_id TEXT PRIMARY KEY,
  identity_id TEXT NOT NULL,
  created_ts TEXT
);
CREATE INDEX sessions_by_identity ON sessions (identity_id);
```

### Rekeyed columns (migration v3, backfilled)

- `handles.owner_session` → **`owner_identity`** (the rename, as a real semantic move
  to the identity key).
- `dms`: `from_session`/`to_session` → `from_identity`/`to_identity`;
  `lo_session`/`hi_session` (the canonical pair key) → `lo_identity`/`hi_identity`.
- `dm_delivery.recipient_session` → `recipient_identity`.
- `messages` gains **`from_identity TEXT`** — the durable author anchor (born correct,
  never a session column) — and **`reply_to INTEGER`** (NULL for non-replies).

### NOT rekeyed (deliberately)

- `adapter_sessions(adapter_id, session_id)` — the v5 reconnect lease legitimately
  leases *sessions* (an adapter serves session ids). This is not conflation; it's the
  lease's actual job. Stays session-keyed.
- `Connection.sessionId` / `boundSession` — how *this socket* authenticated. The socket
  is still a session-level credential; identity is resolved from it.

### Routing layer IS re-keyed to identity

The in-memory routing map **is** identity-keyed — this is the correction to an earlier
draft that wrongly left it session-keyed:

- `sessionConns: Map<sessionId → Set<Connection>>` → `identityConns: Map<identityId →
  Set<Connection>>`. "Deliver to addressee X" is an *identity* question, not a session
  question, so the map keys on identity. `isOnline(identity)` / `liveConnsFor(identity)`
  become identity-keyed.
- **An identity MAY have several live sessions** — `identityConns[identity]` is a `Set`
  that can hold more than one connection, and a push fans out to all of them. We do NOT
  enforce "one active session per identity" (an earlier draft did; the user reversed it).
- **A genuine `/resume` supersedes; subagents do not.** Only a real new session id for the
  same human (a `/resume`, same adapter_id) releases the prior session. That release is
  *explicit and lifecycle-driven* (SessionEnd/SessionStart), not inferred from a bind
  side-effect — see **Resume mechanism (TBD)**. Any supersede still must NOT fire on
  attribution-only frames (`dm_ack`/`dm_read`) that name a different session transiently
  (the lesson from docs/group-chat-adapter-reconnect.md).
- `Connection` keeps `sessionId`/`boundSession` (the socket's credential) and gains the
  resolved `identityId` it currently speaks for.

### Backfill migration shape

The v3 migration, in one transaction:

1. Create `identities` + `sessions`.
2. For every distinct session id appearing in `handles.owner_session`, `dms.*_session`,
   `dm_delivery.recipient_session`: mint one `identity_id`, insert `identities` +
   `sessions` rows (1:1, host carried from any known alias host or 'unknown').
3. Add the new identity columns, `UPDATE ... SET owner_identity = (SELECT identity_id
   FROM sessions WHERE session_id = owner_session)` etc., for each rekeyed table.
4. Add `messages.from_identity` (backfill from `from_handle` → `handles.owner_session`
   → `sessions.identity_id` **where the handle still exists**; pre-existing messages
   whose author already left stay NULL — we can't invent an identity we never recorded,
   and those rows simply can't offer the reply-author affordance, which is acceptable).
5. Add `messages.reply_to` (all NULL).
6. Drop the old `*_session` ownership columns (SQLite: rebuild-table pattern if needed,
   since older SQLite can't `DROP COLUMN` — bun:sqlite is new enough for `ALTER TABLE
   DROP COLUMN`, verify at implement time).

Per the migration discipline already in the file: **append a new MIGRATIONS entry,
never edit an applied one.** v1/v2 stay byte-identical.

A later **v4** appends one append-only `ALTER TABLE sessions ADD COLUMN adapter_id TEXT`
(see the Resume mechanism's adoption-lookup note) — v1/v2/v3 stay byte-identical; the
column drives `/resume` adoption off the durable `sessions` table.

## The resolution seam

The per-call resolution gains the composite session key at its head:

```
tool_use_id  --(PreToolUse hook map_session)-->  session_key   ("<session_id>[:<agent_id>]")
session_key  --(NEW: sessions table lookup)-->   identity_id
identity_id  -->  everything downstream (ownership, addressing, DM threading)
```

The hook composes `session_key = session_id` (main agent) or `session_id + ":" + agent_id`
(subagent — `agent_id` is present on the hook stdin only inside a subagent). The
`map_session` frame carries this composite as its `session_id` field; **the hub never
parses it** — it's an opaque key into `sessions`.

`requireSession(conn, rid)` today returns the bound session key. It grows a sibling
`requireIdentity(conn, rid)` that resolves the bound session key → identity (minting the
identity + `sessions` row on first sight of a key). Ownership/addressing handlers
AND routing switch from the session key to the identity id. `bindSession` additionally:
ensures the session→identity mapping exists (mint-on-first-bind); registers the conn
under `identityConns[identityId]` (a `Set` — multiple live sessions of one identity
coexist). So by the time any ownership/delivery op runs, the identity is known.

**Mint-on-first-sight** lives in one place (the session-key→identity resolver), so a
brand new session key automatically acquires an identity the first time it does anything
that needs one — no separate "register identity" step.

## Subagents

Verified against Claude Code docs: a subagent (spawned via the Task tool) **shares its
parent's `session_id`** and **shares the parent's MCP adapter process + socket**
(string-referenced/inherited MCP servers reuse the parent's connection). The only signal
distinguishing a subagent call is **`agent_id`** on the PreToolUse hook stdin — absent
for main-agent calls, present and unique per subagent invocation. `agent_type` is the
subagent's name (not unique across invocations).

Consequence: by session id alone, a subagent is indistinguishable from its parent. To
make a subagent its own chat participant we fold `agent_id` into the **session key**:
`"<session_id>:<agent_id>"`. The hub keys `sessions` on this opaque string and mints a
distinct identity for it — so a subagent gets its own identity (and a default
`<identity-id>@<host>` address) automatically, related to but distinct from the parent.

**Why a composite string and not a new protocol field:** the hub treats the session key
as opaque, so encoding the pair as one string means ZERO changes to the `sessions` table,
the resolution seam, or the wire beyond the hook composing the string. The `map_session`
frame's `session_id` field carries the composite verbatim.

**Ephemeral-identity scope (deliberately deferred):** a subagent's `agent_id`-derived
identity dies when the subagent finishes. We do NOT solve durable subagent handles/aliases
/DMs in this change — a subagent that never registers an alias is reachable only by its
opaque default address while live, and simply stops appearing when done (same as any
session going away). "Subagents register durable handles" is a future feature behind the
now-clean identity layer.

## Resume mechanism (RESOLVED — SessionEnd release; process-death needs nothing)

The release problem splits cleanly along **does the adapter process survive?**, and each
half is already covered by a distinct mechanism — there is no third "crash fallback" to
build:

**Process SURVIVES, session changes → `/resume` (and `/clear`).** Verified: `/resume`
keeps the process alive (SessionEnd then SessionStart fire in-process), so the stdio
adapter survives with adapter_id unchanged, and the *old* session id would otherwise
linger as still-bound on a live socket. This is the ONLY case that needs an explicit
release. A new **`session-end-hook`** (wired on SessionEnd — which receives the ending
`session_id` and a `reason` of `"resume"`/`"clear"`/`"logout"`/`"other"`) sends
`release_session{session_key}` to the hub, dropping the old session from
`identityConns`/binding. The existing **SessionStart** hook then fires with
`source="resume"`, carrying the NEW session_id; the new session binds and re-attaches to
the identity's groups (the SessionStart identity hook already reconstructs
`{group: handle}` from the transcript).

### Re-attach: a NEW session key links to the EXISTING identity (adapterId-scoped adoption)

A `/resume` produces a **new session key** (new session_id → new composite key). Without
re-attach it would mint a *fresh* identity and the SessionStart re-join would collide with
the prior identity's still-existing handle (`handle_taken`). Re-attach makes the new key
**adopt the prior identity** instead of minting.

**The safe link is the `adapterId`** — and there is no impersonation question, because a
`/resume` runs in the SAME adapter process (same `adapterId`), exactly the continuity the
v5 `adapter_sessions` lease already trusts. The hub already records `adapter_sessions
(adapter_id → session_key)` for every key an adapter serves. So:

- `resolveIdentity` gains the `adapterId` (it already runs inside `bindSession`, which has
  `conn.adapterId`). When asked to resolve a **new, unseen** session key:
  1. If the key already maps in `sessions` → return that identity (unchanged behavior).
  2. Else, look up the prior **main** session rows this **same `adapterId`** has bound,
     and resolve their identities; if they share exactly one identity, **adopt it** —
     insert `sessions(newKey → that identity)` instead of minting. The new key now speaks
     for the same identity that owns the prior handles/aliases/DMs.
  3. Else (no prior identity for this adapterId, e.g. a genuinely first-seen adapter) → mint
     a fresh identity as today.

  **The adoption lookup reads the durable `sessions` table, NOT the transient
  `adapter_sessions` lease** (migration **v4** adds an `adapter_id` column to `sessions`,
  stamped on every bind). This is a correctness requirement discovered after the first
  cut: in the REAL `/resume` lifecycle the SessionEnd hook fires `release_session{oldKey}`
  — which **deletes** the old key's `adapter_sessions` row — BEFORE the resumed session's
  first tool call binds. So by adoption time the lease is already GC'd, and an
  `adapter_sessions`-based lookup finds nothing and wrongly mints a fresh identity (the
  feature is dead for the real timing; only a brief coexistence window, which the first
  test happened to model, would have worked). The `sessions(oldKey → identity)` row, by
  contrast, **survives** release (the identity is durable; `releaseOneKey` never touches
  `sessions`), so stamping the binding adapter on it lets adoption find the adapter's prior
  identity independent of the lease. Adoption requires a **non-NULL, non-empty** adapter
  match, so pre-v4 rows (NULL adapter_id) and the empty-adapter pre-hello path never adopt.

  **Conflict rule (degraded state):** if the adapter's prior main rows resolve to **more
  than one distinct identity** — only reachable when a SessionEnd failed to release a prior
  main key, leaving two unrelated identities bound to one adapter — adoption **declines**
  (returns null → fresh mint) rather than silently picking an arbitrary one (`ORDER BY`
  would otherwise mis-attribute). Normal operation can't reach this: each `/resume`'s
  SessionEnd releases the prior key, and because adoption makes the resumed key share the
  SAME identity, a second/third `/resume` still collapses to one DISTINCT identity.
- Consequence: after `/resume`, the new session key resolves to the prior identity, so the
  SessionStart re-join finds it already owns the group handle (idempotent, no `handle_taken`),
  and all aliases/DMs/membership carry over. The old key is released via SessionEnd as
  before; the identity persists because the new key adopted it.
- **Subagents are unaffected** by adoption in a harmful way: a subagent's composite key
  shares the parent's `adapterId`, so it would adopt the parent identity — but a subagent
  key already resolves to its OWN identity on first sight via the composite-key path. Order
  matters: adoption only triggers for a key with NO existing `sessions` row AND must not
  collapse a subagent into its parent. **Resolution: adoption applies only when the new key
  has no `:`-suffixed agent component (a main-agent `/resume`), OR — simpler and preferred —
  adoption keys off the EXACT prior session_id stem.** The implementer picks the precise
  predicate; the invariant is: a main-agent `/resume` adopts the prior main identity; a
  subagent still gets its own distinct identity. (Verify with a test: parent resumes → same
  identity; subagent under either parent → distinct identity, never adopts the parent.)

**Process DIES → crash / `kill -9` / quit.** No release needed and SessionEnd's
best-effort nature is irrelevant here: process death takes the **adapter and its socket
down with it**, so the hub's existing `onDisconnect` already removes the connection from
`identityConns` and stops delivery. There is no orphaned live session to reap — the thing
that kept it live (the socket) is gone. On restart it's a fresh adapter PID that re-binds
cleanly. (This is why we do NOT add a hub-infer-on-rebind fallback: it would be solving a
non-problem; the disconnect path IS the crash path.)

Any release/supersede still must NOT fire on attribution-only frames (`dm_ack`/`dm_read`)
that name a different session transiently.

**New wire frame:** `release_session{ session_key }` (hook → hub), part of the v6 bump.
Idempotent — releasing an already-gone session is a no-op.

This is settled; the resume path is implementable.

## Making the session id disappear from UX

Every site that currently surfaces a session id is retargeted to identity_id:

| Site | Today | After |
|---|---|---|
| Default alias (hub.ts ~750, ~1220, ~1362) | `<session-id>@<host>` | `<identity-id>@<host>` |
| `whoami` result (adapter ~760, proto `whoami.session_id`) | `session: <id>` | `identity: <identity-id>` |
| `resolve` result (adapter ~767/769, proto `resolved.session_id`) | `-> session <id>` | `-> identity <identity-id>` |
| `list_directory` (adapter ~781, proto `directory.session_id`) | `<session_id>@<host>` | `<identity-id>@<host>` |
| DM wire (`dm.from_session`/`to_session`, `dm_history.peer_session`) | session ids | identity ids |
| `dm_ack`/`dm_read` (`from_session`) | session id | identity id |

The PROTOCOL bumps to **v6**. Wire field renames (`session_id`→`identity_id`,
`from_session`→`from_identity`, …) are part of the bump. The `map_session` frame
(hook→hub) **keeps** a `session_id` field, but it now carries the **composite session
key** (`"<session_id>[:<agent_id>]"`) — the one place a real session key legitimately
crosses the wire, because correlating a tool call to its session is the hook's whole job.

The address-parsing that recognizes a default alias (`<x>@<host>` where `<x>` is dash-ful,
the impersonation guard at adapter ~606) now recognizes an identity id instead of a
session id. Both are UUID-shaped (dash-ful), so the existing "dashes ⇒ not a registered
alias, treat as a default/identity address" guard still holds — verify the parse at
implement time.

## Delivery gate: the adapter never surfaces a push for the wrong session

An adapter socket may serve several session keys (the parent plus live subagents, all
sharing the socket). The gate ensures a push aimed at one session key is surfaced only
into that one — and a push for a session the adapter no longer serves (a superseded
resume) is dropped rather than surfaced into the wrong Claude session.

The principle: **the adapter drops (does not surface) any inbound push whose target
identity ≠ the identity/session it is currently live as.**

- **DM path** — already has the target. `dm_message` carries `dm.to_session` today
  (→ `to_identity` after the decouple). The adapter compares it to its current identity
  and drops a non-match. Free.
- **Group path** — has NO target today. `message` carries only the `ChatMessage`
  (`group, seq, from, ts, msg_id, text`); the hub decides recipients by *which connections
  it sends to*, the frame doesn't name them. So the group `message` frame **gains a
  stamped recipient identity** (`to_identity` / `recipient`). `broadcast()` already loops
  per recipient connection (hub.ts ~691–702); each `send` stamps the recipient identity it
  is destined for, rather than sending the bare shared `msg`. The adapter gates on it the
  same way as DMs.

This is a small protocol addition (a recipient field on the group `message` frame) and a
per-send stamp in the existing broadcast loop — NOT a rewrite of the broadcast fan-out.

## Reply-to, on top of the clean identity column

`submit_message` gains optional `reply_to: <seq>`:

1. Adapter sends `{ t: "send", group, message, reply_to }` (reply_to optional).
2. Hub `send` handler, when `reply_to` is set:
   - Look up the row at `(group, reply_to)`. Missing/wrong-group → `no_such_message` error.
   - Read its `from_identity` (the author's durable identity).
   - Derive `to` from that identity's **current group handle** in this group (the
     member name). If the author is still a member → push to them (existing `to` filter).
   - If the author **left** (no current group handle) → log-only (no push), and the
     `sent` result frame carries a **warning**: the author's reachable addresses
     resolved from `from_identity` → registered aliases + the canonical
     `<identity-id>@<host>` default alias, plus online status. If they have no aliases
     and are offline, say so honestly rather than emit an empty list.
   - If `from_identity` is NULL (a pre-migration message) → reply still logs, warning
     notes the original author's identity is unrecorded.
3. `broadcast()` threads `reply_to` onto the stored row + the `ChatMessage`.
4. `pushChannel` adds `reply_to: String(seq)` to `meta` **only when set**, so the
   `<channel>` event carries `reply_to="N"`. Display hook marks it as a reply.

The `<channel>` event carries **only the seq** (no snapshot). The author-reachability
info goes in the **tool result** to the replier, not the pushed event.

## Rejected alternatives

- **Keep session id as identity, just rename the column** (`owner_session` →
  `owner_identity` with the same value). Rejected: the user explicitly called this a
  half-fix — the conflation stays in storage and a `/resume` still fragments identity.
  The whole point is that identity is *not linked* to the session.

- **Identity = an opaque *rendering* of the session id** (session id stays the storage
  key, only the wire shows an opaque form). Rejected for the same reason: it hides the
  leak without fixing it; identity is still per-session.

- **Identity derived from the adapter_id lease.** Rejected: an adapter (relay process)
  can serve several distinct identities; tying identity to the relay process is wrong.
  The lease leases *sessions*, which is a different concern.

- **Clean-slate migration** (drop identity-keyed data like v1 dropped aliases/members).
  Rejected: this runs against a *live* hub with real aliases/DMs/membership; throwing
  that away to save migration code is the wrong trade. Backfill instead.

- **Reply-to as a new `reply` tool.** Rejected: duplicates `submit_message` plumbing and
  widens the tool surface; a reply is "a message with a reference," so it's a param.

- **Reply carries a denormalized quote snapshot.** Rejected: the user wants just the seq
  as data; the recipient/display can look up the original from history.

- **Reply to an offline author gets DM-style durable redelivery.** Rejected: a reply is
  a group message; it follows group semantics (log + surface on scrollback), not the DM
  durable queue. Keeping it a hybrid was deemed not worth the machinery.

- **One active session per identity (evict the prior on any new bind).** Rejected by the
  user after we established subagents share the parent session id: there's no concurrent
  *session* to evict from subagents, and a hard single-active rule would wrongly tear down
  legitimately-coexisting sessions. Only a genuine `/resume` supersedes, and that's an
  explicit lifecycle-driven release, not a blanket invariant.

- **Thread `agent_id` as a new protocol field through the wire/resolution seam.** Rejected
  in favor of folding it into the opaque **session key** string (`"<session_id>:<agent_id>"`).
  The hub treats the key as opaque, so the composite costs zero schema/wire change beyond
  the hook composing it — versus plumbing a new field through every frame and lookup.

- **Make subagents the same identity as their parent (no `agent_id`).** Rejected: the user
  wanted the discriminator to be `agent_id` (or session_id + agent_id together), so a
  subagent is its own participant. Session id alone can't tell them apart.

## Verification goals (what "done" must prove)

1. A `/resume` (new session id) that maps to an existing identity keeps that identity's
   handles, group membership, DMs, and default alias — identity survives the session change.
2. No session id appears in any tool result or `<channel>` event (except `map_session`,
   hook→hub). `whoami`/`resolve`/`directory`/default-alias all show identity ids.
3. Backfill migration on a populated pre-v3 DB: every existing handle/DM/membership still
   resolves and works under identity keys; counts preserved; no orphaned owners.
4. Reply-to: pushes only to the author; logs for all; `<channel>` carries `reply_to`;
   author-left produces the warning with reachable addresses; `no_such_message` on bad seq.
5. v6 protocol round-trips adapter↔hub; the adapter_id reconnect lease (v5) still works.

## Appendix — verbatim user messages shaping this design

> I want to add a reply-to feature that allows replying to a specific message. This means the message is sent to the origin. The message being replied-to is encoded as data, not in the message itself. The seq number is used to specify which message to reply-to. On the channel notification it has to be encoded in some way that it is a reply, not a regular message and since it's a reply, only the one receiving the reply sees the push (still lands as message in the chat, just like to:)

> the author is no longer there but the identity should be recorded (at least if I understand it correctly) so we should be able to find out who originally sent it (if not, we should probably add an identity column for the author), that way we can say if you want to DM the author, here are the aliases you can reach the author on

> the naming is wrong and confusing, I trip over it all the time. the identity ID should be something opaque that doesn't need to be the session ID. that the session ID is currently also the identity is just coincidental through the simplified design but I don't want them to be linked

> if they are in tension you shouldn't have asked it. do the full thing now.

> [migration data] Backfill: one identity per existing session

> [identity exposure] Exposed as the canonical address, because that way we can make the session ID disappear from the UX

> [default alias] <identity-id>@<host>

> why is it called owner_session / What is owner_session?

> wdym without rewriting the connection layer? the connection layer should already be per-identity?

> i wouldnt disallow one active session per identity. i dont know how subagents work here they might have different IDs but share the same adapter

> [subagent discriminator] so maybe the real discriminator is agent_id, not session_id? or both together? what would you say?

> [resume] adpter_id stays the same, but it supersedes. this means the adapter needs to call the hub to release the session.

> [resume release] SessionEnd and SessionStart? on the lifecycle question: can we just join them into a string like "<session id>:<agent id>"? the hub doesnt really care what it is

> crash doesnt matter for SessionEnd because on restart you have a new adapter anyway
