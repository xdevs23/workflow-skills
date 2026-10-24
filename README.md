# workflow-skills

workflow-skills is a Claude Code plugin with skills for multi-agent workflows, skills with the rules
for engineering, code, writing and hygiene, and a library of review-lens skills. The workflow
skills cover implementing and reviewing a change from notes of the user's words and a draft
approved by the user, autonomous implementation, copywriting, visual decisions and visual
verification, opening and watching a pull request and recovering an interrupted workflow run.

## Install

```text
/plugin marketplace add xdevs23/workflow-skills
/plugin install workflow-skills@workflow-skills
```

After the installation, the skills appear in the skill list, each with a matching slash command,
such as `/workflow-skills:implement`.

## Requirements

- Claude Code with the Workflow tool for skills that launch stages.
- Bun for the tests.
- Python 3 and an authenticated GitHub CLI for `babysit-pr`.
- Python 3.10 or later, git 2.40 or later, resvg and the Mona Sans font for `pull-request`, which
  draws the line graphic with them, and the GitHub CLI in version
  [2.99.0](https://github.com/cli/cli/releases/tag/v2.99.0) or later, the first release with
  `--attach`. On Linux and on macOS with Apple silicon, the `pr-lines` app of the flake brings
  Python, git, resvg and the font along. An Intel Mac installs them without Nix, as the skill
  describes.

## License

The plugin is released under the MIT license.
