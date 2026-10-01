---
name: visual-verification
description: Applies to changes to the rendered output of any user interface, whether it renders in a browser, a native mobile or desktop toolkit or a terminal, and to adopting a visual harness in a project that has none. Verifies such changes with a reproducible harness of real screenshots, controlled data, repeatable interactions, measured checks and strict before and after comparisons, and makes the bundled implementation guide required reading before any harness code is written.
---

# Visual verification

**Load the `workflow-skills:writing-style` skill first.** It binds every comment, document, commit
message and reply this skill produces, and it is not optional when working with this plugin.

A visual harness answers one specific question about a user interface with the real rendered
interface, controlled data and repeatable interactions. A run of one scene produces real screenshots
of the rendering surface, measured checks beside them, and a strict comparison against an earlier
capture, all without live services, credentials or network access during rendering. The harness
adds to the project's unit and behavior tests and replaces none of them: a simulated document or
widget tree cannot lay out boxes or draw fonts, so it can only check that a style was applied. The
harness checks what a person actually sees.

## When this skill applies

This skill applies to two kinds of work. The first is any change to the rendered output of a user
interface in a project that has a visual harness, whether the interface renders in a browser, a
native mobile or desktop toolkit, or a terminal. The second is a request to adopt a harness in a
project that has none.

A change counts as a change to rendered output when any of its commits alters what the interface
draws: markup, styles, layout, copy, fonts, icons, images, themes, or the data shaping that decides
what a screen shows. A refactor that must not alter the look is included, since the harness is what
proves the look did not change.

- Use the harness named in the project's instructions, with the commands, scenes and settings that
  the project's harness contract states.

## Adopting a harness

- Adopt a harness in a project without one as its own unit of work, before the interface change
  that prompted it. The adoption is never made part of a product change.
- Read every file of the implementation guide in full, in the order the index names them, before
  writing any harness code. The guide ships inside this skill as the folder
  `implementation-guide/`, starting at `implementation-guide/index.md`. Reading only the parts that
  look relevant is not enough, because the rules of the later parts constrain the choices of the
  earlier ones: the receipt fields decide what the launcher has to lock, and the comparison rules
  decide what the capture sequence has to control.
- Choose the components that fit the project, and verify their current versions when adding them.
  The guide states what each component of a harness has to do and names concrete components and
  libraries only as examples. The plugin ships no harness code. Each project implements its own
  harness from the guide, so the harness fits the project's language, toolkit and build.
- Give the runs of each adoption unit the guide parts it implements as rule sources, each by its
  file under the plugin root, `<plugin root>/skills/visual-verification/implementation-guide/<file>`.
  Reviewers of the adoption then check the harness against the guide's own words, and a finding
  points at the guide file and line it rests on. The plugin root is the installed plugin's
  directory under the plugin cache, the one whose manifest carries the loaded version.
- Split the adoption per project into units. Adoption is likely split into several sequential
  units, such as the integration survey and the launcher first, then the data boundary, the runtime
  and the first scene, then comparison, reports and the evidence sheet, then the self-test suite.

## Verifying a change

Verifying a change to rendered output follows one sequence, and every step runs the same scene with
the same data and settings.

1. Pick an existing scene that exposes the change. When none does, curate one first as a separate
   small step, as the next section describes, and do not start the product change while curating.
2. Capture the unchanged interface. Where the harness can export the application source from a
   commit, capture it from the base commit so the working tree is never touched.
3. Implement only the approved change.
4. Capture again with the same scene, data and settings, under a new capture name.
5. Compare the two captures.
6. Open the PNGs and the measurements. A passing process is not an inspection: the report says
   which pixels changed and which checks passed, and only looking at the images says whether the
   change looks as intended.
7. Check the outcome. A change that must not alter the look shows zero changed pixels on every
   checkpoint. A change that alters the look shows changes only in the checkpoints it is expected to
   change, with every measured check passing.
8. Say so before a change starts when it alters a compatibility input on purpose, such as a
   translation, a fixture, the scene module or a dependency lock. The comparison refuses such a pair
   and stays strict. Render an evidence sheet of the same two captures under an output name never
   used before, and judge the outcome by reading the sheet, the two receipts and the after
   capture's own measured checks in its receipt and report.
9. Report product findings apart from harness failures. A product finding is something the scene
   shows to be wrong in the product; a harness failure is a scene that could not run or check what
   it declares. Ask for a product decision when the required outcome is genuinely unresolved.

- Never approve a baseline automatically. The comparison exits nonzero for every difference,
  including an intended one, and an intended change is still a difference for a person to review.
- Never loosen the comparison for an input changed on purpose either, since a comparison that
  accepts some changed inputs is no longer the strict verdict.

## Curating a scene

A scene is curated when no existing scene exposes the surface a change touches.

1. Read the real surface: the screen or view, every component it draws, and every consumer of data
   on it, including the shell around it, such as navigation, status lines and background reads.
2. Define the question the scene answers, the complete fixture that every consumer receives, the
   interactions, the measured checks and the named checkpoints. Verify every assumption the scene
   rests on against the code, and agree on the observable checks before the product change starts.
