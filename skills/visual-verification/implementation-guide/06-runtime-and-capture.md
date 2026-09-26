# Part 6: the runtime and the capture

The runtime owns the lifecycle of one capture: it prepares the application source, starts the
application's own serving or build process, starts the rendering engine, runs every variant of the
scene, captures every checkpoint, checks the inputs again, and writes the receipt and the report.
One component owns this lifecycle, and the other parts supply it with mechanisms.

## Preflight

The runtime refuses to start when the variables the launcher sets are missing, and names the
launcher command. It fingerprints the application's inputs and the harness's own code before
anything else, as part 9 describes.

The capture directory is created inside the harness directory in the project cache, the location
`workflow-skills:local-cache` defines, with private permissions. Its creation fails when the
directory exists, which is what makes a capture name exclusive.

A failure before rendering starts still leaves a report. The runtime writes a receipt with whatever
it had gathered, adds the failure with the scene name, the word preflight, the message and the
instruction to repair the named input and use a new capture name, writes the report, and prints the
failed verdict with the report path.

## The source snapshot

The application is served from a snapshot, never from the live working tree. Without a source
revision, the runtime copies the application's relevant tracked and untracked files from the working
tree into a fresh export directory, so an edit made during the run cannot change what is served.
With a source revision, the runtime resolves the revision to a commit locally and exports that
commit's tracked files into a fresh export directory with the version control system's own archive
facility and a standard archive tool. The export never changes the working tree, the index or any
branch. The runner and the scene stay the current harness version; only the application source and
its locks come from the selected revision, and the receipt records both independently.

The runtime installs the exported source's dependencies from its own frozen lock into the lock-keyed
dependency cache of part 2 and links them into the export. A lock mismatch fails the capture with a
message asking for the selected source's lock to be fixed deliberately. The harness's component
entries are copied into the export so the serving process can reach them. The export's path is
recorded relative to the harness directory.

Adaptation point: which files count as application inputs. The reference counted its source and
public asset directories, the entry document, the build configuration, the package manifest, the
lock and its type checker configurations.

## The serving configuration

The application's own build or development configuration is loaded from the export and composed
with harness settings, without modifying the production configuration. The harness settings bind
the server to the loopback address only, use a strict port where the server has one, switch off hot
reloading and the file watcher, point the environment directory at an empty directory so no
environment file of the repository loads, give the serving process a cache directory of its own per
run, and restrict the files it serves to the export and the dependency cache.

The composed configuration replaces the data origins with local values the data boundary of part 5
answers, sets the realtime endpoint to empty, and fixes build-time values such as the version string
and the build date. Adaptation point: the names of the application's origin, storage and realtime
settings and of its build-time values.

A requested port is used as given, must be an integer from 1024 to 65535, and fails at once when
another process holds it. Without a requested port, the runtime asks the operating system for a free
loopback port. The chosen port is printed either way.

The serving process and the rendering engine are closed on every exit path, including failures.

## Component scenes

A component scene is served through a harness entry that mounts the real component with the same
start-up as the application: the same state store, translations, theme initialization, stylesheet
and shipped font registration. The entry lives in the harness's component directory and must be a
module there; the serving configuration replaces the entry document with a minimal document that
loads it. Bootstrap parity is checked; system fonts never substitute for the shipped faces. The
component is drawn inside the boxes the application's shell draws around it, so its container widths
and backgrounds are the real ones. Where a scene asserts the component's model, the entry shows the
model value in an output element the scene reads, so interactions are checked against exact values.

## The rendering context

Every variant runs in a fresh rendering context, so no storage, cache or state carries from one
variant into the next. The context fixes the viewport size, a pixel density of one, the variant's
locale, the timezone as UTC, the color scheme of the variant's theme and the reduced motion
preference, blocks service workers and refuses downloads. The data boundary is installed on the
context before the first page exists.

A clock is installed at a fixed time and paused at a fixed later time before the first render. The
paused clock means timer-based states never advance on their own, such as a randomized blink, a
relative time label or a poll after its first read; the stability check of part 7 and the scene's
own steps advance it frame by frame, and only to named observable transitions.

A synthetic session is seeded before any application code runs, together with the variant's locale
and theme in the storage the application reads them from. The session carries a fixed identity,
claims that agree with the stored role, a token that does not expire at the scene's fixed time and
no refresh credential. The token is static, unsigned and not secret, and the application's real
decoder reads its claims; the harness is no authentication server. The harness never reads a
person's browser profile or a persisted login. Adaptation point: the storage keys, the claims and
the role.

