# Part 6: the runtime and the capture

The runtime runs one capture from start to end. It prepares the application source, starts the
serving or build process that comes with the application, starts the rendering engine, runs every
variant of the scene, captures every checkpoint, checks the inputs again, and writes the receipt and
the report. One component runs this whole sequence. The other parts supply it with mechanisms.

## Preflight

The runtime does not start when the variables set by the launcher are missing. The error message
shown then contains the launcher command. Before anything else, the runtime fingerprints the
application inputs and the harness code, as described in part 9.

The capture directory is created with private permissions inside the harness directory in the
project cache, at the location defined by `workflow-skills:local-cache`. Creating it fails when the
directory already exists, so every capture name can be used only once.

A failure before rendering starts still leaves a report. The runtime writes a receipt with
everything gathered up to that point and adds the failure to it. The failure contains the scene
name, the word preflight, the message, and the instruction to repair the input shown in the message
and use a new capture name. The runtime then writes the report and prints the failed verdict with
the path of the report.

## The source snapshot

The serving process reads the application from a snapshot. It never reads the live working tree.
Without a source revision, the runtime copies the relevant tracked and untracked files of the
application from the working tree into a fresh export directory, so an edit made during the run
cannot change the files delivered by the serving process. With a source revision, the runtime
resolves the revision to a commit locally. It exports the files tracked in that commit into a fresh
export directory with the archive command built into the version control system and a standard
archive tool. The export never changes the working tree, the index or any branch. The runner and the
scene always come from the harness that runs the capture. Only the application source and its locks
come from the selected revision. The receipt records the harness version and the source revision
separately.

The runtime installs the dependencies listed in the frozen lock of the exported source into the
dependency cache of part 2, which is keyed by the lock, and links them into the export. A lock
mismatch fails the capture with the instruction to fix the lock of the selected source deliberately.
The component entries of the harness are copied into the export so the serving process can load
them. The export directory is recorded as a path relative to the harness directory.

Adaptation point: which files count as application inputs. The reference counted the source and
public asset directories, the entry document, the build configuration, the package manifest, the
lock and the type checker configurations of the application.

## The serving configuration

The build or development configuration of the application is loaded from the export and combined
with the harness settings. The production configuration is not modified. With the harness
settings, the serving process:

* listens on the loopback address only;
* uses a strict port where it offers that setting;
* runs without hot reloading and without the file watcher;
* uses an empty directory as the environment directory, so it loads none of the environment files
  in the repository;
* uses a separate cache directory for every run;
* sends only files from the export and the dependency cache.

The combined configuration replaces the data origins with local values handled by the data boundary
of part 5, sets the realtime endpoint to empty, and fixes build-time values such as the version
string and the build date. Adaptation point: the names of the origin, storage and realtime settings
and of the build-time values in the application.

A requested port is used as given and must be an integer from 1024 to 65535. The run fails at once
when another process already uses that port. Without a requested port, the runtime asks the
operating system for a free loopback port. The chosen port is printed either way.

The serving process and the rendering engine are closed on every exit path, including failures.

## Component scenes

A component scene is loaded through a harness entry. That entry mounts the real component with the
same start-up as the application: the same state store, translations, theme initialization,
stylesheet and registration of the shipped fonts. The entry must be a module inside the component
directory of the harness. The serving configuration replaces the entry document with a minimal
document that loads that module. The harness checks that this start-up matches the start-up of the
application. System fonts never replace the shipped font faces. The component is drawn inside the
boxes drawn around it by the shell of the application, so the widths and backgrounds of its
containers are the real ones. Where a scene asserts the model of the component, the entry shows the
model value in an output element read by the scene, so interactions are checked against exact
values.

## The rendering context

Every variant runs in a fresh rendering context, so storage, caches and state from one variant never
pass into the next. The context fixes the viewport size, a pixel density of one, the locale of the
variant, UTC as the timezone, the color scheme of the theme set by the variant and the reduced
motion preference. It also blocks service workers and downloads. The data boundary is installed on
the context before the first page exists.

Before the first render, a clock is installed at a fixed time and paused at a fixed later time.
While the clock is paused, timer-based states never advance by themselves, such as a randomized
blink, a relative time label or polling after the first request. The stability check of part 7 and
the steps of the scene advance the clock frame by frame, and only to named observable transitions.

Before any application code runs, the harness seeds a synthetic session, together with the locale
and theme of the variant, into the storage from which the application reads them. The harness seeds
nothing else. Cached data, feature settings and state from an earlier run are left out, so every
other value comes from the start-up of the application and from the data boundary. The session
contains a fixed identity, claims that match the stored role, and a token that is still valid at
the fixed time of the scene. The session does not contain a refresh credential. The token is
static, unsigned and not secret. The real decoder in the application reads the claims in it. The
harness is not an authentication server. The harness never reads a person's browser profile or a
persisted login. Adaptation point: the storage keys, the claims and the role.

