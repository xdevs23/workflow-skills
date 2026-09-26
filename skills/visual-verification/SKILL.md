---
name: visual-verification
description: Applies to changes to the rendered output of any user interface, whether it renders in a browser, a native mobile or desktop toolkit or a terminal, and to adopting a visual harness in a project that has none. Verifies such changes with a reproducible harness of real screenshots, controlled data, repeatable interactions, measured checks and strict before and after comparisons, and makes the bundled implementation guide required reading before any harness code is written.
---

# Visual verification

**Load the `writing-style` skill first.** It binds every comment, document, commit message and
reply this skill produces, and it is not optional when working with this plugin.

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

A harness named in the project's instructions is the harness this skill uses, with the commands,
scenes and settings that the project's harness contract states.

A change counts as a change to rendered output when any of its commits alters what the interface
draws: markup, styles, layout, copy, fonts, icons, images, themes, or the data shaping that decides
what a screen shows. A refactor that must not alter the look is included, since the harness is what
proves the look did not change.

## Adopting a harness

A project without a harness adopts one as its own unit of work, before the interface change that
prompted it. The adoption is never folded into a product change.

The implementation guide ships inside this skill as the folder `implementation-guide/`, starting at
`implementation-guide/index.md`. Before writing any harness code, the agent reads every file of the
guide in full, in the order the index names them. Reading only the parts that look relevant is not
enough, because the rules of the later parts constrain the choices of the earlier ones: the receipt
fields decide what the launcher has to lock, and the comparison rules decide what the capture
sequence has to control.

The guide states what each component of a harness has to do and names concrete components and
libraries only as examples. The agent chooses the components that fit the project, and verifies
their current versions when adding them. The plugin ships no harness code. Each project implements
its own harness from the guide, so the harness fits the project's language, toolkit and build.

The adoption spec cites the guide part by part. Each citation is a rule item whose file is the guide
file under the plugin root, `<plugin root>/skills/visual-verification/implementation-guide/<file>`,
with its line and a quote of the rule. Reviewers of the adoption then check the harness against the
guide's own words. The plugin root is the installed plugin's directory under the plugin cache, the
one whose manifest carries the loaded version.

Adoption is likely split into several sequential units, such as the integration survey and the
launcher first, then the data boundary, the runtime and the first scene, then comparison, reports
and the evidence sheet, then the self-test suite. The split is decided per project when the
adoption spec is written, and each unit's spec cites the guide parts it implements.

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
7. A change that must not alter the look shows zero changed pixels on every checkpoint. A change
   that alters the look shows changes only in the checkpoints it is expected to change, with every
   measured check passing.
8. A change that alters a compatibility input on purpose, such as a translation, a fixture, the
   scene module or a dependency lock, declares those inputs before it starts. The comparison
   refuses such a pair and stays strict. Compare the two receipts field by field and list the
   fields that differ. The pair is judged only when those fields are exactly the declared inputs;
   any other difference fails it. Then render one evidence sheet per variant, each under an output
   name never used before. Take the changed-pixel counts from each sheet's structured results
   file, where a checkpoint whose dimensions changed counts as changed, and take the measured
   checks from the after capture's own receipt and report.
9. Report product findings apart from harness failures. A product finding is something the scene
   shows to be wrong in the product; a harness failure is a scene that could not run or check what
   it declares. Ask for a product decision when the required outcome is genuinely unresolved.

The comparison exits nonzero for every difference, including an intended one. An intended change is
still a difference for a person to review, and no baseline is ever approved automatically. The
comparison is never loosened for declared inputs either, since a comparison that accepts some
changed inputs is no longer the strict verdict.

## Curating a scene

A scene is curated when no existing scene exposes the surface a change touches.

1. Read the real surface: the screen or view, every component it draws, and every consumer of data
   on it, including the shell around it, such as navigation, status lines and background reads.
2. Define the question the scene answers, the complete fixture that every consumer receives, the
   interactions, the measured checks and the named checkpoints. Verify every assumption the scene
   rests on against the code, and agree on the observable checks before the product change starts.
3. Run it until it passes for the right reasons, and look at every PNG it writes. A scene that
   passes because a fixture was left empty or a target matched the wrong element answers nothing.
4. Add its entry to the project's scene documentation: the question, the fixture, the checkpoints
   and the checks.
5. Keep exploratory scenes in the harness's directory inside the project cache, the location
   `workflow-skills:local-cache` defines, until they are deliberately promoted to tracked scenes.
6. Keep a scene that caught a regression permanently.

## Evidence sheets for pull requests

A project whose pull request rules require visual evidence attaches an evidence sheet for every
changed surface. The sheet is built from a capture on the pull request's base commit and a capture
on its candidate commit. Both captures and the sheet are made before the pull request is created,
since some pull request hosts upload attachments only when a pull request is created. A pull request
that touches rendered output and carries no sheet is complete only when none of its commits changes
rendered output, and its description says so. A surface without a scene gets one first, tracked or
local to the working tree, before the pull request is prepared.

