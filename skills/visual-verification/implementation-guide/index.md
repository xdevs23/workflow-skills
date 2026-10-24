# Implementation guide for a visual harness

## What a harness is for

A harness is a tool for answering a specific question about an interface with the real rendered
interface, controlled data and repeatable interactions. Each question is concrete: whether the
controls of a list row fill the row, whether long values fit inside a status banner, or which
choices an item editor screen shows and what they do. The harness does not catalogue the application
or redesign it.

The harness produces real screenshots of the rendering surface, measured assertions and strict
comparisons between two captures. During rendering, the harness does not use a backend, credentials
or the network. It adds to the behavior tests in the project and replaces none of them. A simulated
document or widget tree does not lay out boxes or draw fonts, so a test on one can only check that a
style name is present. The harness checks what a person sees.

A harness is used in three ways. The first is verification during development: capture the unchanged
interface, make the change, capture again and compare. The second is to keep a scene that once
caught a defect and let it catch that defect again if it comes back. The third is to attach an
evidence sheet, built from a capture on the base commit and one on the candidate commit, to a pull
request where the project requires it.

## Principles

The application runs through its real start-up. Page scenes start the application through its real
entry point, real navigation and route protection, real state stores and real styles. The harness
does not double a store, replace a data module, or add a route or a style only for tests. The data
boundary is the only point where the harness substitutes anything.

Fixtures enter at the data boundary. Every request for data made by the application gets its
response from a declared fixture, matched by operation, path, exact query and, for a write, exact
body. An unknown request, an unexpected write or an exhausted response fails the scene. The harness
never forwards a request to a live service. It blocks every attempt to connect to an external system
and records it as a failure.

Everything that affects pixels is locked. The runtime, the rendering engine, the fonts and the
dependencies come from lock files. A run never picks up an unlocked engine from the machine, never
downloads an engine automatically, never installs anything globally and never inherits the
environment of the caller.

Determinism comes before tolerance. The window size, pixel density, locale, timezone, clock, motion
setting and build values are fixed. Two clean runs of the same scene give zero changed pixels.
Tolerances are never raised to make a run pass. Nothing is masked.

The comparison is the strict automatic verdict, also for a change that alters a compatibility input
on purpose, such as a translation, a fixture, the scene module or a dependency lock. The user names
such a change in the words given for the unit of work. When the comparison rejects the pair as
incompatible, the output of that comparison is returned together with an evidence sheet built from
the same two captures. The reviewers judge the outcome by reading the sheet, the two receipts and
the measured checks of the after capture.

The harness observes readiness and never sleeps for it. A capture waits for named observations: the
screen settled with the expected content, every required response delivered, fonts loaded and
checked, images decoded and the geometry of the target stable across consecutive frames. Readiness
never depends on a fixed delay or a global idle signal. An interface that polls for data never goes
idle.

Pixels and measured semantics are both required. Each scene asserts measured facts, such as widths,
counts, texts and roles, next to its screenshots. Pixels need interpretation. A style name proves
nothing about layout.

Scenes are typed modules written in the same language as the application, checked against the real
data types and component parameters of the application. The harness does not build a scene
language, a component catalogue tool or a plugin platform.

Selectors match exactly the intended target. Scenes use the existing test hooks of the application
where present and scoped accessible roles elsewhere. A missing or ambiguous target fails the scene,
which never silently picks the first match. A selector never asserts a styling class in place of a
geometry measurement. Fixtures do not use unchecked type casts.

Every artifact is local and private. Captures, reports, comparisons, samples, source exports,
dependency caches and scratch files are written to the harness directory inside the project cache,
the location defined by `workflow-skills:local-cache`. Only scene modules, synthetic fixtures and
the harness code are tracked. The guide calls that location the harness directory throughout. The
one exception is the scratch directory used by the runtime and the rendering engine. It is in the
system temporary directory, one private directory for each run, and the launcher removes it when the
run ends.