The runtime then opens the route given by the scene for a page scene, or the component entry for a
component scene. When the variant sets a container width, the runtime passes it to the entry as a
parameter. It then passes the run context of part 4 to the scene. Waiting for start-up or a reload
allows up to sixty seconds for the module graph of the real entry to load. That limit is a timeout.
The wait ends as soon as the module graph has loaded.

## The capture sequence

Every checkpoint runs the same sequence, with the same settings for every capture of every revision.

1. The screen or route has settled, and the target is mounted with the expected fixture values. The
   screen does not show a spinner, a load error or a login screen. The waits in the scene check this
   before the scene calls capture.
2. Every required shipped font face is loaded explicitly and checked, and the rendering engine has
   finished loading fonts. A missing face fails the capture. A capture drawn with a fallback font is
   never accepted. Adaptation point: the list of shipped font faces.
3. Every visible image is decoded and has nonzero natural dimensions.
4. The focus is removed from the focused element, and the pointer is parked at a fixed corner.
5. The geometry of the target is stable according to the check of part 7. The readiness record from
   that check is saved.
6. Every required response except the declared held ones has been delivered, according to the
   check of part 5.
7. The screenshot is taken with animations disabled and the text caret hidden, in layout pixels.

A checkpoint of the shell captures the whole viewport. Every other checkpoint captures its target
element. The capture of a targeted checkpoint includes everything meant to appear in it. A capture
of a group of options includes every option in full, with every edge visible. Floating content that
opens outside the surrounding card, such as a popover or menu, is captured on the enclosing host.
For every checkpoint, the receipt records the name, the image, what was captured, the readiness
record and the checks recorded by the scene since the previous checkpoint.

The harness never hides the real shell. Viewport captures preserve it, and targeted captures add
detail. The runtime scrolls the actual scrolling container to the target and records that
position. A full-page screenshot is never claimed to cover a panel that scrolls internally unless
it actually did. A closed widget is closed through its ordinary initial state. The harness never
removes it from the document.

The harness never injects styles that fix the layout and never masks a region under evaluation. An
animation that cannot be captured deterministically is a failed readiness requirement to be
resolved. The harness never hides the animation.

## After the scene

When the run function of the scene returns, the data boundary runs the count check for the end of
the variant. A failure in the variant is recorded with the variant name, the next checkpoint in the
scene, the message with the repository path replaced by a placeholder, and the instruction to
inspect the scene predicate or fixture. Checks not followed by a checkpoint are recorded as a
failure. The record and the failures from the boundary go into the receipt. Then the boundary and
the context are closed.

After every variant, the runtime fingerprints the application inputs, the harness code, the import
graph of the scene and the fixture data again. Any difference is recorded as a change to the source
or to a fixture during the capture, with the instruction to repeat the capture on a stable tree. An
input that became unreadable is recorded as not revalidated. Either case invalidates the capture.
The evidence written up to then remains in the capture directory.

## The output contract

A successful capture prints the verdict and the report path, relative to the repository root, and
exits zero. A failed capture prints the failed verdict and the report path, then every failure on
the error stream, and exits nonzero. Each failure message contains the scene, the variant and
checkpoint, the failed predicate or the response key, and the corrective action. A capture started
without a name prints the unique name generated for it. Every capture prints the chosen port.
Reports are still available after a failure.

## Numbers and their reasons

The reference set the clock to noon on a winter day and paused it one minute later. Date-based
labels were therefore stable, and timer-based code did not run between start-up and capture. Any
fixed instant works. A scene with date-dependent content declares the instant on which it depends.

## Web realization in the reference

The reference ran the application on the Vite development server. It loaded the configuration of
the project from the export and merged it with the harness settings. The merge dropped a null
override, so the watcher was switched off after merging. Chromium ran headless through Playwright,
with one browser context per variant. The page clock was installed and paused before navigation,
and an initialization script seeded local storage with the session, the locale and the theme mode
only. Fonts were checked with the font loading interface of the document, and images with their
decode function. Page routes were in the fragment of the address. The component entry received the
container width as a query parameter.

## Native and terminal realizations

A native mobile harness builds and installs the application from the exported source, clears the
stored application data before each variant and starts the application fresh. The device profile
fixes size and density, the locale and timezone are set on the emulator or simulator, dark mode is
set by the variant, and system animations are switched off, such as through the animator duration
scales on Android. Where the test framework offers a clock, the harness controls time through it,
such as a paused composition clock advanced frame by frame or the fake time of a widget test.
Otherwise the harness uses a clock injected by the test build. The session is written into the
storage of the application before the first activity or scene of the application starts. The
capture is an emulator or simulator screenshot, or an image rendered in-process by a renderer from
the toolkit.

A desktop harness starts the application on a virtual display of fixed size with a fixed scale
factor. It captures an image of a window or widget through the grab function of the toolkit or
through the display server.

For every variant, a terminal harness starts the application in a fresh pseudo-terminal of fixed
size. The application runs with UTC, the locale of the variant, a controlled clock such as a
time-faking preload library or an injected clock, and a home directory that contains the fixture
files. Once the screen buffer is stable, as described in part 7, the capture renders the terminal
screen to an image with a locked terminal emulator.
