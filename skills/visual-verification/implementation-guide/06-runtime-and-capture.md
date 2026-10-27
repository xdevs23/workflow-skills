# The runtime and the capture

Runtime runs one capture from start to end. Prepares application source, starts serving or build
process that comes with application, starts rendering engine, runs every variant of scene, captures
every checkpoint, checks inputs again, writes receipt and report. One component runs this whole
sequence.

## Preflight

Runtime does not start when variables set by launcher are missing. Error message shown then
contains launcher command. Before anything else, runtime fingerprints application inputs and harness
code.

Capture directory created with private permissions inside harness directory in project cache, at
location defined by `workflow-skills:local-cache`. Creating it fails when directory already exists,
so every capture name is usable only once.

Failure before rendering starts still leaves report. Runtime writes receipt with everything gathered
up to that point, adds failure to it. Failure contains scene name, word preflight, message, and
instruction to repair input shown in message and use new capture name. Runtime then writes report,
prints failed verdict with path of report.

## The source snapshot

Serving process reads application from snapshot. Never reads live working tree. Without source
revision, runtime copies relevant tracked and untracked files of application from working tree into
fresh export directory, so edit made during run cannot change files delivered by serving process.
With source revision, runtime resolves revision to commit locally. Exports files tracked in that
commit into fresh export directory with archive command built into version control system and
standard archive tool. Export never changes working tree, index or any branch. Runner and scene
always come from harness that runs capture. Only application source and its locks come from
selected revision. Receipt records harness version and source revision separately.

Runtime installs dependencies listed in frozen lock of exported source into dependency cache of
launcher, keyed by lock, and links them into export. Lock mismatch fails capture with instruction to
fix lock of selected source deliberately. Component entries of harness copied into export so serving
process can load them. Export directory recorded as path relative to harness directory.

Adaptation point: which files count as application inputs. Reference counted source and public asset
directories, entry document, build configuration, package manifest, lock, and type checker
configurations of application.

## The serving configuration

Build or development configuration of application loaded from export, combined with harness
settings. Production configuration not modified. With harness settings, serving process:

* listens on loopback address only;
* uses strict port where it offers that setting;
* runs without hot reloading and without file watcher;
* uses empty directory as environment directory, so it loads none of environment files in
  repository;
* uses separate cache directory for every run;
* sends only files from export and dependency cache.

Combined configuration replaces data origins with local values handled by data boundary, sets
realtime endpoint to empty, fixes build-time values e.g. version string and build date. Adaptation
point: names of origin, storage and realtime settings and of build-time values in application.

Requested port used as given, must be integer from 1024 to 65535. Run fails at once when another
process already uses that port. Without requested port, runtime asks operating system for free
loopback port. Chosen port printed either way.

Serving process and rendering engine closed on every exit path, failures included.

## Component scenes

Component scene loaded through harness entry. That entry mounts real component with same start-up
as application: same state store, translations, theme initialization, stylesheet and registration
of shipped fonts. Entry must be module inside component directory of harness. Serving configuration
replaces entry document with minimal document that loads that module. Harness checks that this
start-up matches start-up of application. System fonts never replace shipped font faces. Component
drawn inside boxes drawn around it by shell of application, so widths and backgrounds of its
containers are real ones. Where scene asserts model of component, entry shows model value in output
element read by scene, so interactions checked against exact values.

## The rendering context

Every variant runs in fresh rendering context, so storage, caches and state from one variant never
pass into next. Context fixes viewport size, pixel density of one, locale of variant, UTC as
timezone, color scheme of theme set by variant, reduced motion preference. Also blocks service
workers and downloads. Data boundary installed on context before first page exists.

Before first render, clock installed at fixed time and paused at fixed later time. Context fixes
frame interval, the time by which paused clock advances in one frame, so animation or transition
takes same number of frames on every machine. While clock paused, timer-based states never advance
by themselves, e.g. randomized blink, relative time label, polling after first request. Stability
check and steps of scene advance clock frame by frame, and only to named observable transitions.

Before any application code runs, harness seeds synthetic session, together with locale and theme
of variant, into storage from which application reads them. Harness seeds nothing else. Cached data,
feature settings and state from earlier run left out, so every other value comes from start-up of
application and from data boundary. Session contains fixed identity, claims that match stored role,
and token still valid at fixed time of scene. Session does not contain refresh credential. Token
static, unsigned, not secret. Real decoder in application reads claims in it. Harness is not
authentication server. Harness never reads a person's browser profile or persisted login.
Adaptation point: storage keys, claims, role.

