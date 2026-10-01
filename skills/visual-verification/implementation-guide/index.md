# Implementation guide for a visual harness

This guide describes how to build a reproducible visual harness for a project's rendered user
interface. It has the shape and breadth of a reference harness that was built for one web
application, and states every rule of that harness in a form that holds for any rendered interface,
whether it renders in a browser, a native mobile or desktop toolkit, or a terminal. Every part shows
how the reference realized its rules on the web and names how a native or terminal interface can
realize the same rules.

## What a harness is for

A harness answers a specific question about an interface with the real rendered interface,
controlled data and repeatable interactions. A question is concrete, such as whether the controls of
a list row fill the row, whether long values fit inside a status banner, or which choices an item
editor screen shows and what they do. The harness is no catalogue of the application and no redesign
tool.

The harness produces real screenshots of the rendering surface, measured assertions and strict
comparisons between two captures, with no backend, no credentials and no network during rendering.
It adds to the project's behavior tests and replaces none of them. A simulated document or widget
tree does not lay out boxes or draw fonts, so a test on one can only check that a style name is
present; the harness checks what a person sees.

A harness has three uses. The first is verification during development: capture the unchanged
interface, make the change, capture again and compare. The second is regression evidence: a scene
that once caught a defect stays and keeps catching it. The third is pull request evidence: an
evidence sheet built from a capture on the base commit and one on the candidate commit is attached
to a pull request where the project requires it.

## Principles

The application runs through its real start-up. Page scenes start the application through its real
entry point, real navigation and route protection, real state stores and real styles. No store
doubles, replaced data modules, test-only routes or test-only styles exist, and the data boundary is
the only point where the harness substitutes anything.

The data boundary is where fixtures enter. Every request the application makes for data is answered
from a declared fixture matched by operation, path, exact query and, for writes, exact body. An
unknown request, an unexpected write or an exhausted response fails the scene. Nothing is ever
forwarded to a live service, and every attempt to reach an external system is blocked and recorded
as a failure.

Everything that affects pixels is locked. The runtime, the rendering engine, the fonts and the
dependencies come from lock files. No ambient engine, no automatic engine download, no global
installation and no inherited environment reach a run.

Determinism comes before tolerance. The window size, pixel density, locale, timezone, clock, motion
setting and build values are fixed, and two clean runs of the same scene give zero changed pixels.
Tolerances are never raised to make a run pass, and nothing is masked.

The comparison stays the strict automatic verdict, even for a change that alters a compatibility
input on purpose, such as a translation, a fixture, the scene module or a dependency lock. The
user's words for the unit of work name such a change. When the comparison refuses its pair, the refusal is returned
together with an evidence sheet of the same two captures, and the reviewers judge the outcome by
reading the sheet, the two receipts and the after capture's measured checks.

Readiness is observed and never slept. A capture waits for named observations: the screen settled
with the expected content, every required response delivered, fonts loaded and checked, images
decoded and the target's geometry stable across consecutive frames. No fixed delay and no global
idle signal decide readiness, since an interface with polling reads never goes idle.

Pixels and measured semantics are both required. Each scene asserts measured facts, such as widths,
counts, texts and roles, next to its screenshots. Pixels need interpretation, and a style name
proves nothing about layout.

Scenes are typed modules in the application's own language, checked against the application's real
data types and component parameters. No scene language, no component catalogue tool and no plugin
platform is built.

Selectors are honest. Scenes use the application's existing test hooks where present and scoped
accessible roles elsewhere. A missing or ambiguous target fails; the scene never silently picks the
first match. No selector asserts a styling class in place of a geometry measurement, and fixtures
carry no unchecked type casts.

Every artifact stays local and private. Captures, reports, comparisons, samples, source exports,
dependency caches and scratch files live in the harness directory inside the project cache, the
location `workflow-skills:local-cache` defines, and only scene modules, synthetic fixtures and the
harness code are tracked. The guide calls that location the harness directory throughout. The one
exception is the scratch directory of the runtime and the rendering engine: it lives in the system
temporary directory, one private directory for each run, and the launcher removes it when the run
ends.

