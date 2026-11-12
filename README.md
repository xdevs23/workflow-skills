# workflow-skills

Claude Code plugin with skills and hooks for multi-agent engineering workflows.

## Quickstart

```text
/plugin marketplace add xdevs23/workflow-skills
/plugin install workflow-skills@workflow-skills
```

Then run a skill, such as `/workflow-skills:implement`.

## Features

### Skills

| When you | Use |
|---|---|
| build a change, from the first talk to the review | `implement`: implementer agents, six reviewers, one fix run |
| let Claude build on its own for a task, a session or a time span | `autonomous-implementation` |
| plan modules, layers and interfaces | `designing-architecture` |
| write or change code | `writing-code`, with notes for Kotlin, Rust, C and C++, Go, Nix, TypeScript and Python |
| write tests | `writing-tests` |
| hunt a bug or a failing build | `debugging` |
| prove that a change works | `verifying-work`, `visual-verification` |
| handle failures, store data or grant access | `handling-errors`, `storing-data`, `securing-access` |
| change the build or a release | `changing-the-build` |
| work with an API, law or text that belongs to someone else | `working-with-outside-systems` |
| review a committed change | `review-pass`, with lenses for correctness, gaps, duplicates, type safety, runtime cost, structure and rule bypasses |
| design a screen or a web page | `design`, `ui-design`, `ux-design`, `web-design`, `building-screens` |
| pick between design directions | `design-drafts` |
| show a plan, trade-off or decision as a page | `visual-decisions` |
| write text for product screens, marketing or translations | `copywriting`: copywriter, critic and fact checker |
| commit, open a pull request or answer on one | `commit-messages`, `logical-units`, `pull-request`, `pr-comment-replies`, `babysit-pr` |
| write anything a person reads | `writing-style` |
| keep secrets and private words out of commits and posts | `hygiene` |
| run agents in parallel, or resume a stopped run | `workflows`, `resume-interrupted-run`, `glance` |
| track what is in progress and what comes next | `todo-md`, `local-cache` |
| ask the user something | `question` |
| record a broken rule | `wall-of-shame` |
| report a problem with this plugin | `report-plugin-issues` |

### In every session

| Feature | What it does |
|---|---|
| Goals | `/goals` or the Goals button opens a pane of goals with priority and dependencies. Claude attaches TODO entries and marks goals done with evidence. Claude gets the open goals after each compaction and after 30 idle minutes. Nudge asks Claude to finish one goal. |
| Reminders | `/reminders` or the Reminders button opens a pane of texts sent to Claude every few minutes or hours, after a background task, after a compaction, or when Claude says a phrase. |
| Questions | Claude asks with a tool and keeps working. The question waits above the prompt and in a pane, and the answer reaches Claude with the next tool result or prompt. `/answer` answers by command. |
| Skill check | A tool call waits until the skills it needs are loaded: `writing-code` before code is edited, `commit-messages` and `writing-style` before `git commit`, `writing-tests` before a test is written. |
| Turn-end hints | A turn that ends on a message announcing work, waiting on the user or claiming nothing needs action goes back to Claude once, with the reason. |
| Self-check | While the user is away, Claude is asked to check the work it delivered. |

### Tools

| Tool | Use |
|---|---|
| `nix run .#test` | type check, lint and every test of the plugin |
| `nix run .#pr-lines` | a picture of the diff lines by kind of file, for a pull request description |
| `tools/watch-prs.py` | follows pull requests: comments, reviews, failed checks, conflicts and merges |

## License

MIT
