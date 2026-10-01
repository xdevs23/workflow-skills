# The visual-verification skill and its implementation guide

A new skill, visual-verification, carries the practice of checking a change to a rendered user
interface with a reproducible visual harness: real rendered screenshots, controlled data,
repeatable interactions, measured checks and strict before and after comparisons. A project
without such a harness builds one from the implementation guide that ships inside the skill.

The guide has the shape and breadth of a reference harness that exists for one web
application. It states every rule of that harness in a form that holds for any rendered
interface, whether it renders in a browser, a native mobile or desktop toolkit, or a terminal,
and shows how the reference realized each rule. It names concrete components and libraries only
as examples and leaves the choice to the model implementing it.

This document is generated from a private spec by the spec tool and is never edited by hand.

## Requirements

**skill-request**: The visual harness approach is integrated into this plugin as a skill.

**guide-request**: The skill points to an implementation guide that an agent must read to implement a harness
correctly, and the guide has the same shape and breadth as the reference harness.

**examples-not-prescriptions**: The guide does not prescribe components or libraries. It names them as examples and lets
the implementing model choose what fits the project.

**proposal-approved**: Apart from its stack choice, the proposed outline is accepted. It consists of: a skill file
with the working practice and a separate implementation guide in the skill directory; the
guide mirroring the reference harness part by part, with facts of the reference application
turned into adaptation points that an integration survey fills in; the skill making the
guide required reading before any harness code;
implement-review-verify left unchanged while the skill explains how visual work is expressed
in a unit spec; the before state captured once from the base commit; the do-not-use words of
the writing-style skill avoided; no names, paths or copy strings of the reference
application.

**page-items**: The approved outline also holds: an adoption spec cites the guide part by part, so its
reviewers check the harness against the guide; adoption is likely split into several
sequential units, the split decided per project when the adoption spec is written; the
expected comparison outcome of a visual criterion is either zero changed pixels or changes
only in named checkpoints with the measured checks passing; the README gets one row; the
plugin ships no harness code.

**random-change-proof**: A project without a past commit pair of a rendering defect and its fix proves the harness
with any deliberate visible change instead: the change is made on a commit that is never
merged, and the harness shows it.

**run-flow**: Visual evidence moves through an implement-review-verify run this way: the before capture
is taken in the run's worktree before implementing; each writer captures after its last
commit under a name never used before and runs the comparison; the comparison report is
returned as evidence, not as a pass or fail check; reviewers that receive the spec open the
images and check that the capture belongs to the commit under review; stages that receive no
spec by design are left alone.

**any-rendered-ui**: The guide covers any rendered user interface, including native mobile, desktop and terminal interfaces, and is not limited to interfaces that render in a browser.

**guide-folder**: The guide is a folder of an index and numbered part files, each at most 450 lines, and the skill makes reading all of them in order required.

**version-rule**: A change to the plugin also raises the plugin's version.

**prose-heading-rule**: Every paragraph of the new documents opens with a full sentence that carries its own subject and reads correctly with every heading removed.

**prose-announcement-rule**: The new documents contain no sentence whose only content is that more text follows.

**banned-words-rule**: The new documents follow the do-not-use list of the writing-style skill.

**components-by-name-rule**: A document names components by their names and carries no file paths and no file trees.

**decomposable-rule**: A large deliverable is written as several files, one per write, each under a stated size.

**cache-naming-rule**: In a skill file, a path inside the project cache appears only inside a command, and the
block that holds it or the one after it names the location as the one the local-cache skill
defines; prose names the location by that skill. A skill file also never contains the
phrases project cache dir, global temp or Scratch files go in.

**todo-naming-rule**: No skill file other than the todo-md skill names the todo file by its file name.

**style-opener-rule**: The workflow skills of the plugin open, right after their title, with the paragraph that
requires loading the writing-style skill first and says it is not optional when working
with this plugin.

