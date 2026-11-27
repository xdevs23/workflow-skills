---
name: visual-verification
description: Verify changes to rendered output of any user interface, and adopt visual harness in project without one
---

## When this skill applies

- Apply to every change to rendered output of a user interface in project with visual harness,
  whether interface renders in browser, native mobile or desktop toolkit, or terminal
- Apply also to request to adopt harness in project without one
- Count change as change to rendered output when any of its commits alters what interface draws:
  markup, styles, layout, copy, fonts, icons, images, themes, or code that selects and shapes data
  shown on screen
- Count refactor that must not alter look as such change too
- Use harness listed in project instructions, with commands, scenes and settings written in harness
  contract of project

## Adopting a harness

- Build harness to wording of implementation guide, folder `implementation-guide/` beside this
  file, starting at `implementation-guide/index.md`, for language, toolkit and build of project.
  Plugin does not contain harness code
- Rules of later parts constrain choices made in earlier ones. Fields of receipt determine what
  launcher has to lock. Comparison rules determine what capture sequence has to control
- Choose components that fit project. Verify their current versions when adding them. Guide names
  concrete components and libraries only as examples
- Finding about harness points to guide file and line on which it is based. Guide path:
  `<plugin root>/skills/visual-verification/implementation-guide/<file>`. Plugin root: directory in
  plugin cache containing installed plugin, the one with manifest listing loaded version

## A verified change

- Change to rendered output counts as verified only by comparison of two captures of a scene that
  exposes it, same scene, same data, same settings: one at commit where change starts, one of
  commit that lands. Receipts record those two commits as source revisions
- Comparison outcome takes one of three forms:
  - zero changed pixels on every checkpoint, apart from accepted artifact, for change that must
    not alter look;
  - changes only in checkpoints covered by user words, every measured check passing;
  - for change that alters compatibility input on purpose, e.g. translation, fixture, scene module
    or dependency lock: the intended input change, said before change starts, with evidence sheet
    built from same two captures
- Report shows which pixels changed and which checks passed. Only images show whether change looks
  as intended: judge look by PNGs, receipts and reports, also after passing run
- Product findings stand apart from harness failures. Product finding: defect in product, shown by
  scene. Harness failure: scene that could not run or could not check what it declares. Draw
  product decision as `workflow-skills:visual-decisions` describes when required outcome is still
  open
- Accept difference as artifact only after inspecting it and capturing both states again, and only
  when it does not appear again or clearly comes from how browser renders page
- Keep every capture and comparison output. Never report accepted artifact as finding
- List every accepted artifact in report as accepted, with checkpoint, both captures and reason for
  accepting it
- Never approve baseline automatically. Comparison exits nonzero for every difference, intended one
  included
- Never loosen comparison for input changed on purpose either

## A good scene

- Covers real surface: screen or view, every component drawn by it, every consumer of data on it,
  including shell around it, e.g. navigation, status lines, requests reading data in background
- Has question, complete fixture received by every consumer, interactions, measured checks and
  named checkpoints, each assumption checked against code
- Passes for right reasons. Scene passing because fixture was left empty or target matched wrong
  element proves nothing
- Asserts rendered values and counts as well as delivered requests. Helper that fills missing field
  with default lets changed wire format render plausible screen
- Has entry in scene documentation of project, with question, fixture, checkpoints and checks
- Exploratory scene stays in harness directory inside project cache, location defined by
  `workflow-skills:local-cache`, until promoted to tracked scene
- Scene that caught regression stays permanently

## Evidence sheets for pull requests

- Attach evidence sheet for every changed surface when pull request rules of project require visual
  evidence. Build sheet from two captures: one on base commit, one on candidate commit
- Have both captures and sheet ready before pull request is created. Some pull request hosts upload
  attachments only when pull request is created
- Treat pull request that affects rendered output but does not attach a sheet as complete only when
  none of its commits changes rendered output and its description explains this
- Show surface missing on base commit either by capture of what base commit shows at same place, or
  by checkpoints of candidate capture as new ones without before image
- Never use evidence sheet to pass or fail pair of captures. Sheet: view for reader. Comparison:
  verdict

## Known pitfalls

- Keep scratch directory used by rendering engine in system temporary directory. Browser engine
  binds local socket under scratch directory used by it. Socket path is at most 107 bytes long.
  Scratch directory inside deep checkout or worktree can exceed limit checked by launcher. Launcher
  then exits with error before engine starts
- Give each run private scratch directory there, never directory of another run. Launcher removes
  it when run ends. Directory contains only temporary files. Captures, receipts and reports go to
  harness directory
- Every capture is slow on slow shared file system. On network or user-space mounted checkout,
  every page or screen load can take tens of seconds
- Give every capture separate capture name. Second run under existing name fails
- Never filter harness output through other commands. Piping it through `head`, `tail` or `grep`
  hides failure message, which contains name of scene, checkpoint, predicate or response key and
  corrective action
- Control interface states depending on a clock, e.g. blinking indicator, relative time or rotating
  placeholder, through paused clock of harness. Running clock once put few hundred changed pixels
  into otherwise identical pair of captures
- Make every file watcher in project, e.g. development server or test renderer, exclude project
  cache. Otherwise watcher slows down or restarts on every export. Source exports and caches
  written by harness accumulate in project cache until removed by hand
