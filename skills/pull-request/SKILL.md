---
name: pull-request
description: Open a pull request, and write or update the description of one.
---

# Open a pull request

**Load the `workflow-skills:writing-style` and `workflow-skills:hygiene` skills first.** Their rules
apply to the title, the description and every picture attached to the pull request. Load them
whenever you work with this plugin.

## The template

- Write the description from this template into a file in the project cache defined by
  `workflow-skills:local-cache`, such as `body.md`, and save the pictures in the same directory.

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

- Write the title in the commit subject style of the project, as a plain outcome.
- Let the description grow only as far as the change needs. A one-line fix keeps the value sentence,
  one sentence under each required heading, one evidence line and the picture. Never pad a heading
  to fill it.

## The parts

- Write under "What value this provides" one or two plain sentences on what is better for the
  reader or the user once the change is merged.
- Name the benefit for the reader or the user under "What value this provides", and leave out every
  file name.
- Write under "The previous problem" what was wrong or missing and where it showed, with the cause
  when it is known.
- Write under "The change" one bullet per behavior, and leave out any list of files.
- End "The change" with a **Left out:** bullet naming what the change deliberately does not do and
  where that is followed up.
- Open "Evidence" with the picture described in the section "Evidence pictures".
- Follow the picture with the before and after in numbers or output, such as the test that failed
  and now passes or a measurement.
- List under "Evidence" each command that ran, with its result and its counts. A line that only says
  the tests pass makes a claim and gives its reader nothing to check.
- End "Evidence" with a **Not checked:** bullet naming what did not run and why.
- Say after **Undo:** whether a revert undoes the change, or what a revert does not undo, such as
  data, a migration or a published API.
- Name after **Reaches:** who or what notices the change.
- Name after **Needs:** the deploy order, the manual steps and the other pull requests to merge
  first, or say that nothing is needed.
- Write under "Review" only where to start reading.
- Never ask for feedback or put a question to the reviewer under "Review".
- Leave "Review" out when there is nothing to point at.
- Replace the placeholder `<the section printed by pr-lines, heading included>` with the section
  that `pr-lines` prints, as the section "The line graphic" describes. Never write it by hand.
- End with `Closes #<n>` for each issue the change closes and a link to each related pull request.
  Leave the line out when there is neither.
- Leave out checklists, a "Summary" heading, a release-note block unless the rules of the project
  ask for one, requests for review, the review rounds the change went through and a "Generated
  with" footer. The note alert already says who wrote the description.

## Evidence pictures

- Attach to a change of rendered output, in a browser, a native toolkit or a terminal, one evidence
  sheet for every changed surface. Render it with the visual harness of the project from a capture
  on the base commit and one on the head commit, as `workflow-skills:visual-verification` describes.
  Give a surface without a scene one first.
- Attach to any other change, such as one to logic, data, a flow, tooling or a skill, one before and
  after picture drawn as `workflow-skills:visual-decisions` describes.
- Do not attach a picture to a change with nothing to draw, such as a wording fix or a dependency
  raise, and say why in one line under "Evidence".
- Show the base commit on the left of a before and after picture, labeled "Before, <short base
  commit>", and the head commit on the right, labeled "After, <short head commit>".
- Draw a before and after picture new from the code at both commits, with only what the change
  changed. Never reuse the draft page of the change.
- Leave out of a before and after picture the optional picks, the Updated marks, the question and
  explaining paragraphs.
- Attach a before and after picture as a PNG screenshot of the page it is drawn on.

## The line graphic

- Draw the graphic with `pr-lines`, the Python program `tools/pr-lines.py` in the directory of the
  installed plugin under the plugin cache, or in this repository.
- Pass `pr-lines` the base commit, which is the merge base that the target branch shares with the
  head, and the head commit that the pull request is opened from.
- Run `pr-lines` inside the repository, or name the repository with `--repo`.
- Run `pr-lines` through Nix on Linux and on macOS with Apple silicon, where the app of the flake
  brings Python, git, resvg and the Mona Sans fonts along: `nix run path:<plugin directory>#pr-lines
  -- <base> <head> --out lines.png`.
- Use `nix run github:xdevs23/workflow-skills#pr-lines -- <base> <head> --out lines.png` only in a
  session without the plugin directory. It runs the tool as it is on the default branch.
- Without Nix, as on an Intel Mac, install Python 3.10 or later and git 2.40 or later, then resvg
  with `brew install resvg`, `cargo install resvg` or a release binary of the resvg project.
- Without Nix, install Mona Sans with `brew install --cask font-mona-sans`, which puts the files
  into `~/Library/Fonts`, or from the static release zip of `github/mona-sans`, which unpacks them
  into `static/otf` and `static/ttf`.
- Without Nix, run `python3 <plugin directory>/tools/pr-lines.py <base> <head> --out lines.png
  --fonts <directory>`, with `~/Library/Fonts` as the directory after the cask, or the `static/otf`
  or the `static/ttf` folder of the zip.
- Pass `--resvg <executable>` when resvg is not on the `PATH`.
- Replace the placeholder `<the section printed by pr-lines, heading included>` in the description
  file with the section that `pr-lines` prints, heading included.
- When a kind is wrong for the project, such as Markdown files that are the product, add lines with
  the `pr-lines` attribute to the `.gitattributes` of the repository, such as
  `skills/** pr-lines=code`. `pr-lines` reads them at the head commit, and they override the shared
  rules for every path they match.
- Expect a line in the `.git/info/attributes` of the clone to override both the committed
  `.gitattributes` and the shared rules, as a local override for that clone alone.

## Opening and updating

- Check that `gh --version` is [2.99.0](https://github.com/cli/cli/releases/tag/v2.99.0) or newer,
  the first release with `--attach`.
- Draw every picture before you open the pull request.
- Open the pull request with `gh pr create --title "<title>" --body-file body.md --attach lines.png
  --attach evidence.png`. Pass each picture to `--attach` with the path the description refers to it
  by. The GitHub CLI uploads the picture and replaces that reference with the address of the upload.
- Watch the pull request with `workflow-skills:babysit-pr` once it is open.
- Leave out `--attach` on a host other than github.com and GitHub Enterprise Cloud, such as GitHub
  Enterprise Server, where the GitHub CLI cannot upload pictures. Follow the rules of the project
  for pictures there, or put the pictures where the project hosts images, refer to them by that
  address and say so under "Evidence".
- After each push, run `pr-lines` again for the new head and replace the section in the description
  file. Draw the evidence picture again when what it shows changed, and update every other part the
  push made wrong.
- Update the pull request with `gh pr edit <number> --body-file body.md --attach lines.png --attach
  evidence.png`. Attach every picture again. The description file refers to the local files until
  the upload replaces each reference.
