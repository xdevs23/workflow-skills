---
name: visual-verification
description: Verify changes to the rendered output of any user interface, whether it renders in a browser, a native mobile or desktop toolkit or a terminal, and adopt a visual harness in a project without one.
---

# Visual verification

**Load the `workflow-skills:writing-style` skill first.** It binds every comment, document, commit
message and reply this skill produces, and it is not optional when working with this plugin.

You use a visual harness to answer one specific question about a user interface, with the real
rendered interface, controlled data and repeatable interactions. A run of one scene produces real
screenshots of the rendering surface, measured checks beside them, and a strict comparison against
an earlier capture. During rendering, the harness does not use live services, credentials or
network access. The harness adds to the unit and behavior tests in the project and replaces none of
them. A simulated document or widget tree cannot lay out boxes or draw fonts, so a test on it can
only check that a style was applied. The harness checks what a person actually sees.

## When this skill applies

- Apply this skill to every change to the rendered output of a user interface in a project that has
  a visual harness, whether the interface renders in a browser, a native mobile or desktop toolkit,
  or a terminal.
- Apply it to a request to adopt a harness in a project without one.
- Count a change as a change to rendered output when any of its commits alters what the interface
  draws: markup, styles, layout, copy, fonts, icons, images, themes, or the code that selects and
  shapes the data shown on a screen.
- Count a refactor that must not alter the look as such a change too.
- Use the harness listed in the project instructions, with the commands, scenes and settings
  written in the harness contract of the project.

## Adopting a harness

- Adopt a harness in a project without one as a separate unit of work, before the interface change
  that led to it. Never make the adoption part of a product change.
- Read every file of the implementation guide in full, in the order given in the index, before you
  write any harness code. The guide is the folder `implementation-guide/` beside this file, starting
  at `implementation-guide/index.md`.
- Do not read only the parts that look relevant. The rules of later parts constrain choices made in
  earlier ones. The fields of the receipt determine what the launcher has to lock, and the
  comparison rules determine what the capture sequence has to control.
- Choose the components that fit the project, and verify their current versions when you add them.
  The guide describes what each component of a harness has to do and mentions concrete components
  and libraries only as examples.
- Build the harness of each project from the guide for the language, toolkit and build used in that
  project. The plugin does not contain harness code.
- Hand each unit of the adoption the guide parts it implements, as the rules binding the unit, each
  as a path under the plugin root: `<plugin
  root>/skills/visual-verification/implementation-guide/<file>`. The reviewers then check the
  harness against the wording of the guide, and each finding points to the guide file and line it is
  based on. The plugin root is the directory in the plugin cache that contains the installed plugin,
  the one with a manifest that lists the loaded version.
- Split the adoption in each project into units. An adoption needs several units in
  sequence, such as the integration survey and the launcher first, then the data boundary, the
  runtime and the first scene, then comparison, reports and the evidence sheet, then the self-test
  suite.

## Verifying a change

To verify a change to rendered output, run every step below with the same scene, the same data and
the same settings.

1. Pick an existing scene that exposes the change. When the existing scenes all miss the change,
   curate one first as a separate small step, as described under Curating a scene, and do not start
   the product change while you curate.
2. Capture the unchanged interface. Where the harness can export the application source from a
   commit, capture it from the base commit, so the capture leaves the working tree unchanged.
3. Implement only the approved change.
4. Capture again with the same scene, data and settings, under a new capture name.
5. Compare the two captures.
6. Open the PNGs and the measurements. A run that passes does not replace looking at the images.
   The report shows which pixels changed and which checks passed. Only the images show whether the
   change looks as intended.
7. Check the outcome. A change that must not alter the look shows zero changed pixels on every
   checkpoint. A change that alters the look shows changes only in the checkpoints it is expected to
   change, with every measured check passing.
8. When a change alters a compatibility input on purpose, such as a translation, a fixture, the
   scene module or a dependency lock, say so before the change starts. The comparison refuses such a
   pair as incompatible and is still strict. Render an evidence sheet built from the same two
   captures under an output name not used before. Judge the outcome by reading the sheet, the two
   receipts and the measured checks of the after capture in its receipt and report.
9. Report product findings separately from harness failures. A product finding is a defect in the
   product, shown by the scene. A harness failure is a scene that could not run or could not check
   what it declares. Ask for a product decision when the required outcome is still open.

- Never approve a baseline automatically. The comparison exits nonzero for every difference,
  including an intended one. An intended change is still a difference for a person to review.
- Never loosen the comparison for an input changed on purpose either, since a comparison that
  accepts some changed inputs is no longer the strict verdict.

## Curating a scene

Curate a scene when none of the existing scenes exposes the surface affected by a change.

1. Read the real surface: the screen or view, every component it draws, and every consumer of data
   on it, including the shell around it, such as navigation, status lines and requests that read
   data in the background.
2. Define the question for the scene, the complete fixture received by every consumer, the
   interactions, the measured checks and the named checkpoints. Check every assumption made by the
   scene against the code, and agree on the observable checks before the product change starts.
3. Run the scene and look at every PNG it writes. Count the scene only when it passes for the right
   reasons. A scene that passes because a fixture was left empty or a target matched the wrong
   element proves nothing.
