---
name: visual-verification
description: Verify changes to rendered output of any user interface, and adopt visual harness in project without one
---

# Visual verification

## When this skill applies

- Apply to every change to rendered output of a user interface in project with visual harness,
  whether interface renders in browser, native mobile or desktop toolkit, or terminal.
- Apply also to request to adopt harness in project without one.
- Count change as change to rendered output when any of its commits alters what interface draws:
  markup, styles, layout, copy, fonts, icons, images, themes, or code that selects and shapes data
  shown on screen.
- Count refactor that must not alter look as such change too.
- Use harness listed in project instructions, with commands, scenes and settings written in harness
  contract of project.

## Adopting a harness

- Adopt harness in project without one as separate unit of work, before interface change that led
  to it. Never make adoption part of product change.
- Read every file of implementation guide in full, in order given in index, before writing any
  harness code. Guide: folder `implementation-guide/` beside this file, starting at
  `implementation-guide/index.md`.
- Do not read only parts that look relevant. Rules of later parts constrain choices made in earlier
  ones. Fields of receipt determine what launcher has to lock. Comparison rules determine what
  capture sequence has to control.
- Choose components that fit project. Verify their current versions when adding them. Guide
  describes what each component of harness has to do, names concrete components and libraries only
  as examples.
- Build harness of each project from guide, for language, toolkit and build used in that project.
  Plugin does not contain harness code.
- Hand each unit of adoption the parts of guide implemented by it, as rules binding the unit, each
  as path under plugin root: `<plugin root>/skills/visual-verification/implementation-guide/<file>`.
  Reviewers then check harness against wording of guide. Each finding points to guide file and line
  on which it is based. Plugin root: directory in plugin cache containing installed plugin, the one
  with manifest listing loaded version.
- Split adoption in each project into units. Adoption needs several units in sequence, e.g.
  integration survey and launcher first, then data boundary, runtime and first scene, then
  comparison, reports and evidence sheet, then self-test suite.

## Verifying a change

To verify change to rendered output, run every step below with same scene, same data, same
settings.

1. Pick existing scene that exposes change. When existing scenes all miss change, curate one first
   as separate small step, as described under Curating a scene. Do not start product change while
   curating.
2. Capture unchanged interface. Where harness can export application source from a commit, capture
   from base commit, so capture leaves working tree unchanged.
3. Implement only approved change.
4. Capture again with same scene, data and settings, under new capture name.
5. Compare the two captures.
6. Open PNGs and measurements. Passing run does not replace looking at images. Report shows which
   pixels changed and which checks passed. Only images show whether change looks as intended.
7. Check outcome. Change that must not alter look: zero changed pixels on every checkpoint, apart
   from accepted artifact. Change that alters look: changes only in checkpoints expected to be
   changed by it, every measured check passing.
8. When change alters compatibility input on purpose, e.g. translation, fixture, scene module or
   dependency lock, say so before change starts. Comparison rejects such pair as incompatible and
   is still strict. Render evidence sheet built from same two captures under output name not used
   before. Judge outcome by reading sheet, both receipts, and measured checks of after capture in
   its receipt and report.
9. Report product findings separately from harness failures. Product finding: defect in product,
   shown by scene. Harness failure: scene that could not run or could not check what it declares.
   Ask for product decision when required outcome is still open.

- Accept difference as artifact only after inspecting it and capturing both states again, and only
  when it does not appear again or clearly comes from how browser renders page.
- Keep every capture and comparison output. Never report accepted artifact as finding.
- List every accepted artifact in report as accepted, with checkpoint, both captures and reason for
  accepting it.
- Never approve baseline automatically. Comparison exits nonzero for every difference, intended one
  included. Intended change is still a difference for a person to review.
- Never loosen comparison for input changed on purpose either. Comparison that accepts some changed
  inputs is no longer the strict verdict.

## Curating a scene

Curate scene when none of existing scenes exposes surface affected by change.

1. Read real surface: screen or view, every component drawn by it, every consumer of data on it,
   including shell around it, e.g. navigation, status lines, requests reading data in background.
2. Define question for scene, complete fixture received by every consumer, interactions, measured
   checks, named checkpoints. Check every assumption made by scene against code. Agree on
   observable checks before product change starts.
3. Run scene, look at every PNG written by it. Count scene only when it passes for right reasons.
   Scene passing because fixture was left empty or target matched wrong element proves nothing.
