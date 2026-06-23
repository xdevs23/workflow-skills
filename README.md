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

## License

MIT
