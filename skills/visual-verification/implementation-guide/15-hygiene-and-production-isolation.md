# Part 15: hygiene and production isolation

The harness is tooling. It changes no application behavior and no stored data, needs no migration,
and leaves the production build exactly as it was. Its code lives in one tracked directory of its
own; everything it generates lives in the harness directory inside the project cache, the location
`workflow-skills:local-cache` defines.

## One small implementation

The harness is kept small, with separate responsibilities: a thin command line, one component that
runs the serving and engine lifecycle, one data boundary, capture and comparison utilities, typed
scene modules and small synthetic fixtures. The initial scenes share these mechanisms. No plugin
platform, background service, database, component catalogue tool or replacement component system is
introduced.

The harness adds only the dependency families its components need, as project-level development
dependencies under the project's lock. The reference added exactly three: the browser automation
library, a PNG codec and a pixel comparison library, and no schema framework or interface library.
The harness is type checked with the application's own type checker configuration, extended with the
runtime types the harness needs, so fixtures fail to compile when the application's types change.

## Artifacts

Every generated artifact lives in the harness directory: captures with their images, receipts and
reports, comparisons, source exports, the lock-keyed dependency caches, the serving process's
caches, the private home and scratch directories, downloads, samples and selections, local scenes,
engine profiles, optional traces and logs, and the scratch directories of the self-test suite.
Only scene modules, synthetic fixtures and harness code are tracked. Artifacts that carry sample
data or screenshots are written with private permissions.

Capture and comparison leave the version control state and the application files unchanged: no
reference, no index entry, no branch, no working tree file, including translation files and existing
tests that a scene reads. The acceptance criteria of part 17 check this against the starting
revision.

Source exports and serving caches accumulate with every run, one directory each, until someone
removes them by hand. The harness never deletes a capture or a comparison on its own.

## Other file watchers

Every file watcher of the project excludes the project cache. A development server, a test renderer
or a build watcher that watches the repository root otherwise sees every source export as a change.
In the reference, the application's development configuration polled the repository root, and a
server-side rendering test helper that reused that configuration had to exclude the cache from its
watcher; without that exclusion the exports pushed the first server-rendered test past its timeout.
The adoption adds these exclusions to the project's own watcher configurations and changes nothing
else in them.

## Production isolation

Production code never imports a scene, a fixture, a harness entry or a harness library. The
production build contains no test routes, no test-mode branches in application code, no state store
replacements, no styling overrides for captures, no icon substitutions, no hidden content and no
patched product styles. Production routes, start-up, styles and data behavior are unchanged.

The production output is inspected for harness code as part of the verification of the adoption:
the project's full check is run bare, the production build is produced, and its output is searched
for the harness's entries, its scene and fixture modules and its libraries.

## Web realization in the reference

The reference kept its harness in one tool directory with its own environment lock, its component
entries in a subdirectory the serving configuration alone could reach, and its automation and image
libraries as development dependencies. Its build produced one single-file HTML output, and the
verification inspected that file for harness code. Its test renderer's watcher exclusion was the
only change outside the harness directory besides the dependency additions.

## Native and terminal realizations

A native harness keeps its scenes, fixtures and harness entries in a test source set or a separate
test module that the release build does not include, and the harness libraries as test-only
dependencies. The inspection lists the classes or symbols of the release package and searches them
for harness code. A terminal harness keeps its harness scripts outside the installed package and
checks the package's file list the same way.
