# Implementation guide for a visual harness

## What a harness is for

Harness: tool for answering a specific question about an interface with real rendered interface,
controlled data and repeatable interactions. Each question concrete: whether controls of a list row
fill the row, whether long values fit inside a status banner, or which choices an item editor screen
shows and what they do. Harness does not catalogue application or redesign it.

Harness produces real screenshots of rendering surface, measured assertions and strict comparisons
between two captures. During rendering, harness does not use a backend, credentials or network. Adds
to behavior tests in project, replaces none of them. Simulated document or widget tree does not lay
out boxes or draw fonts, so test on one can only check that style name is present. Harness checks
what a person sees.

Harness used in three ways. First: verification during development. Capture unchanged interface,
make change, capture again, compare. Second: keep scene that once caught a defect, let it catch
that defect again if it comes back. Third: attach evidence sheet, built from capture on base commit
and one on candidate commit, to pull request where project requires it.

## Principles

Application runs through its real start-up. Page scenes start application through real entry
point, real navigation and route protection, real state stores, real styles. Harness does not
double a store, replace a data module, or add route or style only for tests. Data boundary is the
only point where harness substitutes anything.

Fixtures enter at data boundary. Every request for data made by application gets its response from
declared fixture, matched by operation, path, exact query and, for a write, exact body. Unknown
request, unexpected write or exhausted response fails scene. Harness never forwards request to live
service. Blocks every attempt to connect to external system, records it as failure.

Everything that affects pixels locked. Runtime, rendering engine, fonts and dependencies come from
lock files. Run never picks up unlocked engine from machine, never downloads engine automatically,
never installs anything globally, never inherits environment of caller.

Determinism before tolerance. Window size, pixel density, locale, timezone, clock, motion setting
and build values fixed. Two clean runs of same scene give zero changed pixels. Tolerances never
raised to make run pass. Nothing masked.

Comparison: strict automatic verdict, also for change that alters compatibility input on purpose,
e.g. translation, fixture, scene module or dependency lock. User names such change in words given
for unit of work. When comparison rejects pair as incompatible, output of that comparison returned
together with evidence sheet built from same two captures. Reviewers judge outcome by reading
sheet, both receipts and measured checks of after capture.

Harness observes readiness, never sleeps for it. Capture waits for named observations: screen
settled with expected content, every required response delivered, fonts loaded and checked, images
decoded, geometry of target stable across consecutive frames. Readiness never depends on fixed
delay or global idle signal. Interface that polls for data never goes idle.

Pixels and measured semantics both required. Each scene asserts measured facts, e.g. widths,
counts, texts and roles, next to its screenshots. Pixels need interpretation. Style name proves
nothing about layout.

Scenes: typed modules written in same language as application, checked against real data types and
component parameters of application. Harness does not build scene language, component catalogue
tool or plugin platform.

Selectors match exactly intended target. Scenes use existing test hooks of application where
present, scoped accessible roles elsewhere. Missing or ambiguous target fails scene, which never
silently picks first match. Selector never asserts styling class in place of geometry measurement.
Fixtures do not use unchecked type casts.

Every artifact local and private. Captures, reports, comparisons, samples, source exports,
dependency caches and scratch files written to harness directory inside project cache, location
defined by `workflow-skills:local-cache`. Only scene modules, synthetic fixtures and harness code
tracked. Guide calls that location harness directory throughout. One exception: scratch directory
used by runtime and rendering engine. Sits in system temporary directory, one private directory per
run. Launcher removes it when run ends.

## Components are examples

Shape and breadth of guide follow reference harness built for one web application. Each part
describes what a component has to do. Components and libraries used by reference appear only as
examples, beside capability provided by each one. Guide leaves out version numbers. You choose
components that fit project.

Choice depends on three capabilities. Automation component intercepts every data source before
first render, blocks every connection to external system, controls a clock, and captures rendering
surface with animations and text carets disabled. Comparison component decodes images and produces
changed-pixel count and per-pixel change mask with fixed, recorded options. Environment locks
runtime, rendering engine and fonts. Same inputs give same pixels on every machine that runs
harness.

Numeric setting tied to one component, e.g. socket path limit, given as value used by reference,
together with reason for that value. Different component can need another value, derived from same
reason.

## Adaptation points

Reference relied on facts about application for which it was built: framework, development server,
authentication storage, data paths, fonts, shell consumers, routes, locales. Guide gives rule
behind each such fact and marks fact as adaptation point. Integration survey fills in every
adaptation point for adopting project before any harness code exists. Adaptation point marked in
text with words "adaptation point".

## Reading order

Read every file in full, in this order, before writing any harness code.

1. `01-integration-survey.md`
2. `02-launcher.md`
3. `03-command-line-and-scene-registry.md`
4. `04-scene-types.md`
5. `05-data-boundary.md`
6. `06-runtime-and-capture.md`
7. `07-geometry-measurements.md`
8. `08-fixtures-and-drift.md`
9. `09-receipts-and-fingerprints.md`
10. `10-comparison-and-reports.md`
11. `11-diff-coloring.md`
12. `12-evidence-sheet.md`
13. `13-optional-real-samples.md`
14. `14-self-test-suite.md`
15. `15-hygiene-and-production-isolation.md`
16. `16-project-records.md`
17. `17-acceptance-criteria.md`