The runtime then opens the scene's route for a page scene or the component entry for a component
scene, with the container width as an entry parameter when the variant carries one, and hands the
run context of part 4 to the scene. Start-up and reload waits allow up to sixty seconds for the real
entry's module graph to load; that bound is a timeout, never a delay.

## The capture sequence

Every checkpoint runs the same sequence, with the same settings for every capture of every revision.

1. The screen or route is settled, and the target is mounted with the expected fixture values: no
   spinner, load error or login screen. The scene's own waits establish this before it calls
   capture.
2. Every required shipped font face is loaded explicitly and checked, and the engine's font loading
   has finished. A missing face fails the capture; a fallback font is never an acceptable capture.
   Adaptation point: the list of shipped faces.
3. Every visible image is decoded and has nonzero natural dimensions.
4. Focus is cleared from the focused element, and the pointer is parked at a fixed corner.
5. The target's geometry is stable, by the check of part 7, and the readiness record of that check
   is kept.
6. Every required response has been delivered, by the check of part 5, except declared held ones.
7. The screenshot is taken with animations disabled and the text caret hidden, in layout pixels.

A checkpoint of the shell captures the whole viewport, and any other checkpoint captures its target
element. The receipt records for every checkpoint its name, its image, what was captured, the
readiness record and the checks the scene recorded since the previous checkpoint.

The real shell stays visible. Viewport captures preserve it, and targeted captures provide detail.
The runtime scrolls the actual scrolling container to the target and records that position. A
full-page screenshot is never claimed to cover a panel that scrolls internally unless it actually
did. A closed widget is closed through its ordinary initial state, never by removing it from the
document.

No layout-fixing styles are injected and no region under evaluation is masked. An animation that
cannot be captured deterministically is a failed readiness requirement to resolve, never permission
to hide it.

## After the scene

When the scene's run function returns, the boundary's end-of-variant count check runs. A failure in
the variant is recorded with the variant name, the checkpoint the scene was working towards, the
message with the repository path replaced by a placeholder, and the instruction to inspect the scene
predicate or fixture. Checks left without a following checkpoint are recorded as a failure. The
boundary's record and failures go into the receipt, the boundary is closed and the context is
closed.

After every variant, the runtime fingerprints the application inputs, the harness code, the scene's
import graph and the fixture data again. Any difference records that the source or a fixture changed
during the capture and asks for a repeat on a stable tree. An input that became unreadable records
that it could not be revalidated. Either case invalidates the capture while keeping the evidence it
already wrote.

## The output contract

A successful capture prints the verdict and the report path, relative to the repository root, and
exits zero. A failed capture prints the failed verdict and the report path, then every failure on
the error stream, and exits nonzero. Each failure names the scene, the variant and checkpoint, the
failed predicate or the response key, and the corrective action. A capture without a given name
prints the unique name it generated, and every capture prints the chosen port. Reports stay
available after a failure.

## Numbers and their reasons

The reference fixed its clock at noon of a winter day and paused it one minute later, so date-based
labels were stable and nothing timer-based ran between start-up and capture. Any fixed instant
works; a scene whose content depends on the date states the instant it assumes.

## Web realization in the reference

The reference served the application with Vite, loading the project's own configuration from the
export and merging it with the harness settings; because the merge dropped a null override, the
watcher was switched off after merging. Chromium ran headless through Playwright, one browser
context per variant, with the page clock installed and paused before navigation and an
initialization script seeding local storage. Fonts were checked with the document's font loading
interface and images with their decode function. Page routes lived in the address fragment, and the
component entry received the container width as a query parameter.

## Native and terminal realizations

A native mobile harness builds and installs the application from the exported source, clears the
application's data before each variant and starts it fresh. The device profile fixes size and
density, the locale and timezone are set on the emulator or simulator, dark mode follows the
variant, and system animations are switched off, such as through the animator duration scales on
Android. The clock is controlled through the test framework where it offers one, such as a paused
composition clock advanced frame by frame or a widget test's fake time, and otherwise through a
clock the test build injects. The session is written into the application's storage before its first
activity or scene starts. The capture is an emulator or simulator screenshot, or an image rendered
by an in-process renderer of the toolkit.

A desktop harness starts the application on a virtual display of fixed size with a fixed scale
factor and captures a window or widget image through the toolkit's grab function or the display
server.

A terminal harness starts the application in a fresh pseudo-terminal of fixed size per variant,
with UTC and the variant's locale, a controlled clock such as a time-faking preload library or an
injected clock, and a fixture home directory. The capture renders the terminal screen to an image
with a locked terminal emulator once the screen buffer is stable, as part 7 describes.