## Components are examples

The shape and breadth of the guide follow a reference harness built for one web application. Each
part describes what a component has to do. The components and libraries used by the reference
appear only as examples, beside the capability each one provided. The guide leaves out version
numbers. You choose the components that fit the project, and you verify their current versions when
you add them.

The choice depends on three capabilities. The automation component intercepts every data source
before the first render, blocks every connection to an external system, controls a clock, and
captures the rendering surface with animations and text carets disabled. The comparison component
decodes images and produces a changed-pixel count and a per-pixel change mask with fixed, recorded
options. The environment locks the runtime, the rendering engine and the fonts. The same inputs give
the same pixels on every machine that runs the harness.

A numeric setting tied to one component, such as a socket path limit, is given as the value used
by the reference, together with the reason for that value. A different component can need another
value, derived from the same reason.

## Adaptation points

The reference relied on facts about the application it was built for: the framework, the
development server, the authentication storage, the data paths, the fonts, the shell consumers, the
routes and the locales. The guide gives the rule behind each such fact and marks the fact as an
adaptation point. The integration survey fills in every adaptation point for the adopting
project before any harness code exists. An adaptation point is marked in the text with the words
"adaptation point".

## Reading order

Read every file in full, in this order, before writing any harness code.

1. `01-integration-survey.md` covers the table of integration points filled in by the adopting
   project before any code is written, with source evidence and a design consequence for each row.
2. `02-launcher.md` covers the one command that starts the harness, the locked runtime, engine and
   fonts, the cleared environment, the scratch directory and frozen dependency installation.
3. `03-command-line-and-scene-registry.md` covers the verbs, the options accepted by each verb, the
   scene registry, untracked local scenes and the scene fingerprint computed over the import graph
   of the scene.
4. `04-scene-types.md` covers variants, response fixtures, fixture sets, measurements, the scene
   run context, the page and component scene kinds, the shared variant set and target selection.
5. `05-data-boundary.md` covers interception of every data source, exact matching, the failures
   for undeclared, mismatched and exhausted responses, blocked connections to external systems,
   error output and stored state after a write.
6. `06-runtime-and-capture.md` covers source snapshots, the serving or build configuration, the
   fresh rendering context, fixed settings, the paused clock, the synthetic session, component
   scenes, the capture sequence and the output contract of the command.
7. `07-geometry-measurements.md` covers content boxes, text line boxes, hit tests, one-line text,
   sticky headers and the frame-by-frame stability check.
8. `08-fixtures-and-drift.md` covers the shared shell responses, typed fixtures, runtime assertions
   on parsed data, drift checks and consistency of referenced identifiers.
9. `09-receipts-and-fingerprints.md` covers every field recorded by a capture, the fingerprints
   before and after a run and what a receipt never contains.
10. `10-comparison-and-reports.md` covers the compatibility check, the review of an input changed
    on purpose through the evidence sheet, the receipts and the measured checks, checkpoint
    matching, the zero changed-pixel rule, fixed comparison options and self-contained reports.
11. `11-diff-coloring.md` covers the local contrast recoloring of the change mask with its numbers,
    colors, legend, known limits and acceptance rules.
12. `12-evidence-sheet.md` covers the layout, grouping, output and refusal rules of the evidence
    sheet for a pull request, and the sheet read in the review of an input changed on purpose.
13. `13-optional-real-samples.md` covers the explicit, allowlisted and projected refresh of real
    data samples and their privacy rules.
14. `14-self-test-suite.md` covers every category of test in the self-test suite of the harness and
    how the suite is kept out of ordinary test discovery.
15. `15-hygiene-and-production-isolation.md` covers where artifacts are stored, file watchers, and
    how harness code is kept out of production output.
16. `16-project-records.md` covers the entry in the project instructions and the harness contract
    of the project with the scene documentation in it.
17. `17-acceptance-criteria.md` covers the generalized acceptance criteria of a harness, including
    the regression proof.