4. Add entry for scene to scene documentation of project, with question, fixture, checkpoints and
   checks.
5. Keep exploratory scenes in harness directory inside project cache, location defined by
   `workflow-skills:local-cache`, until you deliberately promote them to tracked scenes.
6. Keep scene that caught regression permanently.

## Evidence sheets for pull requests

- Attach evidence sheet for every changed surface when pull request rules of project require visual
  evidence. Build sheet from two captures: one on base commit, one on candidate commit.
- Make both captures and sheet before pull request is created. Some pull request hosts upload
  attachments only when pull request is created.
- Treat pull request that affects rendered output but does not attach a sheet as complete only when
  none of its commits changes rendered output and its description explains this.
- Create scene first for surface without one, tracked or local to working tree, before preparing
  pull request.
- While curating scene, and before publication, decide how sheet shows surface missing on base
  commit. New scene cannot capture such surface on base commit. Either before side of sheet is
  capture of what base commit shows at same place, or sheet shows checkpoints of candidate capture
  as new ones without before image.
- Never use evidence sheet to pass or fail pair of captures. Sheet: view for reader. Comparison:
  verdict.

## Visual work in a change of `workflow-skills:implement`

- Take what visual change should do from user's words in notes.
- Judge visual change by outcome of comparison, which has one of three forms:
  - zero changed pixels on every checkpoint;
  - changes only in checkpoints covered by user's words, every measured check passing;
  - for change that alters compatibility input on purpose, e.g. translation, fixture, scene module
    or dependency lock: the intended input change.
- Run every scene, capture and comparison, and self-test suite of harness, yourself in your build.
  Implementer writes scenes, fixtures and harness code, runs none of them.
- Capture before state yourself, before first implementer starts, from commit where change starts,
  in worktree where your build runs, under name not used before in that worktree.
- Capture after state in your full build after merge, on branch containing whole change, as
  `workflow-skills:implement` describes, under name not used before in that worktree.
- Run comparison against before capture in same build. Keep comparison command and its output,
  which contain names of both captures, together with checks run by you. Prove pass or fail with
  check command of project, because comparison exits nonzero for every intended change.
- Hand failed comparison to implementer like any other build failure, with comparison report.
- After any fix to visual change, capture after state again in your next build under name not used
  before. Compare it against before capture.
- For change of third form, comparison rejects pair as incompatible and is still strict. Keep output
  of that comparison together with evidence sheet built from same two captures, rendered under
  output name not used before. Never loosen comparison for intended input change.
- Open PNGs, receipts and comparison reports yourself, in harness directory inside project cache of
  worktree where your build runs. Judge outcome from them. For change of third form, judge by
  reading evidence sheet, both receipts, and measured checks of after capture in its receipt and
  report.
- Check that receipt of after capture records commit built by you as source revision, and receipt of
  before capture records commit where change starts. After capture of another commit proves nothing
  about this commit.
- Do not hand captures to reviewers. You check visual outcome yourself.

## Known pitfalls

- Keep scratch directory used by rendering engine in system temporary directory. Browser engine
  binds local socket under scratch directory used by it. Socket path is at most 107 bytes long.
  Scratch directory inside deep checkout or worktree can exceed limit checked by launcher. Launcher
  then exits with error before engine starts.
- Give each run private scratch directory there, never directory of another run. Launcher removes
  it when run ends. Directory contains only temporary files. Captures, receipts and reports go to
  harness directory.
- Expect every capture to be slow on slow shared file system. On network or user-space mounted
  checkout, every page or screen load can take tens of seconds.
- Give every stage and every repeated attempt separate capture name. Capture names cannot be
  reused: second run under existing name fails.
- Never filter harness output through other commands. Piping it through `head`, `tail` or `grep`
  hides failure message, which contains name of scene, checkpoint, predicate or response key and
  corrective action.
- Control interface states depending on a clock, e.g. blinking indicator, relative time or rotating
  placeholder, through paused clock of harness. Running clock once put few hundred changed pixels
  into otherwise identical pair of captures.
- Make every file watcher in project, e.g. development server or test renderer, exclude project
  cache. Otherwise watcher slows down or restarts on every export. Source exports and caches
  written by harness accumulate in project cache until removed by hand.
- Make scenes assert rendered values and counts as well as delivered requests. Helper that fills
  missing field with default lets changed wire format render plausible screen.
