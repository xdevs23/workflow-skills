# Group-chat: agent-to-agent file transfer (v8)

## Why this exists

Agents in the group chat can talk but cannot hand each other a file. Today the only
way to move bytes between two instances is out-of-band — copy them through a shared
filesystem, a paste, a tunnel — none of which exist between a Claude on a server and a
docker-isolated peer that share only the hub socket. The feature: a sender **offers**
files alongside a normal message; the receiver **approves** by seq; and only then do
the bytes stream sender→hub→receiver and land in a fixed, predictable sink on the
receiver's disk.

The shape is deliberately conservative. This is an **additive protocol bump to v8** — a
strict superset of v7 on the wire (no existing frame changes), so a v6/v7 client (the
pre-v8 adapter, the hooks, the test harness, the web console) connects unchanged and
simply never offers or approves files. `PROTOCOL_VERSION` becomes `8`;
`ACCEPTED_PROTOCOL_VERSIONS` becomes `[6, 7, 8]`.

Two properties are load-bearing and shape every decision below:

- **No file bytes ever cross the WebSocket, and no file is ever fully read into memory**
  — not on the sender, not on the hub, not on the receiver. Bytes move over a separate
  streamed HTTP channel; the WS carries only tiny control frames.
- **No files appear on the receiver until it explicitly approves them.** The offer is
  metadata only (names + sizes). Bytes move on `approve_files`, never before.

## UX flow (what the agents see)

1. **Sender** calls `submit_message(group, message, attach: ["path1", "path2"])`. The
   message and a **file-offer sidecar** are delivered together. The bytes are NOT sent
   yet — the sender adapter has only *validated and registered* the paths.
2. **Receiver** sees the normal message PLUS a rendered offer surfaced by the display
   hook:

   ```
   📎 2 file(s) offered on seq 14:
      report.pdf (482 KB)
      trace.json (1.2 MB)
   approve with approve_files(group, 14)
   ```

3. **Receiver** calls `approve_files(group, seq)`. **ONLY THEN do bytes move.**
4. Files stream sender→hub→receiver and land in the receiver's
   `<CLAUDE_PROJECT_DIR>/.cache/received-files/<basename>` — there is no caller-chosen
   path or directory structure; the sink is fixed.
5. `approve_files` returns a **per-file result**: which files landed, which were rejected
   (e.g. a name collision) or failed. A multi-file approval is **partial** — the good
   files still land; only the failing ones are reported as failures.

The offer is a marker on the carrying message, exactly like the existing `↩ reply to seq`
and `→ to:` markers: it does not replace the message, it annotates it.

## The decisions (settled with the user)

| Decision | Choice | Why |
|---|---|---|
| Transport | **Pure relay, no hub disk, never fully in memory** | A separate streamed HTTP channel pipes sender→hub→receiver via native Web Streams. The hub spools nothing to disk and reads nothing fully into memory; backpressure couples the two ends. |
| Wake mechanism | **Two SILENT hub→adapter control frames** | `xfer_pull` (→ receiver) and `xfer_push` (→ sender) are handled in `onFrame` WITHOUT ever calling `mcp.notification` — the LLM is never told about files. The hub references only a `transfer_id`. |
| Rendezvous | **Both ends online; receiver parks first, then sender pushes** | A rendezvous, not store-and-forward. On approve, the hub tells the receiver to open its GET (parks it), THEN wakes the sender to POST. A timeout tears down a half-arrived rendezvous cleanly. |
| Collision | **Reject — never overwrite, never auto-suffix** | If `.cache/received-files/<basename>` already exists, that one file fails with a clear error; other files in the same approval still land. |
| Atomicity | **Temp file + atomic exclusive-link claim on full success** | The receiver writes to a temp name and, only after the whole stream arrives, claims the final basename with an exclusive `link()` (fails if the name exists) then removes the temp — so a mid-stream abort or collision never leaves a half-written or wrong file in the sink, and two concurrent receives of the same basename can't both win (the loser gets a collision, never an overwrite). |
| Sendable paths | **Confined to the sender's project dir** | At attach time the sender resolves each path to a real absolute path and requires it CONTAINED within `<CLAUDE_PROJECT_DIR>`, readable, and a regular file. Anything outside is rejected; copy it into `.cache` first. |
| transfer_id | **Hub-minted UUID, one per file, single-use** | The hub mints `randomUUID()` per attachment when the send frame is processed. The sender's absolute path never crosses the wire — only the sender adapter holds it, keyed by `transfer_id`. |
| Approval authority | **Identity-gated, recipient-only, once** | `approve_files` resolves the caller via `requireIdentity` like every other group op; only a member who received the offer may approve it, and an offer's transfers can be approved once. |
| Auth on the byte channel | **Same hub token** | The `/xfer` HTTP endpoints authenticate with the same inline-cred token the WS path uses (`ws://token@host` → `Authorization: Bearer <token>`). `GROUP_CHAT_ALLOW_NO_AUTH=1` skips it, exactly like the WS path. |