## Components are examples

Each part states what a component has to do. The components and libraries the reference used are
named only as examples beside the capability each provided, and no version numbers are given. The
implementing model chooses the components that fit the project and verifies their current versions
when adding them.

Three capabilities decide the choice. The automation component intercepts every data source before
the first render, blocks escapes to external systems, controls a clock, and captures the rendering
surface with animations and text carets disabled. The comparison component decodes images and
produces a changed-pixel count and a per-pixel change mask with fixed, recorded options. The
environment locks the runtime, the rendering engine and the fonts so the same inputs give the same
pixels on every machine that runs the harness.

A numeric setting tied to one component, such as a socket path limit or a comparison threshold, is
given as the reference's value together with the reason it has that value. A different component
has its own value, derived from the same reason.

## Adaptation points

The reference relied on facts of its own application: its framework, development server,
authentication storage, data paths, fonts, shell consumers, routes and locales. The guide states the
rule behind each such fact and marks the fact as an adaptation point. The integration survey of the
first part fills in every adaptation point for the adopting project before any harness code exists.
An adaptation point is marked in the text with the words "adaptation point".

## Reading order

Every file is read in full, in this order, before any harness code is written.

1. `01-integration-survey.md` covers the table of integration points the adopting project fills in
   before any code, with source evidence and a design consequence for each row.
2. `02-launcher.md` covers the one command that starts the harness, the locked runtime, engine and
   fonts, the cleared environment, the scratch directory and frozen dependency installation.
3. `03-command-line-and-scene-registry.md` covers the verbs, the options each verb accepts, the
   scene registry, untracked local scenes and the scene fingerprint over its import graph.
4. `04-scene-types.md` covers variants, response fixtures, fixture sets, measurements, the scene
   run context, the page and component scene kinds, the shared variant set and target selection.
5. `05-data-boundary.md` covers interception of every data source, exact matching, the failures
   for undeclared, mismatched and exhausted responses, blocked escapes, error output and stored
   state after a write.
6. `06-runtime-and-capture.md` covers source snapshots, the serving or build configuration, the
   fresh rendering context, fixed settings, the paused clock, the synthetic session, component
   scenes, the capture sequence and the command's output contract.
7. `07-geometry-measurements.md` covers content boxes, text line boxes, hit tests, one-line text,
   sticky headers and the frame-by-frame stability check.
8. `08-fixtures-and-drift.md` covers the shared shell responses, typed fixtures, runtime assertions
   on parsed data, drift checks and consistency of referenced identifiers.
9. `09-receipts-and-fingerprints.md` covers every field a capture records, the fingerprints before
   and after a run and what a receipt never contains.
10. `10-comparison-and-reports.md` covers the compatibility check, the review of an input changed
    on purpose through its evidence sheet, receipts and measured checks, checkpoint matching, the
    zero changed-pixel rule, fixed comparison options and self-contained reports.
11. `11-diff-coloring.md` covers the local contrast recoloring of the change mask with its numbers,
    colors, legend, known limits and acceptance rules.
12. `12-evidence-sheet.md` covers the layout, grouping, output and refusal rules of the evidence
    sheet for a pull request, and the sheet that the review of an input changed on purpose reads.
13. `13-optional-real-samples.md` covers the explicit, allowlisted and projected refresh of real
    data samples and their privacy rules.
14. `14-self-test-suite.md` covers every category of test the harness's own suite has and how the
    suite stays out of ordinary test discovery.
15. `15-hygiene-and-production-isolation.md` covers where artifacts live, file watchers, and how
    production output stays free of harness code.
16. `16-project-records.md` covers the entry in the project's instructions and the project's own
    harness contract with its scene documentation.
17. `17-acceptance-criteria.md` covers the generalized acceptance criteria of a harness, including
    the regression proof.
18. `18-rejected-alternatives.md` covers the alternatives the reference rejected and the reason for
    each.