A surface that does not exist on the base commit cannot be captured there with the new scene, since
the scene waits for content the base does not draw. The way the sheet shows such a surface is
decided while the scene is curated, before publication. The sheet's before side is either a capture
of what the base shows at the same place, or the sheet shows the candidate's checkpoints as new ones
without a before image.

The evidence sheet is a view for a reader. It never passes or fails a pair of captures; the
comparison stays the verdict.

## Visual work in an implement-review-verify unit spec

The `implement-review-verify` skill stays unchanged for visual work. The orchestrating session
expresses the visual part of a unit in the unit spec, and the stages act on it as the spec states.

A criterion for a visual change names the scene, the checkpoints and the expected comparison
outcome. The outcome is one of three forms: zero changed pixels on every checkpoint; changes only
in the named checkpoints with every measured check passing; or, for a change that alters
compatibility inputs on purpose, the declared input change. A criterion of the third form declares
in advance which compatibility inputs its change alters, such as a translation, a fixture, the
scene module or a dependency lock, and names the checkpoints expected to change.

The orchestrating session captures the before state once, in the worktree the stages use, from the
base commit, before the implement stage starts, and writes the capture name into the unit spec. No
stage captures the before state again.

The scratch directory of the harness lives in the worktree's project cache. When its path is too
long for the rendering engine, or the worktree sits on a slow shared file system, the setup makes
that directory reachable at a short path through a mount or share, such as a virtual machine's file
share or a bind mount, and the orchestrating session provides that short path to the stages in the
unit spec. Every run passes it through the launcher's scratch override and uses its own
subdirectory below it.

Each writing stage, after its last commit, captures the after state under a name never used before
in that worktree, such as its stage label joined with the run identifier. It runs the comparison
against the before capture and returns both capture names with the comparison report as evidence.
The stage's pass or fail proof stays the project's check command, because the comparison exits
nonzero for every intended change. The outcome is judged from the changed-pixel count of each
checkpoint against the checkpoints the criterion names.

For a criterion of the third form, the comparison refuses the pair and stays strict. The writing
stage compares the before and after receipts field by field and returns the fields that differ.
The pair is judged only when the differing fields are exactly the declared inputs, and any other
difference fails the outcome. The stage then renders one evidence sheet per variant under output
names never used before, and returns the sheets with their structured results files. The
changed-pixel counts come from those files, a checkpoint whose dimensions changed counts as
changed, and the measured checks come from the after capture's own receipt and report. The
comparison is never loosened for the declared inputs, since that would weaken the strict verdict.

Reading stages that receive the spec open the PNGs, the receipts and the comparison reports in the
harness's directory inside that worktree's project cache, the location `workflow-skills:local-cache`
defines. For a criterion of the third form they also open the evidence sheets, their structured
results files and the field-by-field receipt difference. Each reading stage checks that the after
capture's receipt carries the snapshot under review as its source revision, and that the before
capture's receipt carries the base commit the unit spec names; an after capture of another commit
is no evidence for this one. A point that needs a new capture goes to the fixer, since reading
stages write nothing. Stages that receive no spec by design, such as the fresh-context quality and
alternatives reviews and the roaster, get nothing added.

A fix run's fix-list entry for a visual defect states, in its correction, the scene, the
checkpoints, the expected outcome and the name of the before capture. For a change of the third
form, the entry also names the declared inputs, the evidence sheets, their structured results files
and the field-by-field receipt difference.

## Known pitfalls

The rendering engine's scratch directory can exceed a path limit. A browser engine binds a local
socket under its scratch directory, and a socket path holds at most 107 bytes, so the scratch path
of a deep checkout or worktree can exceed the launcher's limit, and the launcher refuses it before
the engine starts. The scratch directory still lives in the project cache. The setup makes it
reachable at a short path through a mount or share, such as a virtual machine's file share or a
bind mount, and the launcher's scratch override names that short path. Each run uses its own
subdirectory below it, never shared with another run. The system temporary directory is used only
when no mount or share is possible, and then within the user's global rules.

A slow shared file system makes every capture slow. On a network or user-space mounted checkout,
every page or screen load can take tens of seconds. The remedy is the same: the setup makes the
scratch directory in the project cache reachable at a short path through a mount or share, and the
scratch override names that path.

Capture names cannot be reused. A second run under an existing name fails, so every stage and every
repeated attempt needs its own name.

Harness output is never filtered through other commands. Piping it through `head`, `tail` or `grep`
hides the failure message, which names the scene, checkpoint, predicate or response key and the
corrective action.

Interface states that depend on a clock, such as a blinking indicator, a relative time or a rotating
placeholder, are controlled through the paused clock of the harness. A running clock once put a few
hundred changed pixels into an otherwise identical pair of captures.

Source exports and caches of the harness accumulate in the project cache until removed by hand, and
every file watcher of the project, such as a development server or a test renderer, has to exclude
the project cache or it slows down or restarts on every export.

Fixture drift hides behind tolerant data helpers. A helper that fills a missing field with a default
lets a changed wire format render a plausible screen, so scenes assert the rendered values and
counts as well as the delivered requests.