**reference-harness**: A frozen copy of the reference material exists in the project cache, fingerprinted file by
file: the reference harness's modules (launcher, command line with scene registry, scene
types, network fixture boundary, runtime, geometry measurements, shared fixtures and drift
checks, fingerprinting, comparison and reports, diff coloring, evidence sheet, optional
samples, self-test suite, component scene entries and scene modules), its contract document
with its rules, scenes, rejected alternatives and acceptance criteria, the generalized guide
to the harness that the request linked, and the pull request handoff document that states
the evidence sheet rule. Every file matches its recorded fingerprint.

**no-visual-skill-yet**: The plugin has no skill about visual verification today.

**current-version**: The plugin's version is 0.20.0.

**minor-raise-history**: Adding skills to the plugin has raised its minor version.

**relative-path-precedent**: The implement-review-verify skill refers to files it ships by their paths relative to the skill.

**reference-authority**: The frozen reference copy is the reference for every comparison in this unit, since the live reference keeps changing.

**file-layout**: The skill lives in a new visual-verification skill directory. Its skill file carries the
working practice and is at most 450 lines. The implementation guide lives in a folder of its
own inside the skill directory, as numbered Markdown files, each at most 450 lines, plus an
index file that names every guide file in reading order with one sentence on what each
covers. The single-file guide of the first outline is replaced by this folder.

**platform-neutral-rules**: Each part of the guide states its rules in terms that hold for any rendered interface: the
data boundary where the application receives data, the controlled clock, the loaded and
verified fonts and assets, the rendering surface that is captured, the escapes to external
systems that are blocked. For each part the guide then shows how the reference web harness
realized the rule, and names how a native mobile, desktop or terminal interface can realize
the same rule, such as a device emulator's screenshot, an in-process test renderer of a UI
toolkit, or a terminal emulator that renders to an image. Browser-specific mechanisms of the
reference, such as service workers, WebSockets and a browser page clock, appear as the web
realization of a general rule, never as the rule itself.

