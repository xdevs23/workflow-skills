---
name: pull-request
description: Open PR, and write or update its description
---

- Rules of `workflow-skills:hygiene` apply to title, description and every picture attached to
  pull request
- Write title and description by `workflow-skills:copywriting`

## The template

- Keep description, e.g. `body.md`, and its pictures in project cache defined by
  `workflow-skills:local-cache`
- Fill `<model>` with every model that wrote commits of change. Model that opens pull request
  counts only when it wrote commits

```markdown
> [!NOTE]
> 🤖 **<model> opening on behalf of @<handle>**

## What value this provides

<value>

## The previous problem

<problem>

## The change

- <behavior>
- **Left out:** <boundary>

## Evidence

![<caption>](<picture>)

- <numbers>
- <command>
- **Not checked:** <gap>

## Impact

- **Undo:** <revert>
- **Reaches:** <reach>
- **Needs:** <steps>

## Review

<start>

<the section printed by pr-lines, heading included>

Closes #<n>
```

- Write title in commit subject style of project, as plain outcome
- Let description grow only as far as change needs. Description of one-line fix still contains
  value sentence, one sentence under each required heading, one evidence line and picture

## The parts

- Write under "What value this provides" one or two plain sentences: benefit for reader or user once
  change is merged. Leave out every file name
- Write under "The previous problem" what was wrong or missing and where it showed, with cause when
  known
- Write under "The change" one bullet per behavior. Leave out any list of files
- End "The change" with **Left out:** bullet: what change deliberately does not do, and where that
  is followed up
- Open "Evidence" with picture described in section "Evidence pictures"
- Follow picture with before and after in numbers or output, e.g. test that failed and now passes,
  or a measurement
- List under "Evidence" each command that ran, with its result and counts. Line only saying tests
  pass makes a claim and gives reader nothing to check
- End "Evidence" with **Not checked:** bullet: what did not run and why
- Say after **Undo:** whether a revert undoes change, or what a revert does not undo, e.g. data, a
  migration or a published API
- Name after **Reaches:** who or what notices change
- Name after **Needs:** deploy order, manual steps, other pull requests to merge first. Or say
  nothing is needed
- Write under "Review" only where to start reading
- Never ask for feedback or put question to reviewer under "Review"
- Leave "Review" out when there is nothing to point at
- Replace placeholder `<the section printed by pr-lines, heading included>` with section printed by
  `pr-lines`, as section "The line graphic" describes. Never write it by hand
- End with `Closes #<n>` for each issue closed by change, and link to each related pull request.
  Leave line out when there is neither
- Leave out checklists, "Summary" heading, release-note block unless rules of project ask for one,
  requests for review, review rounds of the change, and "Generated with" footer. Note
  alert already says who wrote description

## Evidence pictures

- Attach to change of rendered output, in browser, native toolkit or terminal, one evidence sheet
  per changed surface, from capture on base commit and one on head commit, as
  `workflow-skills:visual-verification` describes
- Attach to any other change, e.g. to logic, data, a flow, tooling or a skill, one before and after
  picture drawn as `workflow-skills:visual-decisions` describes
- Do not attach picture to change with nothing to draw, e.g. wording fix or dependency raise. Say
  why in one line under "Evidence"
- Show base commit on left of before and after picture, labeled "Before, <short base commit>". Head
  commit on right, labeled "After, <short head commit>"
- Draw before and after picture new from code at both commits, with only what change changed. Never
  reuse draft page of change
- Leave out of before and after picture: Updated marks, explaining paragraphs
- Attach before and after picture as PNG screenshot of page on which it is drawn

## The line graphic

- `pr-lines` draws graphic: Python program `tools/pr-lines.py` in directory of installed plugin
  under plugin cache, or in this repository. It takes base commit, i.e. merge base shared by
  target branch and head, and head commit, inside repository or with `--repo`
- With Nix: `nix run path:<plugin directory>#pr-lines -- <base> <head> --out lines.png`, which
  brings Python, git, resvg and Mona Sans fonts. Without plugin directory:
  `nix run github:xdevs23/workflow-skills#pr-lines -- <base> <head> --out lines.png`
- Without Nix: Python 3.10 or later, git 2.40 or later, resvg (`--resvg <executable>` where not on
  `PATH`) and Mona Sans (`--fonts <directory>`)
- When a kind is wrong for project, e.g. Markdown files that are the product, add lines with
  `pr-lines` attribute to `.gitattributes` of repository, e.g. `skills/** pr-lines=code`. `pr-lines`
  reads them at head commit. They override shared rules for every path matched by them
- Expect line in `.git/info/attributes` of clone to override both committed `.gitattributes` and
  shared rules, as local override for that clone alone

## Opening and updating

- `--attach` needs `gh` [2.99.0](https://github.com/cli/cli/releases/tag/v2.99.0) or newer
- Open pull request with `gh pr create --title "<title>" --body-file body.md --attach lines.png
  --attach evidence.png`. Pass each picture to `--attach` with path by which description refers
  to it. GitHub CLI uploads picture and replaces that reference with address of upload
- Leave out `--attach` on host other than github.com and GitHub Enterprise Cloud, e.g. GitHub
  Enterprise Server, where GitHub CLI cannot upload pictures. There follow rules of project for
  pictures, or put pictures where project hosts images, refer to them by that address and say so
  under "Evidence"
- After each push, description matches new head: line graphic, evidence picture and every other
  part
- Update pull request with `gh pr edit <number> --body-file body.md --attach lines.png --attach
  evidence.png`. Attach every picture again