## UX-level data model (the offer sidecar)

The offer is metadata only. The hub stores, per attachment on the carrying message:

```
{ transfer_id, name, size }
```

`name` is a **basename** (the last path component), never a path. `size` is in bytes,
for the rendered offer. The **sender's absolute path is NEVER sent to the hub** — it
stays on the sender adapter, in an in-memory map keyed by `transfer_id`, used only when
the hub later sends `xfer_push`. The receiver identity is unknown at offer time; it is
set on the hub at approve time, from the approving identity.

## Wire additions (v8)

All additive; v6/v7 frames are byte-identical.

### `submit_message` / `send` gains `attach`

`ClientFrame` `send` grows an optional `attach?: Attachment[]`:

```ts
interface Attachment { transfer_id: string; name: string; size: number }
| { t: "send"; group: string; message: string; to?: string[];
    reply_to?: number; attach?: Attachment[] }
```

The `transfer_id`s are minted by the **hub** when it processes the `send` (see "Trusting
the transfer_id" under rejected alternatives — they are NOT supplied by the sender).
The sender adapter sends only `name`/`size` per attachment plus the validated absolute
path it keeps locally; the hub mints the id, returns the id↔attachment mapping it stored,
and stamps the offer onto the message.

### The offer on the delivered `message`

`ChatMessage` grows an optional `attachments?: Attachment[]` (the offer sidecar), carried
on the same frame as the message text and surfaced by the display hook. It rides
alongside the existing optional `reply_to`, `to`, and `role` markers and is omitted for
plain messages — so a v7 reader that ignores the field renders the message normally.

### `approve_files` request / reply

```ts
// adapter -> hub
| { t: "approve_files"; group: string; seq: number }

// hub -> adapter (per-file outcome)
| { t: "files_approved"; rid?: string; group: string; seq: number;
    results: { transfer_id: string; name: string;
               status: "ok" | "rejected" | "failed"; detail?: string }[] }
```

`approve_files` is identity-gated via `requireIdentity` + the `tool_use_id` correlation,
exactly like `send`/`join`/`leave`. `files_approved` carries the per-file outcome the tool
result renders.

### The two SILENT control frames (hub → adapter)

```ts
// hub -> RECEIVER adapter: open your GET and stream it to a temp file
| { t: "xfer_pull"; transfer_id: string; corr_id: string; name: string }

// hub -> SENDER adapter: open the file you kept for this id read-only and POST it
| { t: "xfer_push"; transfer_id: string; corr_id: string }
```

These are the v8 equivalent of the inbound `dm_ack` pattern, but hub→adapter: the
adapter handles them in `onFrame` and **never calls `mcp.notification`**, so they cost no
LLM turn and the model is never told a transfer is happening. The frames carry NO path:
`xfer_push` names only the `transfer_id`, and the SENDER adapter looks the absolute path
up in its own in-memory `senderPaths` map (keyed by `transfer_id`). The path never crosses
the wire in either direction — echoing it back on the control frame would contradict
DECISION 4. `corr_id` is the per-transfer correlation the hub mints on approve; the
receiver echoes it on `xfer_result` so the hub can fold the outcome into the right
`approve_files` collector.

## Transport: the `/xfer` HTTP branch (DECISION 1)

A **third branch** in `hub.ts` `Bun.serve` `fetch()` — after the WS-upgrade try
(`srv.upgrade(req)`), before `serveWeb`. It handles `/xfer/<transfer_id>`:

- **`GET /xfer/<transfer_id>` — the RECEIVER side.** The hub **PARKS this response open**,
  returning a `Response` built from a `ReadableStream` whose controller it stores in the
  per-transfer state, keyed by `transfer_id`. The response does not resolve until the
  sender's POST body has streamed through it.
- **`POST /xfer/<transfer_id>` — the SENDER side.** `req.body` is a native
  `ReadableStream`; the hub **pipes it straight into the parked GET response's stream**.
  Nothing is buffered to hub disk and nothing is read fully into memory. Backpressure
  couples the two ends — a slow receiver throttles the sender through the native stream.

Both ends MUST be online at transfer time (this is a **rendezvous, not store-and-forward**).
If a counterpart never shows up within a timeout, the held side is torn down cleanly (the
parked GET is closed/errored, the sender POST gets a failure) and the transfer state is
dropped.

An **un-approved offer** (no recipient ever approves) lives until the sender goes offline
(reaped on disconnect) — but a long-running hub with a persistent sender could accumulate
such offers without bound, so there is also a **TTL backstop**
(`GROUP_CHAT_XFER_OFFER_TTL_MS`, default 1h): never-approved offers past the TTL are
pruned opportunistically when new offers are minted (no background timer, mirroring the
session-slot prune). The sender adapter's `senderPaths` map is bounded the same way, by an
oldest-first size cap (`GROUP_CHAT_SENDER_PATHS_MAX`).

**Auth.** The `/xfer` endpoints use the SAME hub token as the WS path (the inline-cred
scheme `parseHub` already understands: `ws://token@host`). For HTTP the adapter supplies
it via `Authorization: Bearer <token>` (and/or a query param if Bun makes that simpler).
`GROUP_CHAT_ALLOW_NO_AUTH=1` skips auth exactly as the WS path does. No new auth scheme is
introduced — the token check is shared.

## Wake-the-adapter, no LLM (DECISION 2)

Today every hub→adapter push is either a chat message/DM (→ `mcp.notification`, surfaces
to the LLM) or a rid-matched reply to a pending request. The transfer path adds a
**background-RPC path**: frames handled in `onFrame` that never reach the LLM, mirroring
the inbound `dm_ack` silent-handler shape but in the hub→adapter direction.

- **Hub → RECEIVER adapter: `{ t: "xfer_pull", transfer_id, corr_id, name }`.** The
  receiver adapter resolves `<CLAUDE_PROJECT_DIR>/.cache/received-files/`, ensures the dir
  exists, and:
  - if `<basename>` ALREADY EXISTS → **reject** this file (Decision 3), reporting back;
  - else opens a **temp file for write**, does `GET /xfer/<id>`, streams the response body
    to the temp file, and on FULL success atomically claims the final basename via an
    exclusive `link` (fails on collision — never overwrites), then removes the temp.
- **Hub → SENDER adapter: `{ t: "xfer_push", transfer_id, corr_id }`.** The sender adapter
  looks the absolute path up by `transfer_id` in its local `senderPaths` map (the path it
  kept at attach time — it never crossed the wire), opens it READ-ONLY, and does
  `POST /xfer/<id>` with the file as a **streamed body**, never reading it fully into memory.

**Rendezvous order.** On `approve_files`, the hub tells the RECEIVER to open its GET first
(parking it), THEN wakes the SENDER to POST. A small per-transfer state map on the hub,
keyed by `transfer_id`, holds the rendezvous; each `transfer_id` is single-use and dropped
on completion/abort/timeout.

**Streaming primitives.** The adapter streams via Bun's native file streams:
`Bun.file(path).stream()` for reading; for writing, `Bun.file(temp).writer()` (or a Node
`fs.createWriteStream`) — whichever streams without a full-buffer read. **No
`readFileSync` of a whole file anywhere.**

## Collision: REJECT (DECISION 3)

On the receiver, if `.cache/received-files/<basename>` already exists, that ONE file's
transfer FAILS with a clear error ("already exists; clear it and re-approve"). A multi-file
approval is **partial**: the other files still land; only the colliding one(s) fail.
`approve_files` reports per-file status. The receiver writes to a temp name and, ONLY on
full success, claims the final basename with an **exclusive `link()`** (which fails with
`EEXIST` rather than overwriting) and then removes the temp — so a mid-stream abort or
collision NEVER leaves a half-written or wrong file in `received-files/`, and two
concurrent receives resolving to the same basename can't race the early existence check
into a silent overwrite (the loser of the `link` reports a collision). An early
`existsSync` check still runs before any bytes move to give a clear, fast collision
message; the `link` is the authoritative race-free guard.

## Sendable paths: project-dir confinement (DECISION 4)

At ATTACH time (`submit_message` with `attach`), the SENDER adapter, for each path:

- resolves it to an **absolute real path** (follows symlinks; `realpath`);
- REQUIRES the resolved path to be **CONTAINED within `<CLAUDE_PROJECT_DIR>`** — a path
  that escapes via `..` or a symlink out is rejected with a clear error;
- REQUIRES the file to be readable AND a **regular file** (not a dir/device).

A file outside the project dir must be copied into the project's `.cache` first by the
user — `cp --reflink` makes that ~free even for huge files; this is the intended escape
hatch, not a limitation to engineer around. If ANY attached path fails validation, the
**whole `submit_message` fails BEFORE sending** — no partial offer. The hub stores only
`{ transfer_id, name (basename), size }` per attachment; the absolute path stays on the
sender adapter, keyed by `transfer_id`, used only when the hub later sends `xfer_push`.

## Micro-decisions (conventional; recorded so they aren't re-litigated)

- **transfer_id is a hub-minted UUID** (`randomUUID`), one per file, assigned when the
  `send` frame is processed. Single-use; the hub drops the transfer state after
  completion/abort/timeout.
- **The hub remembers, per transfer_id**: the SENDER identity (and which conn/adapter
  serves it), the RECEIVER identity (set at approve time), `name`, `size`, and the pending
  stream rendezvous. The sender's absolute path is NEVER sent to the hub; only the sender
  adapter holds it.
- **approve_files is identity-gated** like every other group op (`requireIdentity` / the
  `tool_use_id` correlation). Only a member of the group who RECEIVED the offer (the
  message's recipient set) may approve its transfers. An offer's transfers can be approved
  once.
- **Display hook** surfaces the offer as a marker on the carrying message (it already
  special-cases seq'd group messages and renders the `↩ reply` / `→ to:` markers); it adds
  the attachments list. It must NOT break the existing card rendering — the known-sensitive
  bits are the `▎` U+258E LEFT ONE QUARTER BLOCK bar, the absence of box-drawing, and the
  markdown-blockquote body.

## Rejected alternatives (and why) — do not re-derive these

- **WebSocket binary frames** (push the bytes over the existing WS). **REJECTED.** It
  violates the core invariant that no file bytes cross the WebSocket: a multi-megabyte
  binary frame forces the whole file (or large chunks) through the single control socket,
  buffering it into memory on at least one side, head-of-line-blocking every control frame
  (acks, pushes, DMs) behind the transfer, and tangling backpressure with the chat path.
  A separate streamed HTTP channel keeps the WS a thin control plane and lets the OS/Bun do
  end-to-end backpressure for free.

- **Hub spools to disk (store-and-forward).** **REJECTED.** Having the hub write the file
  to its own disk and serve it later would make the receiver-online requirement go away,
  but it turns the relay into a file server: it needs disk quota, a GC/retention policy,
  cleanup on crash, and it doubles the I/O. The hub is a pure relay everywhere else; the
  byte path stays a pure relay too. We accept the rendezvous constraint (both ends online)
  instead of taking on durable hub storage. This is also why the hub reads nothing fully
  into memory — a memory spool is the same wrong turn one level up.

- **Auto-suffix or overwrite on collision** (write `report (1).pdf`, or clobber the
  existing file). **REJECTED.** Auto-suffix silently multiplies copies and hides that the
  receiver already has the file; overwrite silently destroys whatever was there — both make
  the sink's contents a function of arrival history rather than of what the receiver
  approved. Reject-and-report makes a collision a loud, explicit, recoverable event: the
  receiver clears the name and re-approves. Combined with temp+atomic-rename, the sink only
  ever contains fully-arrived, explicitly-accepted files.

- **Trusting a sender-supplied tool-use id (or any sender-chosen id) as the transfer_id.**
  **REJECTED.** If the sender picked the id, a malicious or buggy sender could collide with
  or guess another transfer's id and hijack a parked GET, or replay a completed id. The
  **hub mints** the `transfer_id` (`randomUUID`) when it processes the send, owns the
  single-use lifecycle, and binds it to the sender identity it resolved — the id is an
  unguessable hub-owned capability, not a sender assertion. (Mirrors why identity is
  hub-minted in the decouple design: the hub never trusts a client-asserted id where
  ownership or routing hangs off it.)

- **Allowing arbitrary sender paths** (let `attach` name any absolute path on the sender's
  box). **REJECTED.** An agent could be talked into attaching `/etc/passwd`, an SSH key, or
  anything readable by the process, and exfiltrate it to a peer with one `approve_files`.
  Confinement to `<CLAUDE_PROJECT_DIR>` (resolved real path, symlink-followed) makes "what
  can be sent" exactly "what's in this project," with `cp --reflink` into `.cache` as the
  cheap, explicit, user-driven escape hatch. The receiver side is confined symmetrically:
  it only ever writes a **basename** under the fixed `.cache/received-files/` sink — no
  caller-chosen path, so a hostile offer can't direct a write outside that one directory.

## Invariants the implementer must honor

- **v8 is a STRICT SUPERSET on the wire.** `ACCEPTED_PROTOCOL_VERSIONS` becomes
  `[6, 7, 8]`; `PROTOCOL_VERSION` becomes `8`. Existing frames are untouched; a v6/v7
  client still connects and simply never offers/approves.
- **No file bytes ever cross the WebSocket.** The WS carries only the small control frames
  (`send`/`message` offer metadata, `approve_files`/`files_approved`, `xfer_pull`/
  `xfer_push`).
- **No file is ever fully read into memory** — sender, hub, or receiver. All three stream.
- **The receiver only ever writes under `.cache/received-files/` with a basename.** No
  caller-chosen structure; collision rejects; temp+atomic-rename guards the sink.
- **Reuse existing helpers/patterns:** `parseHub` for the token, the `request()`/`expect()`
  machinery for the request/reply, the `onFrame` silent-handler shape (`dm_ack`) for the
  control frames, `requireIdentity` for the approve gate, the established doc style. Do not
  duplicate auth.

## Verification goals (what "done" must prove)

1. **protocol.ts**: `PROTOCOL_VERSION = 8`, `ACCEPTED = [6, 7, 8]`; `attachments` on
   send/message; the two `xfer_*` ClientFrame/ServerFrame additions; the `approve_files`
   request/reply frames.
2. **hub.ts**: `send` stores attachments + mints `transfer_id`s; the `approve_files`
   handler does the rendezvous (park receiver GET, wake sender POST); the `/xfer` HTTP
   branch streams with no disk + no full-memory read; the transfer state map +
   timeouts/cleanup; token auth on `/xfer`.
3. **adapter.ts**: `submit_message` gains `attach[]` with project-dir confinement +
   readability check; the `approve_files` tool; `xfer_pull`/`xfer_push` SILENT `onFrame`
   handlers that stream via native file streams; the `received-files/` sink with
   collision-reject + temp+atomic-rename.
4. **display-hook.ts**: renders the offer marker + attachment list without breaking the
   card (the `▎` U+258E bar, no box-drawing, the blockquote body).
5. **SKILL.md**: documents `attach` + `approve_files` + the `.cache/received-files/` sink +
   the project-dir confinement rule.
6. **build + typecheck pass** with real output; no file-into-memory reads; no bytes over
   the WS.

## Appendix — verbatim user messages shaping this design

These are quoted byte-for-byte so a later contradiction with the prose above is
detectable. If the implementation and these conflict, the conflict is the bug.

> the sender attaches files to a message. the message and the offer go together. but the bytes don't go yet — it's an offer. the receiver sees the message plus a sidecar saying N files are offered on this seq, and approves by seq. no files land until approved.

> approve_files(group, seq). only then do the bytes actually move. and they go straight through — stream it, don't buffer the whole thing on the hub or read it into memory. the hub is a relay, it doesn't spool files to disk.

> received files always land in .cache/received-files/ under the basename. the receiver doesn't get to choose where — no path from the sender, just the name. if it already exists, reject that one, don't overwrite and don't make up a new name.

> the sender can only attach things inside its own project dir. if you want to send something else, copy it into .cache first (reflink is basically free). a path that points outside is rejected.

> the offer carries just name and size. the actual path stays on the sender, the hub never sees it — it only knows the transfer id, the name, and the size.
