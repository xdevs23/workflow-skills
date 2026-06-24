# workflow-skills

A bundled Claude Code plugin of **multi-agent workflow skills** plus a library of **audit-lens
subagents**. The skills orchestrate fan-out/verify/loop patterns for research, verification, gap-finding,
implementation review, and a continuously-running codebase audit.

## Install

```text
/plugin marketplace add xdevs23/workflow-skills
/plugin install workflow-skills@workflow-skills
```

Then the skills appear in the skill list and each has a matching slash command (e.g. `/research-loop`,
`/audit-loop`).

## What's inside

### Skills
| Skill | What it does |
|---|---|
| `research-loop` | Triangulate an open research question into a trustworthy, evidence-tagged doc. |
| `verify-loop` | Adversarially prove every claim in an artifact against ground truth, loop to immaculate. |
| `find-gaps` | Audit an artifact for sins of omission — what's missing or under-specified. |
| `implement-review-verify` | Implement a code change, then adversarial review + verify/fix before commit. |
| `immaculate-spec-writing` | Research → find-gaps → verify convergence loop for a fully factual, complete spec. |
| `audit-loop` | Continuously audit a codebase through 8 lenses, append verified findings to `AUDIT.md`. |
| `group-chat` | Join a shared multi-instance group chat so this Claude can talk to other Claude instances across machines/Docker, over a common hub. Built on Claude Code Channels. |

### Audit-lens subagents (sonnet-pinned, read-only)
`separation-of-concerns`, `abstraction-quality`, `code-smell`, `type-safety`, `code-cleanliness`,
`missing-gaps`, `domain-leakage`, `type-smearing`. Usable directly as `agentType`s in your own
workflows, and used by `audit-loop`.

## Requirements / assumptions

- **The Workflow tool / multi-agent fan-out.** Every skill orchestrates subagents via Workflow. A
  harness or plan that doesn't expose Workflow can't run these.
- **Model tiers.** Agents are pinned by convention: **sonnet** is the floor for review/research/audit
  lenses; **opus** for any coding/fix stage; **never haiku**. A Sonnet-only plan will not honor the opus
  pins; an opus-capable plan will incur opus rates on coding stages. This is deliberate — the model
  discipline is part of the product.
- **`audit-loop` runs continuously.** It's designed to be driven by `/loop audit-loop` in a **tight loop
  with no interval** — each ~30+ min full-tree round re-fires the next immediately. It is read-only and
  append-only to a project-local **`./.claude/workflow-skills/AUDIT.md`** (commit or gitignore it as you
  prefer); it never fixes. Fix everything in one sweep when you choose (`implement-review-verify` pairs well).

## Group chat (multi-instance) — setup

The `group-chat` skill lets several Claude Code instances — on different machines, in or out of
Docker — join shared named groups and message each other. It is built on **Claude Code Channels**
(research preview), so incoming messages push into the session continuously as `<channel>` events.

It has two pieces:

- **The hub** (`servers/group-chat-hub/hub.ts`) — one standalone process you run wherever you want the
  shared meeting point. It holds the per-group member list and an on-disk JSONL message log, and fans
  messages out. Run it with Bun:

  ```bash
  GROUP_CHAT_TOKEN=some-secret bun servers/group-chat-hub/hub.ts
  # listens on ws://127.0.0.1:8787 by default
  # env: GROUP_CHAT_PORT, GROUP_CHAT_HOST, GROUP_CHAT_DATA, GROUP_CHAT_ALLOW_NO_AUTH=1
  ```

- **The channel adapter** (`group-chat/adapter.ts`) — ships inside this plugin and is declared in the
  plugin's root `.mcp.json`. Claude Code spawns it per session. Point it at the hub with an env var
  (token inline in the URL, optional):

  ```bash
  export GROUP_CHAT_URL="ws://some-secret@your-hub-host:8787"
  ```

  Then launch Claude Code with the channel enabled (custom channels need the dev flag during the
  research preview):

  ```bash
  claude --dangerously-load-development-channels plugin:workflow-skills@workflow-skills
  ```

Once running, load the `group-chat` skill and `join` a group. Messages from other instances arrive as
`<channel source="group-chat" group="..." from="..." ...>` events; you send with `submit_message`.
Requires claude.ai (Pro/Max) or Console API-key auth — Channels are not available on Bedrock/Vertex/Foundry.

## License

MIT
