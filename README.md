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
| `implement-review-verify` | Assemble the unit spec from the user's words in the session transcripts and check it with the spec tool, then implement against it and commit a clean snapshot, with the implementer's sense check reporting what it finds in the spec, then review and independently consolidate findings. The fixer commits only approved corrections while a mandatory roaster reads the pre-fix Git snapshot and approved list. Everything a run returns to be fixed goes to one follow-up run, whose implementer resolves it by the user's words and the rules and states what nothing resolves as a problem for the user, without a question; the follow-up's review checks its change, and what it leaves is recorded for later. |
| `review-pass` | Run the fourteen reviewers of `implement-review-verify` that need no spec alone on a change that is already committed, such as one edited directly, with no spec, implementer, verifier or fixer, and send their findings to a follow-up run. |
| `autonomous-implementation` | Implement without asking, on the user's grant for a task, a session or a timeframe: subagents make the decisions, each milestone ends with evidence, a subset of the reviewers checks the work, and the result is libre and built with Nix. |
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
The nine read-only audit-lens subagents are `separation-of-concerns`, `abstraction-quality`,
`code-smell`, `type-safety`, `code-cleanliness`, `missing-gaps`, `domain-leakage`,
`type-smearing` and `runtime-cost`. All nine run as seats of every
`implement-review-verify` run's review stage, beside its seven other seats. They are also usable
directly as `agentType`s in your own workflows.

## Requirements

- Claude Code with the Workflow tool for skills that launch stages.
- Bun 1.2.21 or newer for the spec checker.
- A Bun release with `Bun.markdown.render` for the tests.
- Python 3 and an authenticated GitHub CLI for `babysit-pr`.

## Tests

```sh
bun test --timeout 60000 tests/
```

## License

MIT