**guide-mirrors-harness**: The guide covers, in this order, each of the following parts with the rules the reference
harness states or enforces for it, written as platform-neutral-rules describes:
* the integration survey: before any code, the adopting project fills a table of its
  integration points (application start-up, authentication and route protection, the data
  boundary, the shell's own consumers of data, the build), each row with its source evidence
  and the design consequence;
* the launcher: one command from the repository root; a refusal outside the root; a locked
  runtime, rendering engine and fonts; a cleared environment with only an allowlisted set of
  variables; private file permissions; a private scratch directory whose path length is
  checked against any limit the rendering engine imposes; a bootstrap that imports no
  packages; frozen dependency installation into a cache keyed by the lock content, refused
  when the lock would change; refresh credentials passed only to the refresh command;
* the command line and scene registry: the verbs list, scene, compare, sheet, test and
  refresh; the options each verb accepts, everything else refused; a standard argument
  parser; untracked local scenes run only from the project cache; a scene fingerprint over
  the scene's local import graph, read with the language's own import resolution;
* scene types: variants (viewport or window size, locale, theme, optional container width);
  response fixtures (key, method or operation, path, exact query, body, a once, repeat or
  held policy, an exact count, a declared failing status); a fixture set with provenance;
  measurements with a diagnostic flag, where required checks decide the verdict and
  diagnostic ones record product findings; the scene run context with check and capture; a
  scene as a page or component union; one shared variant set; target selection through the
  application's existing test hooks and scoped accessible roles, where a missing or
  ambiguous target fails and no selector asserts a styling class in place of geometry;
* the data boundary: interception of every data source before the first screen renders;
  exact matching by operation, path, normalized query and body; failures for undeclared,
  mismatched and exhausted responses; blocking of every escape to external systems, recorded
  as a failure even when the application swallows it; error output of the application
  failing the run; a declared failing status excusing only its own path; checks that every
  required read was delivered and every count met; a scripted stored state that later reads
  return after a write;
* the runtime and capture: a source snapshot from the working tree, or exported from a
  commit without touching the working tree, index or branches; the application's own build
  or development configuration composed with local-only binding, a strict port where there
  is one, no reloading, no file watcher and an empty environment; a fresh rendering context
  per variant; a fixed timezone, locale, pixel density, reduced motion and color scheme; a
  clock installed and paused before the first render; a synthetic session seeded before
  application code runs; component scenes mounted through a harness entry with the same start-up, styles,
  translations, theme and shipped fonts as the application; the real shell kept visible and
  the real scrolling container scrolled to the target; the capture sequence of loaded and
  checked fonts, decoded images, cleared focus, a parked pointer, stable geometry, delivered
  reads and then the capture; a report written even for failures before rendering starts;
  inputs fingerprinted again after the run; the command's output contract: the report path
  and verdict on success, and on failure a nonzero exit naming the scene, checkpoint,
  failed predicate or response key and the corrective action, a generated unique capture
  name when none is given, and the chosen port printed;
* geometry measurements: content boxes from the layout engine's computed padding and
  borders, text line boxes, hit tests proving nothing covers a control, one-line text,
  sticky headers, and a stability check that advances the paused clock frame by frame until
  repeated readings agree within half a layout unit;
* fixtures and drift: one shared helper for the shell's responses; fixtures typed against
  the application's own data types without unchecked casts except a declared one; runtime
  assertions on parsed data; drift checks on keys, operation, policy, count, status, path,
  query and body; consistency of referenced identifiers;
* receipts and fingerprints: every field a capture records, including dirty and untracked
  inputs, and no authentication state, absolute paths or private payloads;
* comparison and reports: a strict compatibility check; checkpoints matched by name; a
  dimension mismatch failing; a permitted changed-pixel count of zero that is never raised;
  fixed, recorded comparison options; a nonzero exit for any difference; self-contained escaped HTML reports with no external resources; no automatic
  baseline approval;
* diff coloring: the local contrast algorithm with its luma coefficients written out as
  numbers, its window and margin parameters, its colors, its legend, its known limits and
  its acceptance rules, defined against the per-pixel change mask and changed count that the
  comparison component produces;
* the evidence sheet: its layout, the grouping into changed, new, identical and before-only
  checkpoints, an output file that is never overwritten, a size limit, refusal of captures of
  different scenes and of receipts without a source revision, and no verdict;
* optional real samples: an explicit refresh only; an exact read allowlist; an encrypted
  origin; credentials from the environment only; no redirects; projection through field
  allowlists; incomplete publications that cannot be selected; no overwrite; mixed
  provenance; no raw service errors in logs;
* the self-test suite: every category of test the reference suite has, run only through the
  launcher and kept out of ordinary test discovery;
* hygiene and production isolation: every artifact inside the project cache; other file
  watchers excluding it; production never importing scenes, fixtures or harness libraries,
  with the production output inspected for that;
* the project's own records: an entry in the project's instructions that names the harness
  and requires it for changes to rendered output, and the project's harness contract with
  its scene documentation, one entry per scene with its question, fixture, checkpoints and
  checks;
* the acceptance criteria of the reference harness, generalized;
* the rejected alternatives of the reference harness with their reasons.

**regression-proof**: The guide's generalized acceptance criteria include the historical regression proof: the
same scene fails its measured check on a past commit that had a rendering defect and passes
on the commit that fixed it, with a nonzero pixel difference between them; the two commits
share the same application dependency locks, because the comparison refuses captures whose
locks differ. Where the adopting project has no such commit pair, it makes any deliberate
visible change on a commit that is never merged and shows that the harness reports it.

**adaptation-points**: Wherever the reference harness relies on a fact of its own application or platform (its
framework, development server, authentication storage, data paths, fonts, shell consumers,
routes or locales), the guide states the rule and marks the fact as an adaptation point
that the integration survey fills in for the adopting project.

**stack-as-examples**: The guide states what each component has to do. The automation component intercepts every
data source before the first render, blocks escapes, controls a clock, and captures the
rendering surface with animations and carets disabled. The comparison component produces a
changed-pixel count and a per-pixel change mask with fixed, recorded options. The
environment locks the runtime, rendering engine and fonts. The guide names the components
the reference harness used only as examples beside the capability each provided, gives no
version numbers, and tells the implementing model to choose components that fit the
project and to verify their current versions when adding them. A numeric setting tied to
one component, such as a socket path limit or a comparison threshold, is given as the
reference's value with the reason it has that value.

**skill-practice**: The skill file opens, right after its title, with the same writing-style paragraph as the
workflow skills, and covers:
* when it applies: a change to rendered output of any user interface in a project that has
  a harness, and a request to adopt one; a harness named in the project's instructions is
  the one used;
* that a project without a harness adopts one as its own unit of work, and that the agent
  reads every file of the implementation guide in full, in index order, before writing any
  harness code; the runs of each adoption unit receive the guide parts it implements among
  their rule sources, each by its file under the plugin root, and the adoption is likely
  split into several sequential units;
* verifying a change: pick a scene that exposes the change, or curate one first as a
  separate small step; capture the unchanged interface, from the base commit where the
  harness supports it; implement only the approved change; capture again with the same scene,
  data and settings; compare; open the PNGs and the measurements, since a passing process is
  not an inspection; a change that must not alter the look shows zero changed pixels on every
  checkpoint; product findings are reported apart from harness failures;
* curating a scene: read the real surface and every consumer of data, including the shell;
  define the question, the complete fixture, the interactions, the checks and the
  checkpoints; run it until it passes for the right reasons and look at every PNG; add its
  entry (question, fixture, checkpoints, checks) to the project's scene documentation; keep
  exploratory scenes in the project cache until they are deliberately promoted; keep a scene
  that caught a regression;
* evidence sheets for pull requests, where the project requires them: built from a capture
  on the base commit and one on the candidate before the pull request is created, and for a
  surface that does not exist on the base, the way the sheet shows it decided while the scene
  is curated;
* the known pitfalls: scratch path length, slow shared file systems, capture names that
  cannot be reused, output never filtered through other commands, clock-driven interface
  states, accumulating source exports and file watchers, and fixture drift.

**unit-spec-integration**: The skill file tells the orchestrating session how visual work runs in an
implement-review-verify unit, with nothing specific to visual work in implement-review-verify:
* what a visual change should do comes from the user's words in the unit spec, and nothing is
  written into the spec for it: no criterion, no capture name and no path; the comparison
  outcome is zero changed pixels, changes only in the checkpoints the user's words concern with
  the measured checks passing, or the intended change of a compatibility input;
* the implementer captures the before state in its worktree from its start commit, before its
  first edit; no other stage captures the before state;
* each writing stage, after its last commit, captures under a name never used before in that
  worktree, such as its stage label with the run identifier, runs the comparison against the
  before capture, and returns the comparison with both capture names in its checks; the stage's
  pass or fail proof stays the project's check command, since the comparison exits nonzero for
  every intended change;
* the implementer returns its captures, comparison reports and evidence sheets in `artifacts`, each
  by its absolute path, and every reading stage that receives the spec and the fixer get them, in
  the implementer's object or in a block of their own; a fix run's fixer reaches them through a
  pointer its fix list entry attaches to the parent run's implementer result;
* reading stages that receive the spec open the PNGs, receipts and comparison reports in that
  worktree's project cache and check that each receipt's source revision is the commit it
  claims; stages that receive no spec by design get nothing added; a point that needs a new
  capture goes to the fixer;
* the scratch directory of the runtime and the rendering engine lives in the system temporary
  directory, one private directory per run, and the launcher removes it when the run ends.

**cache-naming**: The skill file and the guide name the harness's artifact location as a directory inside
the project cache that the local-cache skill defines, and follow cache-naming-rule and
todo-naming-rule.

**neutral-examples**: Neither the skill file nor the guide names the reference application, its organization,
routes, entities, copy strings, scene names or commit identifiers. Examples use a neutral
application, such as an item editor screen and a status banner component. The skill file
refers to its own guide files by their paths relative to the skill, and the index names its
sibling guide files by file name; no new file carries an absolute path or a file tree.

**readme-row**: The README's skill table gets one row for visual-verification.

**version-raise**: The plugin manifest's version rises from 0.20.0 to 0.21.0.

## Boundaries

**scope-files**: The unit adds the skill directory with its skill file and guide files, the README row, the
version raise in the plugin manifest and the generated design document. It changes no agent
template, no other skill, no workflow script, no test, no tool and no other manifest field.

**no-harness-code**: The plugin ships no harness code. Each project implements its own harness from the guide.

**tooling-parity-exempt**: The reference contract's choice of a specific environment tool, rendering engine, runtime,
libraries and their versions is exempt from literal parity. The guide keeps the property
each choice secured (locked, reproducible, local, offline) as the rule.

## Rejected alternatives

**prescribed-stack**: The guide prescribes the reference harness's runtime, rendering engine, automation and image libraries.
Reason: The components and libraries are examples, and the implementing model chooses what fits the project.

**browser-only**: The guide is limited to interfaces that render in a browser.
Reason: The guide covers any rendered user interface.

**single-guide-file**: The guide is one file.
Reason: The guide is a folder of numbered files with an index.

## Acceptance criteria

1. **c-skill-file**: The visual-verification skill directory holds a skill file of at most 450 lines whose
   front matter carries the name visual-verification and a description saying it applies to
   changes to the rendered output of any user interface and to adopting a harness. The skill
   file contains every point of skill-practice.
2. **c-guide-required**: The skill file states that a project without a harness adopts one as its own unit, that the
   agent reads every file of the implementation guide in full, in index order, before writing
   any harness code, and it names the guide's index file.
3. **c-guide-files**: The guide folder holds an index file and numbered guide files, each at most 450 lines. The
   index names every guide file in reading order with one sentence each, and every guide file
   is named in it.
4. **c-guide-parts**: Each part listed in guide-mirrors-harness is covered by the guide, in that order, with every rule the item names for it.
5. **c-guide-breadth**: An item by item comparison of the frozen reference contract, modules, linked guide and
   handoff document against the new files finds no rule missing and none shortened into a
   summary; a rule of the working practice may sit in the skill file instead of the guide. Facts that belong only to the
   reference application appear as adaptation points where a rule depends on them, and the
   reference's tooling choices appear as tooling-parity-exempt describes.
6. **c-platform-neutral**: Every part of the guide states its rules in the platform-neutral terms of
   platform-neutral-rules, shows the web realization of the reference, and names at least one
   realization for a native or terminal interface wherever the rule depends on the platform.
7. **c-regression-proof**: The guide's acceptance criteria contain the regression proof of regression-proof, including the shared locks of the pair and the deliberate change for a project without a suitable pair.
8. **c-examples**: Every component or library the guide names appears as an example beside the capability it
   provides, the capabilities of stack-as-examples are stated, the guide contains no version
   numbers of components, and it tells the implementing model to choose components that fit the
   project and to verify current versions when adding them.
9. **c-unit-spec**: The skill file contains every point of unit-spec-integration.
10. **c-neutral**: No new file contains a name, route, entity, copy string, scene name or commit identifier of
    the reference application, an absolute path, or a file tree, and the skill file and every
    guide file name the artifact location as cache-naming describes.
11. **c-prose**: Every paragraph of the new files reads correctly with its heading removed, no sentence only
    announces what follows, and no word of the writing-style skill's do-not-use list appears
    without a justification the context makes evident.
12. **c-readme-version**: The README's skill table has one row for visual-verification that states what the skill does, and the plugin manifest's version is 0.21.0.
13. **c-scope**: The branch diff touches only the files scope-files names, and the existing test suite passes unchanged.
