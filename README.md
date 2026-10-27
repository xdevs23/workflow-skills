# workflow-skills

workflow-skills is a Claude Code plugin with skills for multi-agent workflows, skills with the rules
for each moment of engineering work, such as designing architecture, writing code and writing
tests, skills with the rules for writing and hygiene, and a library of review-lens skills. The
workflow skills cover implementing and reviewing a change from notes of the user's words and a draft
approved by the user, autonomous implementation, copywriting, visual decisions and visual
verification, opening and watching a pull request and recovering an interrupted workflow run.

The plugin also ships a hooks module that lets Claude ask questions without waiting for the
answers, in interactive sessions. A session run with `-p` or the Agent SDK gets none of its tools.
The tool `ask_question` stores a question and returns at once. In the main conversation, it
returns a denial until the Skill tool has loaded `workflow-skills:question` there.
`list_questions` lists the open ones, the answered ones and the withdrawn ones, and
`withdraw_question` takes back a question that Claude no longer needs answered.

The questions of a project are saved across sessions until they are answered, in the file
`~/.claude/plugins/store/workflow-skills_<suffix>.json` that the plugin writes. On a machine that
keeps only some of its files across restarts, add that file to the kept ones. A project is the
folder a session started in, so a session that moves into a worktree keeps the questions of that
folder.

You answer them in any order: in the pane opened from the row above the prompt, which has input
fields and choice lists, or with `/answer <number> <answer>`. An answer is sent to Claude as a note
with the next tool result while Claude works, or as a new message while the session is idle. An
answer given during a turn you interrupted is sent with your next message.

## Install

```text
/plugin marketplace add xdevs23/workflow-skills
/plugin install workflow-skills@workflow-skills
```

After the installation, the skills appear in the skill list, each with a matching slash command,
such as `/workflow-skills:implement`.

## Requirements

- Claude Code with the Workflow tool for skills that launch stages.
- Bun and Node.js for the tests in `tests/` and for the type check and the lint of the hooks
  module in `hooks/`, and the `claude` command for the tests of the hooks module. The `test` app of
  the flake runs all of them. The type check reads the declarations of the mod API from
  `.claude-plugin/types/`, which an interactive session started with `--plugin-dir .` writes.
- Python 3 and an authenticated GitHub CLI for `babysit-pr`.
- Python 3.10 or later, git 2.40 or later, resvg and the Mona Sans font for `pull-request`, which
  draws the line graphic with them, and the GitHub CLI in version
  [2.99.0](https://github.com/cli/cli/releases/tag/v2.99.0) or later, the first release with
  `--attach`. On Linux and on macOS with Apple silicon, the `pr-lines` app of the flake brings
  Python, git, resvg and the font along. An Intel Mac installs them without Nix, as the skill
  describes.

## License

The plugin is released under the MIT license.