4. Add an entry for the scene to the scene documentation of the project, with the question, the
   fixture, the checkpoints and the checks.
5. Keep exploratory scenes in the harness directory inside the project cache, the location defined
   by `workflow-skills:local-cache`, until you deliberately promote them to tracked scenes.
6. Keep a scene that caught a regression permanently.

## Evidence sheets for pull requests

- Attach an evidence sheet for every changed surface when the pull request rules of the project
  require visual evidence. Build the sheet from two captures: one on the base commit and one on the
  candidate commit.
- Make both captures and the sheet before the pull request is created, since some pull request
  hosts upload attachments only when a pull request is created.
- Treat a pull request that affects rendered output but does not attach a sheet as complete only
  when none of its commits changes rendered output and its description explains this.
- Create a scene first for a surface without one, tracked or local to the working tree, before you
  prepare the pull request.
- While you curate the scene, and before publication, decide how the sheet shows a surface missing
  on the base commit. The new scene cannot capture such a surface on the base commit. Either the
  before side of the sheet is a capture of what the base commit shows at the same place, or the
  sheet shows the checkpoints of the candidate capture as new ones without a before image.
- Never use the evidence sheet to pass or fail a pair of captures. The sheet is a view for a reader.
  The comparison is the verdict.

## Visual work in a change of `workflow-skills:implement`

- Take what a visual change should do from the words of the user in the notes.
- Judge a visual change by the outcome of the comparison, which has one of three forms:
  - zero changed pixels on every checkpoint;
  - changes only in the checkpoints covered by the words of the user, with every measured check
    passing;
  - for a change that alters a compatibility input on purpose, such as a translation, a fixture, the
    scene module or a dependency lock, the intended input change.
- Run every scene, capture and comparison, and the self-test suite of the harness, yourself in
  your build. An implementer writes scenes, fixtures and harness code and runs none of them.
- Capture the before state yourself, before the first implementer starts, from the commit where the
  change starts, in the worktree where your build runs, under a name not used before in that
  worktree.
- Capture the after state in your build, run on the branch that contains the whole change after its
  last commit, under a name not used before in that worktree. Run that build before the reviewers
  start on the change.
- Run the comparison against the before capture in the same build. Keep the comparison command and
  its output, which contain the names of both captures, together with the checks you ran. Prove
  pass or fail with the check command of the project, because the comparison exits nonzero for
  every intended change.
- Hand a failed comparison to an implementer like any other failure of the build, with the
  comparison report.
- After any fix to a visual change, capture the after state again in your next build under a name
  not used before, and compare it against the before capture.
- Hand the scope reviewer the absolute path to every capture, comparison report and evidence sheet
  you made, each with what it shows. The scope reviewer opens by name the captures you compared.
- For a change of the third form, the comparison refuses the pair as incompatible and is still
  strict. Keep the output of that comparison together with an evidence sheet built from the same
  two captures, rendered under an output name not used before. Never loosen the comparison for the
  intended input change.
- The scope reviewer opens the PNGs, the receipts and the comparison reports in the harness
  directory inside the project cache of the worktree where your build runs, the location defined by
  `workflow-skills:local-cache`. For a change of the third form, the scope reviewer judges the
  outcome by reading the evidence sheet, the two receipts and the measured checks of the after
  capture in its receipt and report.
- The scope reviewer checks that the receipt of the after capture records the commit under review as
  source revision, and that the receipt of the before capture records the commit where the change
  starts. An after capture of another commit proves nothing about this commit.
- Take a point that needs a new capture into your next build. Reviewers do not write anything.

## Known pitfalls

- Keep the scratch directory used by the rendering engine in the system temporary directory. A
  browser engine binds a local socket under the scratch directory it uses, and a socket path can be
  at most 107 bytes long. A scratch directory inside a deep checkout or worktree can exceed the
  limit checked by the launcher, and the launcher then exits with an error before the engine starts.
- Give each run a private scratch directory there, never the directory of another run. The launcher
  removes it when the run ends. The directory contains only temporary files. Captures, receipts and
  reports are written to the harness directory.
- Expect every capture to be slow on a slow shared file system. On a network or user-space mounted
  checkout, every page or screen load can take tens of seconds.
- Give every stage and every repeated attempt a separate capture name. Capture names cannot be
  reused: a second run under an existing name fails.
- Never filter harness output through other commands. Piping it through `head`, `tail` or `grep`
  hides the failure message, which contains the name of the scene, checkpoint, predicate or
  response key and the corrective action.
- Control interface states that depend on a clock, such as a blinking indicator, a relative time or
  a rotating placeholder, through the paused clock of the harness. A running clock once put a few
  hundred changed pixels into an otherwise identical pair of captures.
- Make every file watcher in the project, such as a development server or a test renderer, exclude
  the project cache. Otherwise the watcher slows down or restarts on every export. Source exports
  and caches written by the harness accumulate in the project cache until removed by hand.
- Make scenes assert the rendered values and counts as well as the delivered requests. A helper that
  fills a missing field with a default lets a changed wire format render a plausible screen.
