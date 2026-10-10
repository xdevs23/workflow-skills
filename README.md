# workflow-skills

A bundled Claude Code plugin of **multi-agent workflow skills** plus a library of **review-lens
skills**. The skills cover implementing and reviewing a change from notes of the user's words and a
draft the user approved, copywriting, visual verification and the recovery of an interrupted
workflow run.

## Install

```text
/plugin marketplace add xdevs23/workflow-skills
/plugin install workflow-skills@workflow-skills
```

Then the skills appear in the skill list and each has a matching slash command (e.g.
`/implement`).

## What's inside

### Skills
| Skill | What it does |
|---|---|
| `implement` | Write the user's words about a change into notes and draw an HTML draft the user approves, then have implementers write the smallest code the task needs, reviewers check it against the notes and the rule skills `engineering-principles`, `code-writing`, `writing-style` and `hygiene`, and send the change to the user's own review. |
| `review-pass` | Run the reviewers of `implement` alone on a change that is already committed, such as one edited directly. |
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

### Review lenses
The fourteen review-lens skills are `reviewer-correctness`, `missing-gaps`, `runtime-cost`,
`cold-alternatives`, `duplicate-checker`, `abstraction-quality`, `separation-of-concerns`,
`domain-leakage`, `smearing`, `code-smell`, `type-safety`, `project-rule-reader`,
`code-cleanliness` and `quality`. The reviewers of `implement` load them by layer, and each one can
also be loaded alone to review a change through its lens.

## Requirements

- Claude Code with the Workflow tool for skills that launch stages.
- Bun for the tests.
- Python 3 and an authenticated GitHub CLI for `babysit-pr`.

## Tests

```sh
bun test --timeout 60000 tests/
```

## License

MIT
