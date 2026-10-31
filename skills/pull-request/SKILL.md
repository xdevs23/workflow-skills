---
name: pull-request
description: Open PR, and write or update its description
---

# Open a pull request

- Load `workflow-skills:hygiene` first. Its rules apply to title, description and every picture
  attached to pull request.

## The template

- Write description from this template into a file in project cache defined by
  `workflow-skills:local-cache`, e.g. `body.md`. Save pictures in same directory.

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

- Write title in commit subject style of project, as plain outcome.
- Let description grow only as far as change needs. Description of one-line fix still contains
  value sentence, one sentence under each required heading, one evidence line and picture. Never pad
  a heading to fill it.

## The parts

- Write under "What value this provides" one or two plain sentences: what is better for reader or
  user once change is merged.
- Name benefit for reader or user under "What value this provides". Leave out every file name.
- Write under "The previous problem" what was wrong or missing and where it showed, with cause when
  known.
- Write under "The change" one bullet per behavior. Leave out any list of files.
- End "The change" with **Left out:** bullet: what change deliberately does not do, and where that
  is followed up.
- Open "Evidence" with picture described in section "Evidence pictures".
- Follow picture with before and after in numbers or output, e.g. test that failed and now passes,
  or a measurement.
- List under "Evidence" each command that ran, with its result and counts. Line only saying tests
  pass makes a claim and gives reader nothing to check.
- End "Evidence" with **Not checked:** bullet: what did not run and why.
- Say after **Undo:** whether a revert undoes change, or what a revert does not undo, e.g. data, a
  migration or a published API.
- Name after **Reaches:** who or what notices change.
- Name after **Needs:** deploy order, manual steps, other pull requests to merge first. Or say
  nothing is needed.
- Write under "Review" only where to start reading.
- Never ask for feedback or put question to reviewer under "Review".
- Leave "Review" out when there is nothing to point at.
- Replace placeholder `<the section printed by pr-lines, heading included>` with section printed by
  `pr-lines`, as section "The line graphic" describes. Never write it by hand.
- End with `Closes #<n>` for each issue closed by change, and link to each related pull request.
  Leave line out when there is neither.
- Leave out checklists, "Summary" heading, release-note block unless rules of project ask for one,
  requests for review, review rounds of the change, and "Generated with" footer. Note
  alert already says who wrote description.

## Evidence pictures

- Attach to change of rendered output, in browser, native toolkit or terminal, one evidence sheet
  per changed surface. Render it with visual harness of project from capture on base commit and one
  on head commit, as `workflow-skills:visual-verification` describes. Surface without a scene: give
  it one first.
- Attach to any other change, e.g. to logic, data, a flow, tooling or a skill, one before and after
  picture drawn as `workflow-skills:visual-decisions` describes.
- Do not attach picture to change with nothing to draw, e.g. wording fix or dependency raise. Say
  why in one line under "Evidence".
- Show base commit on left of before and after picture, labeled "Before, <short base commit>". Head
  commit on right, labeled "After, <short head commit>".
- Draw before and after picture new from code at both commits, with only what change changed. Never
  reuse draft page of change.
- Leave out of before and after picture: optional picks, Updated marks, question, explaining
  paragraphs.
- Attach before and after picture as PNG screenshot of page on which it is drawn.

## The line graphic

- Draw graphic with `pr-lines`: Python program `tools/pr-lines.py` in directory of installed plugin
  under plugin cache, or in this repository.
- Pass `pr-lines` base commit, i.e. merge base shared by target branch and head, and head commit
  from which pull request is opened.
- Run `pr-lines` inside repository, or name repository with `--repo`.
- Run `pr-lines` through Nix on Linux and on macOS with Apple silicon: app of flake brings Python,
  git, resvg and Mona Sans fonts along. Command: `nix run path:<plugin directory>#pr-lines
  -- <base> <head> --out lines.png`.
- Use `nix run github:xdevs23/workflow-skills#pr-lines -- <base> <head> --out lines.png` only in
  session without plugin directory. It runs tool as it is on default branch.
- Without Nix, e.g. on Intel Mac, install Python 3.10 or later and git 2.40 or later, then resvg
  with `brew install resvg`, `cargo install resvg` or release binary of resvg project.
- Without Nix, install Mona Sans with `brew install --cask font-mona-sans`, which puts files into
  `~/Library/Fonts`, or from static release zip of `github/mona-sans`, which unpacks them into
  `static/otf` and `static/ttf`.
- Without Nix, run `python3 <plugin directory>/tools/pr-lines.py <base> <head> --out lines.png
  --fonts <directory>`. Directory: `~/Library/Fonts` after cask, or `static/otf` or `static/ttf`
  folder of zip.
- Pass `--resvg <executable>` when resvg is not on `PATH`.
- Replace placeholder `<the section printed by pr-lines, heading included>` in description file with
  section printed by `pr-lines`, heading included.
- When a kind is wrong for project, e.g. Markdown files that are the product, add lines with
  `pr-lines` attribute to `.gitattributes` of repository, e.g. `skills/** pr-lines=code`. `pr-lines`
  reads them at head commit. They override shared rules for every path matched by them.
- Expect line in `.git/info/attributes` of clone to override both committed `.gitattributes` and
  shared rules, as local override for that clone alone.

## Opening and updating

- Check that `gh --version` is [2.99.0](https://github.com/cli/cli/releases/tag/v2.99.0) or newer,
  first release with `--attach`.
- Draw every picture before opening pull request.
- Open pull request with `gh pr create --title "<title>" --body-file body.md --attach lines.png
  --attach evidence.png`. Pass each picture to `--attach` with path by which description refers
  to it. GitHub CLI uploads picture and replaces that reference with address of upload.
- Watch pull request with `workflow-skills:babysit-pr` once it is open.
- Leave out `--attach` on host other than github.com and GitHub Enterprise Cloud, e.g. GitHub
  Enterprise Server, where GitHub CLI cannot upload pictures. There follow rules of project for
  pictures, or put pictures where project hosts images, refer to them by that address and say so
  under "Evidence".
- After each push, run `pr-lines` again for new head and replace section in description file. Draw
  evidence picture again when what it shows changed. Update every other part made wrong by push.
- Update pull request with `gh pr edit <number> --body-file body.md --attach lines.png --attach
  evidence.png`. Attach every picture again. Description file refers to local files until upload
  replaces each reference.
