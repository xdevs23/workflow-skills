# The launcher

Harness starts through one command, launcher, run from repository root with a verb and its
arguments. Launcher: only way to run harness. Every other entry point fails without capturing when
variables set by launcher missing, and its error message contains launcher command.

## Start-up, environment and dependencies

Launcher runs only from repository root. Before anything else, checks for file existing only at
root, e.g. command-line module of harness. Otherwise exits with error message containing root
directory.

Launcher sets private file permissions for everything created by run. Captures, receipts, samples
and reports readable only by user running harness. Reference set restrictive file creation mask
before any other step.

Runtime, rendering engine and fonts come from locked environment. Launcher never uses engine already
installed on machine, never lets automation library download engine at run time, never installs
anything globally. Fonts used by capture: font files shipped with application plus locked set of
fallback fonts under locked font configuration. System fonts never substitute for shipped faces.

Launcher clears environment. Run receives only allowlisted set of variables: search path of locked
environment, private home directory inside harness directory, scratch directory, cache directory
inside harness directory, locked font configuration, path of locked rendering engine, identifier of
system type of machine, and refresh variables, which never contain credential. Every other variable
from environment of caller left out of run. Deployment settings, service credentials and developer
preferences cannot change a capture. Runtime configured not to load environment files from
repository, e.g. dotenv files.

Launcher creates private scratch directory in system temporary directory, one per run, never shared
across runs. Removes directory when run ends, on every exit path. Cleanup covers that directory and
processes started by launcher itself. Does not supervise processes started in turn by rendering
engine. Scratch directory contains only temporary files written by runtime and rendering engine,
e.g. local socket bound by engine. Launcher checks length of scratch path against any limit imposed
by rendering engine. Rejects longer path before engine starts, with message containing name of
override variable. Check counts encoded bytes. Path limit is byte limit.

Override variable for scratch directory points to another private directory, used by one run alone.
Launcher removes that directory same way. Override moves only scratch directory. Captures, reports
and every other artifact still written to harness directory.

Bootstrap run first by launcher does not import any package. Uses only standard library of runtime.
Installing dependencies cannot load application code or environment settings of application.

Dependencies installed from frozen lock into cache keyed by content of lock. Bootstrap hashes
dependency lock of project together with package manifest, copies both into dependency cache
directory inside harness directory, named after that hash. There runs package manager in frozen
installation mode with install scripts disabled. Installation that fails, or lock that differs after
installation from copy made by bootstrap, stops run with error message containing instruction to
update project lock deliberately. Installed dependency directory never counts as valid cache just
because it exists. Missing lock fails run, as does mismatched one. Locks never rewritten silently.

Refresh credentials passed only to refresh command. Bootstrap reads them from its own standard
input, hands them to child process as JSON on standard input of child, only when verb is refresh
verb. Every other verb runs without them.

Bootstrap then copies harness code into dependency cache keyed by lock, runs requested verb from
that copy. Passes dependency cache and repository root as variables, disables automatic
installation of packages by runtime. Self-test verb runs test suite of harness through test runner
of runtime. Every other verb runs command line described in part on command line and scene
registry. Harness modules resolve packages only from frozen cache, never from dependency directory
installed in project. Content of that directory not confirmed by lock check.

Bootstrap exits with exit status of child process. Child that ends without status, e.g. one killed
by signal, counts as failure. Interrupted capture never reports success.

Fetching dependencies may use network, happens before any rendering. Rendering run itself never
uses network. Dependency missing during rendering is failure, never triggers installation.
Reference met rule for frozen cache with `env -i` and copied harness directory, as described in web
realization below, and rule against network access with request interception and browser settings
of data boundary. Neither rule requires enforcement below runtime, e.g. kernel namespaces or
sandbox.

## Two locks

Harness relies on two locks. Neither replaces the other. Dependency lock of project locks
application, framework used by it, font packages shipped with it. After adoption, also locks
automation and image libraries used by harness. Environment lock locks runtime, rendering engine,
font configuration, fallback fonts. Receipt records hash of both.

Automation library and rendering engine locked together, as combination verified during
implementation to work together: version of library in dependency lock and version of engine in
environment lock. Harness contract of project lists only versions verified that way.

## Numbers and their reasons

Reference limited scratch path to 61 bytes. Browser engine used by it binds local socket at fixed
suffix under scratch directory. Unix socket path is at most 107 bytes long. 61-byte limit leaves
room for that suffix. Another engine can have different limit, derived from same reason. Engine
without such socket does not need a length check. Survey records which case applies.

## Web realization in the reference

Reference used Nix flake as environment lock, with launcher application written as shell script and
started through flake with `path:` reference so uncommitted harness changes were included. Flake
supplied JavaScript runtimes, Chromium, Git, archive tool, core utilities, and fontconfig with two
fallback font families. Flake locked for two Linux system types. Shell script checked root, set
creation mask, checked scratch path, ran bootstrap under `env -i` with allowlisted variables.
Bootstrap: TypeScript module using only built-in modules of runtime. Ran package manager in frozen
installation mode, scripts ignored. Then copied harness directory into dependency cache, started
runtime there, with automatic installation switched off and environment files not loaded. Exited
with status of child, or with status 1 when child ended without status. Browser automation library
in dependency lock and Chromium in flake chosen as compatible pair. Each release of that library
supports specific range of browser versions.

## Native and terminal realizations

Native mobile harness locks emulator or simulator same way. For Android, SDK manager installs exact
package revisions of emulator and system image. Device profile of emulator fixes screen size and
density. Dependency locking and verification in build tool lock libraries. For iOS, harness records
version of development toolchain and simulator runtime. Mismatch fails run. Neither can be
installed from lock file same way. Toolkit used by in-process renderer, e.g. JVM-side renderer of
Android views or widget test renderer, locked through dependency lock of project. User interface
test framework and emulator, simulator or renderer controlled by it locked as one verified
combination, same way as browser automation library and engine controlled by it. Harness runs from
dependencies resolved by lock, in offline mode of build tool or equivalent. Run never fetches or
resolves package by itself.

Desktop harness locks toolkit, runs application on virtual display with fixed resolution, e.g.
virtual framebuffer server or offscreen platform of toolkit, inside locked environment, e.g.
container image referenced by digest or Nix environment.

Terminal harness locks terminal emulator that renders session to image, font file used by that
emulator, terminal size in columns and rows, and variables for terminal type and color capability.
Cleared environment matters even more here. Terminal applications read many environment variables
that change their output, e.g. locale, color and width settings.
