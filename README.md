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
| `implement-review-verify` | Assemble the unit spec from the user's words in the session transcripts and check it with the spec tool, then implement against it and commit a clean snapshot, with the implementer's sense check reporting what it finds in the spec, then review and independently consolidate findings. The fixer commits only approved corrections while a mandatory roaster reads the pre-fix Git snapshot and approved list. Everything a run returns to be fixed goes to a fix run, whose fixer resolves it by the user's words and the rules and returns only a product decision as a question for the user. |
| `review-pass` | Run the thirteen reviewers of `implement-review-verify` that need no spec alone on a change that is already committed, such as one edited directly, with no spec, implementer, verifier or fixer, and send their findings to a fix run. |
| `copywriting` | Write an increment's user-visible strings BEFORE implementation: intent catalog + writing system, one agent per item, mechanical check + source-verify + fresh-context critic, and the user ships the crucial lines. |
| `resume-interrupted-run` | Recover a workflow run that was stopped while agents were mid-flight: hand each interrupted seat its own prior transcript, leave every completed prompt byte-identical, resume near-losslessly. |
| `visual-verification` | Check a change to any rendered user interface, in a browser, a native mobile or desktop toolkit or a terminal, with a reproducible visual harness: real screenshots, controlled data, measured checks and strict before and after comparisons. A project without a harness adopts one from the implementation guide bundled with the skill. |
| `visual-decisions` | Put open product decisions to the user as one page of side-by-side pictures of named code states and the proposed After, with one question to answer per decision. |
| `babysit-pr` | Watch a submitted pull request until it is closed or merged, and act on every comment, review and failed check that reaches it. |
| `pr-comment-replies` | Write and post replies on pull requests and issues: the note alert on top, inline replies that start with their outcome and a reason for every declined finding. |
| `report-plugin-issues` | File every problem found in this plugin as an issue on its repository, or as a comment on the open issue that already describes it, with project details and private data kept out, in place of patching its scripts silently. |
| `hygiene` | Keep private conversation content, the user's words, setup facts, secrets and third-party material that may not ship out of everything that leaves the machine: commits, posts, documents and packages. |
| `engineering-principles` | State the principles every design, change, test and debugging session follows: how a system is shaped, how state, input, limits and errors are handled, how tests are built and how the work is done. |
| `code-writing` | State how code reads in every language: its style, comments, names and strings, with one file of crafts and idioms for each of Kotlin, Rust, C and C++, Go, Nix, TypeScript and Python. |
| `wall-of-shame` | Keep an append-only record of rule violations by coding-agent sessions, each with the words, the rule it broke and the transcript line. |
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
  size check divides by: the non-blank lines of the entries' text. The tool fails an entry whose
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
  A passing run prints a `proof`, the fingerprint of the values it checked, and `--proof <proof>`
  fails the check when the values give another. The writer of each workflow script runs the tool
  before anything else with `--proof` set to the fingerprint of the script's own launch values, and
  the script compares the printed proof with that fingerprint.
  Its fix-list mode, `--fix-list <file>` in place of the spec, checks the fix list of a fix run,
  which names the saved result of a parent run in `result`, the spec that run checked in `spec`,
  null after a review pass, and holds in `entries` everything the run returned to be fixed, each as
  that result holds it: it compares the whole list, in order, with what the parent run returned and
  the spec with the one that run checked, and prints the spec with the proof of the list's values,
  and with `--entries` the entries as well. `--base` and `--partial-base` check a fix run's base
  list against the tree as in the spec mode. `--make-fix-list <saved result>` writes the fix list of
  a run from the output file the workflow tool saved its result in, copied into the project cache:
  the spec its check passed on and the `toFix` list the run returns. Each workflow script builds
  that list from the results it accepted: every spec finding of its implementer, every decision and
  unresolved issue of its finding verifier apart from an approved correction its fixer fixed or
  rejected that decides no inverse-spec finding, or every finding of its reviewers in a run without
  a verifier, every entry of a fix run's own list its fixer left open, and every finding of its
  roaster and diff check. A run in which a stage failed or raised a hard flag gives no fix list,
  whatever exit it ended with. Add `--size <json>` to add a measured size breach of the unit.
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
writers' spec check and execution boundaries for every stage, and read the skill's Markdown with Bun's
built-in parser for the prose and helper they check.
The Git integration test creates scoped commits in a disposable repository under the project
cache that `workflow-skills:local-cache` defines, and verifies reads at a fixed commit while HEAD
changes.
None of these tests makes model calls or launches workflows.

The verification/consolidation contract is recorded in
[`docs/workflow-finding-verification.md`](docs/workflow-finding-verification.md).
Cycle completion leaves root acceptance pending: inspect stage timings, apply the **20:1**
code/spec size check, and follow the project's integration route (PR, merge, bundle or patch).
Worktree cleanup requires separately inspected preservation and handoff evidence.

## License

MIT