Runtime then opens route given by scene for page scene, or component entry for component scene.
When variant sets container width, runtime passes it to entry as parameter. Then passes run context
to scene. Waiting for start-up or reload ends when module graph of real entry has loaded. Wait fails
when module request fails, when page reports error, when serving process exits, or when entry has
not finished evaluating while not a single module request is in flight, since nothing is then left
that could complete graph. Failure recorded as error output by data boundary. Serving process that
is running but does not send a response leaves wait open until user who runs harness stops it.

## The capture sequence

Every checkpoint runs same sequence, with same settings for every capture of every revision.

1. Screen or route has settled, target mounted with expected fixture values. Screen does not show
   spinner, load error or login screen. Waits in scene check this before scene calls capture.
2. Every required shipped font face loaded explicitly and checked. Rendering engine has finished
   loading fonts. Missing face fails capture. Capture drawn with fallback font never accepted.
   Adaptation point: list of shipped font faces.
3. Every visible image decoded, has nonzero natural dimensions.
4. Focus removed from focused element, pointer parked at fixed corner.
5. Geometry of target stable according to stability check. Readiness record from that check saved.
6. Every required response except declared held ones delivered, according to delivery check of
   data boundary.
7. Screenshot taken with animations disabled and text caret hidden, in layout pixels.

Checkpoint of shell captures whole viewport. Every other checkpoint captures its target element.
Capture of targeted checkpoint includes everything meant to appear in it. Capture of group of
options includes every option in full, with every edge visible. Floating content that opens outside
surrounding card, e.g. popover or menu, captured on enclosing host. For every checkpoint, receipt
records name, image, what was captured, readiness record, checks recorded by scene since previous
checkpoint.

Harness never hides real shell. Viewport captures preserve it, targeted captures add detail.
Runtime scrolls actual scrolling container to target, records that position. Full-page screenshot
never claimed to cover panel that scrolls internally unless it actually did. Closed widget closed
through its ordinary initial state. Harness never removes it from document.

Harness never injects styles that fix layout, never masks region under evaluation. Animation that
cannot be captured deterministically = failed readiness requirement, to be resolved. Harness never
hides animation.

## After the scene

When run function of scene returns, data boundary runs count check for end of variant. Failure in
variant recorded with variant name, next checkpoint in scene, message with repository path replaced
by placeholder, and instruction to inspect scene predicate or fixture. Checks not followed by
checkpoint recorded as failure. Record and failures from boundary go into receipt. Then boundary and
context closed.

After every variant, runtime fingerprints application inputs, harness code, import graph of scene
and fixture data again. Any difference recorded as change to source or to fixture during capture,
with instruction to repeat capture on stable tree. Input that became unreadable recorded as not
revalidated. Either case invalidates capture. Evidence written up to then remains in capture
directory.

## The output contract

Successful capture prints verdict and report path, relative to repository root, exits zero. Failed
capture prints failed verdict and report path, then every failure on error stream, exits nonzero.
Each failure message contains scene, variant and checkpoint, failed predicate or response key,
corrective action. Capture started without name prints unique name generated for it. Every capture
prints chosen port. Reports still available after failure.

## Numbers and their reasons

Reference set clock to noon on winter day, paused it one minute later. Date-based labels therefore
stable, timer-based code did not run between start-up and capture. Any fixed instant works. Scene
with date-dependent content declares instant on which it depends.

## Web realization in the reference

Reference ran application on Vite development server. Loaded configuration of project from export,
merged it with harness settings. Merge dropped null override, so watcher switched off after merging.
Chromium ran headless through Playwright, one browser context per variant. Page clock installed and
paused before navigation. Initialization script seeded local storage with session, locale and theme
mode only. Fonts checked with font loading interface of document, images with their decode function.
Page routes in fragment of address. Component entry received container width as query parameter.

## Native and terminal realizations

Native mobile harness builds and installs application from exported source, clears stored
application data before each variant, starts application fresh. Device profile fixes size and
density. Locale and timezone set on emulator or simulator. Dark mode set by variant. System
animations switched off, e.g. through animator duration scales on Android. Where test framework
offers clock, harness controls time through it, e.g. paused composition clock advanced frame by
frame or fake time of widget test. Otherwise harness uses clock injected by test build. Session
written into storage of application before first activity or scene of application starts. Capture:
emulator or simulator screenshot, or image rendered in-process by renderer from toolkit.

Desktop harness starts application on virtual display of fixed size with fixed scale factor.
Captures image of window or widget through grab function of toolkit or through display server.

For every variant, terminal harness starts application in fresh pseudo-terminal of fixed size.
Application runs with UTC, locale of variant, controlled clock e.g. time-faking preload library or
injected clock, and home directory that contains fixture files. Once screen buffer stable, capture
renders terminal screen to image with locked terminal emulator.
