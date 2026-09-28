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
| `visual-verification` | Check a change to any rendered user interface, in a browser, a native mobile or desktop toolkit or a terminal, with a reproducible visual harness: real screenshots, controlled data, measured checks and strict before and after comparisons. A project without a harness adopts one from the implementation guide bundled with the skill. |
| `babysit-pr` | Watch a submitted pull request until it is closed or merged, and act on every comment, review and failed check that reaches it. |
| `pr-comment-replies` | Write and post replies on pull requests and issues: the note alert on top, inline replies that start with their outcome and a reason for every declined finding. |
| `local-cache` | Define the project cache, the ignored directory for files not meant for the repository, and what reading and writing stages may put there. |
| `todo-md` | Keep the todo record, the untracked `TODO.md` that holds open work and where each item stands. |

The plugin refers to these last two as `workflow-skills:local-cache` and `workflow-skills:todo-md`.
When a session has a skill of the same name without the plugin prefix, such as a user's own
`todo-md`, that skill is used and the plugin's is not. The plugin's skill is used only when it is
the only one of that name available.

### Audit-lens subagents (read-only)
`separation-of-concerns`, `abstraction-quality`, `code-smell`, `type-safety`, `code-cleanliness`,
`missing-gaps`, `domain-leakage`, `type-smearing`. Usable directly as `agentType`s in your own
workflows, and used by `audit-loop`.

## Requirements / assumptions

- **The Workflow tool / multi-agent fan-out.** Every skill orchestrates subagents via Workflow. A
  harness or plan that doesn't expose Workflow can't run these.
- **Bun 1.2.21 or newer** for `tools/check-spec.ts`, which uses the built-in `Bun.YAML.parse`
  and the Markdown parser `mdast-util-from-markdown`, whose version 2.0.3 its import names and Bun
  fetches on the tool's first run.
  Validate a private unit spec with `bun <plugin root>/tools/check-spec.ts <spec.yaml> --transcripts <session-dir>`,
  where the plugin root is this repository or the installed plugin's directory under the plugin cache.
  Add `--base <commit>` so a cited rule file tracked at that commit is read there and not from
  the working tree, while an untracked file reads from disk. Add `--json` for counts and
  criterion ordinals. Both output forms carry `specLines`, which the 20:1 size gate divides by:
  the non-blank lines of the spec's prose, which is `unit`, `summary` and each item's `content`,
  `user_words`, `answers`, `quote`, `observation.output` and `reason`, plus one line for each
  distinct item id named as a parent. The tool fails a spec whose prose breaks the width rule: a
  line, counted with its indentation and markers, holds at most 120 characters, and every line of
  a paragraph but its last is full. A line of a fenced code block holds at most 120 characters
  and is never held to the fill rule. A line whose own text is one word too long for the width,
  such as a long URL, passes and is named in the summary's `unbreakable` list. The YAML spec
  is the only form of the spec before and during implementation. After the implementation, the
  implementer writes the tracked design document by hand from the code as its last write, before
  its checks, and commits it, and the fixer updates it as its last write after its corrections.
  The tool neither renders nor checks that document. A passing run prints a random `proof` that
  the workflow scripts' launch check returns to prove the tool ran.
  A spec names its private directive record in the `record` key. The record is a YAML file of
  `unit` and `entries`, each entry quoting the user's `words` with the transcript `file`, `line`
  and `uuid` they stand at and a non-empty list of quoted `context` from the surrounding
  conversation, and optionally the `answers` they reply to and the plan text they approve in
  `approves`. The tool fails when that file is missing, is not of that format, holds a quote the
  cited transcript record or plan file does not bear out, cites words from a record the user did
  not write, or lacks any quoted `user_words` of the spec in the words of an entry. Add
  `--record <path>` to fail when the record path a script received at launch differs from the
  spec's `record`.
  Its fix-list mode, `--fix-list <file> --transcripts <session-dir>` in place of the spec, checks
  the fix list of a fix run: it resolves every entry against the parent run's journal and prints
  the same proof. Add `--expect <json>` to fail when the entries and parent spec a fix script
  received at launch differ from the list, and `--record <path>` to fail when the record path
  differs from the parent spec's `record`.
- **Explicit model selection.** Agent templates carry no model defaults. The orchestrator must
  select an explicit model and effort for every stage at launch, following the applicable project
  policy. Do not rely on template defaults or implicit inheritance.
- **`audit-loop` runs continuously.** It's designed to be driven by `/loop audit-loop` in a **tight loop
  with no interval** — each ~30+ min full-tree round re-fires the next immediately. It is read-only and
  append-only to a project-local **`./.claude/workflow-skills/AUDIT.md`** (commit or gitignore it as you
  prefer); it never fixes. Fix everything in one sweep when you choose (`implement-review-verify` pairs well).

## Workflow routing checks

```sh
bun test tests/workflow-routing.test.js tests/git-snapshot.test.js tests/check-spec.test.js
```

The routing tests execute the three shipped workflow scripts under
`skills/implement-review-verify/scripts/` with deterministic fake stage results, including the
launch check and execution boundaries for every stage, and read the skill's Markdown with Bun's
built-in parser for the prose and helper they check.
The Git integration test creates scoped commits in a disposable repository under the project
cache that `workflow-skills:local-cache` defines, and verifies reads at a fixed commit while HEAD
changes.
None of these tests makes model calls or launches workflows.

The verification/consolidation contract is recorded in
[`docs/workflow-finding-verification.md`](docs/workflow-finding-verification.md).
Cycle completion leaves root acceptance pending: inspect stage timings, apply the **20:1**
code/spec size gate, and follow the project's integration route (PR, merge, bundle or patch).
Worktree cleanup requires separately inspected preservation and handoff evidence.

## License

MIT
