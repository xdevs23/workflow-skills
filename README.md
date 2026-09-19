# workflow-skills

A bundled Claude Code plugin of **multi-agent workflow skills** plus a library of **audit-lens
subagents**. The skills orchestrate fan-out/verify/loop patterns for research, verification, gap-finding,
copywriting, implementation review, and a continuously-running codebase audit.

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
| `implement-review-verify` | Cold-review the spec, implement and commit a clean snapshot, then review and independently consolidate findings. The fixer commits only approved corrections while a mandatory roaster reads the pre-fix Git snapshot and approved list. Roast findings are verified against the resulting snapshot before completion. Only unresolved decisions, disagreements and non-convergence need root resolution. |
| `copywriting` | Write an increment's user-visible strings BEFORE implementation: intent catalog + writing system, one agent per item, mechanical gate + source-verify + fresh-context critic, human ships the load-bearing lines. |
| `immaculate-spec-writing` | Research → find-gaps → verify convergence loop for a fully factual, complete spec. |
| `resume-interrupted-run` | Recover a workflow run that was stopped while agents were mid-flight: hand each interrupted seat its own prior transcript, leave every completed prompt byte-identical, resume near-losslessly. |
| `audit-loop` | Continuously audit a codebase through 8 lenses, append verified findings to `AUDIT.md` — plus a `Refuted` ledger of killed claims, so nothing is rediscovered every round. |

### Audit-lens subagents (read-only)
`separation-of-concerns`, `abstraction-quality`, `code-smell`, `type-safety`, `code-cleanliness`,
`missing-gaps`, `domain-leakage`, `type-smearing`. Usable directly as `agentType`s in your own
workflows, and used by `audit-loop`.

### Reply check hook

The plugin ships one `Stop` hook that reads the final reply of each main-agent turn. It sends the
reply back when the assistant says it chose, assumed or did something and then leaves it to the
reader to object, as in "unless you object". The instruction it sends is to ask that choice as one
question and stop, because a choice left open to objection is the reader's to make. A reply that
ends in a question about what to do next is not blocked.

- The hook judges every main-agent turn in every session where the plugin is enabled, including
  sessions that load no skill. It does not judge subagents.
- The judge is a small model, `claude-haiku-4-5`, called once per turn end.
- The reply has already streamed when the hook runs. The hook holds only the end of the turn, for
  at most its 20 second timeout.
- A blocked reply stays visible and is followed by a rewrite.
- On a block, the main model receives the text "Stop hook feedback:", then the whole judge prompt
  in square brackets, then the judge's reason. The main model reads the judge prompt on every
  block.
- On a block, the interface shows a notice that a stop hook error occurred, although nothing
  failed. The platform presents every blocking stop hook that way.
- A plugin hook cannot be switched off alone. Disabling the plugin turns the hook off.
- The upstream hooks reference does not document what happens when the judge fails or times out.

The design is recorded in [`docs/reply-check-hook.md`](docs/reply-check-hook.md).

## Requirements / assumptions

- **The Workflow tool / multi-agent fan-out.** Every skill orchestrates subagents via Workflow. A
  harness or plan that doesn't expose Workflow can't run these.
- **Bun 1.2.21 or newer** for `tools/check-spec.ts`, which uses the built-in `Bun.YAML.parse`.
  Validate a private unit spec with `bun tools/check-spec.ts <spec.yaml> --transcripts <session-dir>`.
  Add `--json` for counts and criterion ordinals, `--render <path>` to generate its tracked design
  document, or `--check-render <path>` to check that document before implementation.
- **Explicit model selection.** Agent templates carry no model defaults. The orchestrator must
  select an explicit model and effort for every stage at launch, following the applicable project
  policy. Do not rely on template defaults or implicit inheritance.
- **`audit-loop` runs continuously.** It's designed to be driven by `/loop audit-loop` in a **tight loop
  with no interval** — each ~30+ min full-tree round re-fires the next immediately. It is read-only and
  append-only to a project-local **`./.claude/workflow-skills/AUDIT.md`** (commit or gitignore it as you
  prefer); it never fixes. Fix everything in one sweep when you choose (`implement-review-verify` pairs well).

## Workflow routing checks

```sh
bun test tests/workflow-routing.test.js tests/git-snapshot.test.js tests/reply-check.test.js tests/check-spec.test.js
```

The routing tests use Bun's built-in Markdown parser and execute the documented workflow
skeleton with deterministic fake stage results, including execution boundaries for every stage.
The Git integration test creates scoped commits in a disposable repository under ignored
`.cache/` and verifies pinned reads while HEAD changes. The reply check test asserts the shape
of the hook file and its fixtures. None of these tests makes model calls or launches workflows.
The live runner sends every reply check fixture to the judge model, one call per fixture, and
exits non-zero on a wrong verdict or a failed call. A line that starts with FORMAT means the
verdict was right and the judge's reason did not begin with the rewrite instruction. The runner
counts those lines and they do not fail the run. `bun test` does not match it:

```sh
bun tests/live/reply-check.live.js
```

The verification/consolidation contract is recorded in
[`docs/workflow-finding-verification.md`](docs/workflow-finding-verification.md).
Cycle completion leaves root acceptance pending: inspect stage timings, apply the **20:1**
code/spec size gate, and follow the project's integration route (PR, merge, bundle or patch).
Worktree cleanup requires separately inspected preservation and handoff evidence.

## License

MIT
