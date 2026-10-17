# workflow-skills

workflow-skills is a Claude Code plugin with skills for multi-agent workflows, skills with the rules
for engineering, code, writing and hygiene, and a library of review-lens skills. The workflow
skills cover implementing and reviewing a change from notes of the user's words and a draft
approved by the user, autonomous implementation, copywriting, visual decisions and visual
verification, watching a pull request and recovering an interrupted workflow run.

## Install

```text
/plugin marketplace add xdevs23/workflow-skills
/plugin install workflow-skills@workflow-skills
```

After the installation, the skills appear in the skill list, each with a matching slash command,
such as `/workflow-skills:implement`.

## What's inside

### Skills
| Skill | What it does |
|---|---|
| `implement` | Write the user's words about a change into notes and draw an HTML draft for the user to approve. Implementers then write the smallest code needed by the task from the notes and the draft, without the rules. Reviewers check it: some against the rules in `engineering-principles`, `code-writing`, `writing-style` and `hygiene`, others against the notes or by the review lenses alone. Every finding names the shape to build, and the change goes to the user for review. |
| `review-pass` | Run the reviewers of `implement` alone on a change that is already committed, such as one edited directly. |
| `autonomous-implementation` | Implement without asking, once the user grants it for a task, a session or a timeframe. Subagents make the decisions, each milestone ends with evidence, a subset of the reviewers checks the work, and the result is libre and built with Nix. |
| `copywriting` | Write the user-visible strings of an increment before the implementation starts: an intent catalog and a writing system, one writer per area and locale, a mechanical check, a check against the sources and a fresh-context critic, and the user picks and reads the crucial strings. |
| `resume-interrupted-run` | Recover a workflow run that was stopped while agents were still working: hand each interrupted agent the transcript of the earlier attempt by that agent, leave every completed prompt byte-identical, and resume with almost nothing lost. |
| `visual-verification` | Check a change to any rendered user interface, in a browser, a native mobile or desktop toolkit or a terminal, with a reproducible visual harness: real screenshots, controlled data, measured checks and strict before and after comparisons. A project without a harness adopts one from the implementation guide bundled with the skill. |
| `visual-decisions` | Draw the draft of a change, or product decisions that need an answer, as pages of side-by-side pictures that show the code in named states next to After, one page at a time, with a legend, alternatives drawn as optional picks and marks for what changed after each answer. |
| `babysit-pr` | Watch a submitted pull request until it is closed or merged, and act on every comment, review, failed check and failed commit status on it. |
| `pr-comment-replies` | Write and post replies on pull requests and issues: the note alert on top, inline replies that start with their outcome and a reason for every declined finding. |
| `report-plugin-issues` | File every problem found in this plugin as an issue on the plugin repository, or as a comment on the open issue that already describes it, with details of the project and private data kept out, instead of patching the scripts of the plugin silently. |
| `hygiene` | Rules against putting the contents of private conversations, the user's words, setup facts, secrets and third-party material that may not ship into anything that leaves the machine: commits, posts, documents and packages. |
| `engineering-principles` | The principles followed by every design, change, test and debugging session: how a system is shaped, how state, input, limits and errors are handled, how tests are built and how the work is done. |
| `code-writing` | The rules for how code reads in every language: its style, comments, names and strings, with one file of crafts and idioms for each of Kotlin, Rust, C and C++, Go, Nix, TypeScript and Python. |
| `writing-style` | The plain language, sentence shapes and vocabulary for every text read by a person, such as code comments, documents, commit messages and replies. |
| `wall-of-shame` | An append-only record of rule violations by sessions of coding agents, each entry with the model, the words quoted from the transcript, the broken rule and the line in the transcript. |
| `local-cache` | Define the project cache, the ignored directory for files not meant for the repository, and what reading and writing stages may put there. |
| `todo-md` | The todo record, the untracked `TODO.md` with the open work and the state of each item. |

The plugin refers to `local-cache` and `todo-md` by the names `workflow-skills:local-cache` and
`workflow-skills:todo-md`. When a session has a skill of the same name without the plugin prefix,
such as a `todo-md` written by the user, that skill is used in place of the one in the plugin. The
skill in the plugin is used only when it is the only one of that name available.

### Review lenses
The fourteen review-lens skills are `reviewer-correctness`, `missing-gaps`, `runtime-cost`,
`cold-alternatives`, `duplicate-checker`, `abstraction-quality`, `separation-of-concerns`,
`domain-leakage`, `smearing`, `code-smell`, `type-safety`, `project-rule-reader`,
`code-cleanliness` and `quality`. The reviewers of `implement` load them by layer. Each one can
also be loaded alone to review a change through its lens.

## Requirements

- Claude Code with the Workflow tool for skills that launch stages.
- Bun for the tests.
- Python 3 and an authenticated GitHub CLI for `babysit-pr`, in version 2.48.0 or later, the first
  release with `gh api --slurp`, which the watcher calls.

## Tests

```sh
bun test --timeout 60000 tests/
```

## License

The plugin is released under the MIT license.
