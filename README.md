# workflow-skills

A bundled Claude Code plugin of **multi-agent workflow skills** plus a library of **audit-lens
subagents**. The skills cover implementing and reviewing a change against a unit spec that quotes
the discussion of the change, copywriting, visual verification and the recovery of an interrupted
workflow run.

## Install

```text
/plugin marketplace add xdevs23/workflow-skills
/plugin install workflow-skills@workflow-skills
```

Then the skills appear in the skill list and each has a matching slash command (e.g.
`/implement-review-verify`).

## What's inside

### Skills
| Skill | What it does |
|---|---|
| `implement-review-verify` | Assemble the unit spec from the user's words in the session transcripts and check it with the spec tool, then implement against it and commit a clean snapshot, with the implementer's sense check reporting what it finds in the spec, then review and independently consolidate findings. The fixer commits only approved corrections while a mandatory roaster reads the pre-fix Git snapshot and approved list. Roast findings are verified against the resulting snapshot before completion. Only unresolved decisions, disagreements and non-convergence need root resolution. |
| `review-pass` | Run the launch check and the fifteen review seats of `implement-review-verify` alone on a change that is already committed, such as one edited directly, and return their findings for you to judge, with no implementer, verifier or fixer. |
| `copywriting` | Write an increment's user-visible strings BEFORE implementation: intent catalog + writing system, one agent per item, mechanical gate + source-verify + fresh-context critic, human ships the load-bearing lines. |
| `resume-interrupted-run` | Recover a workflow run that was stopped while agents were mid-flight: hand each interrupted seat its own prior transcript, leave every completed prompt byte-identical, resume near-losslessly. |
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
The eight read-only audit-lens subagents are `separation-of-concerns`, `abstraction-quality`,
`code-smell`, `type-safety`, `code-cleanliness`, `missing-gaps`, `domain-leakage` and
`type-smearing`. All eight run as seats of every
`implement-review-verify` run's review stage, beside its seven other seats. They are also usable
directly as `agentType`s in your own workflows.

## Requirements / assumptions

- **The Workflow tool / multi-agent fan-out.** Every skill orchestrates subagents via Workflow. A
  harness or plan that doesn't expose Workflow can't run these.
- **Bun 1.2.21 or newer** for `tools/check-spec.ts`, which uses the built-in `Bun.YAML.parse`
  and the Markdown parser `mdast-util-from-markdown`, whose version 2.0.3 its import names and Bun
  fetches on the tool's first run.
  Check a private unit spec with `bun <plugin root>/tools/check-spec.ts <spec.yaml> --transcripts <session-dir>`,
  where the plugin root is this repository or the installed plugin's directory under the plugin cache.
  A unit spec is a YAML file of `unit` and `entries`, and nothing else. Each entry quotes one
  session transcript record by its `file`, `line` and `uuid`, with its `author`, `user` or
  `assistant`, and its `text`, a verbatim substring of that record: a message the user wrote or
  answered in the question dialog, or an assistant text block, the question text of a dialog call
  or the content of a Write call. The tool fails an entry whose text does not stand in the record
  it cites as a message of its author, entries of one session file that go back in line order, and
  a spec without an entry of author `user`.
  Add `--base '<list>'`, a JSON list with one `{ path, sha }` for every git repository of the
  tree it runs at. The tool fails a list that names no repository's top level, a commit its
  repository does not hold, or leaves a repository of the tree out; `--partial-base` accepts a
  list of only the repositories a unit changes, for a tree too large to list.
  implement-review-verify runs only in a git repository or a tree of several, such as a repo-tool
  client. Add `--json` for the summary as JSON. Both output forms carry `specLines`, which the 20:1
  size gate divides by: the non-blank lines of the entries' text. The tool fails an entry whose
  text breaks the width rule: a line, counted with its indentation and markers, holds at most 120
  characters, and every line of a paragraph but its last is full. A line of a fenced code block
  holds at most 120 characters and is never held to the fill rule. A line whose own text is one
  word too long for the width, such as a long URL, passes and is named in the summary's
  `unbreakable` list. The YAML spec is the only form of the spec before and during
  implementation. After the implementation, a
  writer whose change alters the design writes or extends a tracked design document by hand from
  the code as its last write, before its checks, and commits it: the implementer once its
  implementation is done, the fixer once its corrections are done. A change that alters no design
  needs no document, and correcting a design document that describes the code wrongly stays
  allowed.
  A passing run prints a random `proof` that the workflow scripts' launch check returns to prove
  the tool ran.
  Its fix-list mode, `--fix-list <file> --transcripts <session-dir>` in place of the spec, checks
  the fix list of a fix run, which names a parent run in `run` and holds in `entries` decisions of
  its finding verifier and findings of its roaster, each with the pointers attached to it: it holds
  every entry to the parent run's journal, resolves every pointer and prints the entries, with the
  same proof. Add `--expect <json>` to fail when the entries a fix script received at launch differ
  from the list. `--make-fix-list <run> --transcripts <session-dir>` writes a fix list of a run from
  its journal, with every decision and roast finding and no pointers.
- **The pull request watcher `watch-prs` needs Python 3 and the GitHub CLI `gh`, logged in.**
  `babysit-pr` runs it. The watcher is a Python program in the plugin's tools directory, run with
  `python3`. It takes the state file with `--state`, the seconds between polls with `--interval`,
  60 when not given, and one or more pull requests, each named as `owner/repo#number`, or as
  `owner/repo@branch` for the open pull request whose head is that branch. It reads GitHub only
  through `gh api --paginate --slurp` and prints one JSON line per event: `watching` at start,
  `comment`, `review`, `review-comment` and `check-failed` for each one not printed before,
  `merged` or `closed` when a pull request ends, `poll-error` when a poll fails, and `done` when
  every pull request is closed or merged. The state file keeps the ids of the events already
  printed, so a restarted watch prints only what is new. The watcher exits with an error when `gh`
  is missing or not logged in, or when a branch has no open pull request or more than one.
- **Explicit model selection.** Agent templates carry no model defaults. The orchestrator must
  select an explicit model and effort for every stage at launch, following the applicable project
  policy. Do not rely on template defaults or implicit inheritance.

## Workflow routing checks

```sh
bun test tests/workflow-routing.test.js tests/git-snapshot.test.js tests/check-spec.test.js
```

The routing tests execute the two shipped workflow scripts under
`skills/implement-review-verify/scripts/`, the main script also in review mode, with deterministic
fake stage results, including the
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