3. Run it and look at every PNG it writes. It counts only when it passes for the right reasons: a
   scene that passes because a fixture was left empty or a target matched the wrong element
   answers nothing.
4. Add its entry to the project's scene documentation: the question, the fixture, the checkpoints
   and the checks.
5. Keep exploratory scenes in the harness's directory inside the project cache, the location
   `workflow-skills:local-cache` defines, until they are deliberately promoted to tracked scenes.
6. Keep a scene that caught a regression permanently.

## Evidence sheets for pull requests

- Attach an evidence sheet for every changed surface when the project's pull request rules require
  visual evidence. Build the sheet from a capture on the pull request's base commit and a capture on
  its candidate commit.
- Make both captures and the sheet before the pull request is created, since some pull request
  hosts upload attachments only when a pull request is created.
- Treat a pull request that touches rendered output and carries no sheet as complete only when none
  of its commits changes rendered output and its description says so.
- Give a surface without a scene one first, tracked or local to the working tree, before the pull
  request is prepared.
- Decide how the sheet shows a surface that does not exist on the base commit while the scene is
  curated, before publication. Such a surface cannot be captured there with the new scene, since the
  scene waits for content the base does not draw. The sheet's before side is either a capture of
  what the base shows at the same place, or the sheet shows the candidate's checkpoints as new ones
  without a before image.

The evidence sheet is a view for a reader. It never passes or fails a pair of captures; the
comparison stays the verdict.

## Visual work in an implement-review-verify unit

`workflow-skills:implement-review-verify` stays unchanged for visual work. What a visual change
should do comes from the user's words in the unit spec, and nothing is written into the spec for
it: no criterion, no capture name and no path.

- Judge a visual change by its comparison outcome, which takes one of three forms: zero changed
  pixels on every checkpoint; changes only in the checkpoints the user's words concern, with every
  measured check passing; or, for a change that alters a compatibility input on purpose, such as a
  translation, a fixture, the scene module or a dependency lock, the intended input change.
- The implementer captures the before state in its worktree from its start commit, before its
  first edit, under a name never used before in that worktree. No other stage captures the before
  state.
- Each writing stage, after its last commit, captures the after state under a name never used
  before in that worktree, such as its stage label joined with the run identifier. It runs the
  comparison against the before capture and returns the comparison command and its output, which
  name both captures, in its checks. The stage's pass or fail proof stays the project's check
  command, because the comparison exits nonzero for every intended change.
- The implementer's returned object reaches the finding verifier and the reviewers that receive it,
  so the capture names travel with it to the next stages. A stage without that object finds the
  captures in the harness directory by their receipts: the before capture is the one whose receipt
  carries the run's base commit, and the after capture the one whose receipt carries the snapshot
  under review. A fix run's fixer reaches them through a pointer its fix list entry attaches, which
  names the parent run's implementer result in the journal.
- For a change of the third form, the comparison refuses the pair and stays strict. The writing
  stage returns the refusal together with an evidence sheet of the same two captures, rendered under
  an output name never used before. The comparison is never loosened for the intended input change,
  since that would weaken the strict verdict.
- Reading stages that receive the spec open the PNGs, the receipts and the comparison reports in
  the harness's directory inside that worktree's project cache, the location
  `workflow-skills:local-cache` defines. For a change of the third form they judge the outcome by
  reading the evidence sheet, the two receipts and the after capture's measured checks in its
  receipt and report.
- Each reading stage checks that the after capture's receipt carries the snapshot under review as
  its source revision, and that the before capture's receipt carries the run's base commit; an
  after capture of another commit is no evidence for this one.
- A point that needs a new capture goes to the fixer, since reading stages write nothing.
- Stages that receive no spec by design, such as the fresh-context quality and alternatives reviews
  and the roaster, get nothing added.

## Known pitfalls

- Keep the rendering engine's scratch directory in the system temporary directory. A browser engine
  binds a local socket under its scratch directory, and a socket path holds at most 107 bytes, so a
  scratch directory inside a deep checkout or worktree can exceed the launcher's limit, and the
  launcher refuses it before the engine starts. Each run gets its own private scratch directory
  there, never one of another run, and the launcher removes it when the run ends. The directory
  holds only temporary files; captures, receipts and reports stay in the harness directory.
- Expect every capture to be slow on a slow shared file system. On a network or user-space mounted
  checkout, every page or screen load can take tens of seconds.
- Give every stage and every repeated attempt its own capture name. Capture names cannot be reused,
  and a second run under an existing name fails.
- Never filter harness output through other commands. Piping it through `head`, `tail` or `grep`
  hides the failure message, which names the scene, checkpoint, predicate or response key and the
  corrective action.
- Control interface states that depend on a clock, such as a blinking indicator, a relative time or
  a rotating placeholder, through the paused clock of the harness. A running clock once put a few
  hundred changed pixels into an otherwise identical pair of captures.
- Make every file watcher of the project, such as a development server or a test renderer, exclude
  the project cache, or it slows down or restarts on every export. Source exports and caches of the
  harness accumulate in the project cache until removed by hand.
- Make scenes assert the rendered values and counts as well as the delivered requests, because
  fixture drift hides behind tolerant data helpers. A helper that fills a missing field with a
  default lets a changed wire format render a plausible screen.
