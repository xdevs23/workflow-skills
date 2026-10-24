# The launcher

The harness starts through one command, the launcher, run from the repository root with a verb and
its arguments. The launcher is the only way to run the harness. Every other entry point fails
without capturing when the variables set by the launcher are missing, and its error message contains
the launcher command.

## Start-up, environment and dependencies

The launcher runs only from the repository root. Before anything else, it checks for a file that
exists only at the root, such as the command-line module of the harness, and otherwise exits with an
error message that contains the root directory.

The launcher sets private file permissions for everything created by the run. Captures, receipts,
samples and reports are readable only by the user running the harness. The reference set a
restrictive file creation mask before any other step.

The runtime, the rendering engine and the fonts come from a locked environment. The launcher never
uses an engine already installed on the machine, never lets an automation library download an
engine at run time, and never installs anything globally. The fonts used by the capture are the font
files shipped with the application plus a locked set of fallback fonts under a locked font
configuration. System fonts never substitute for the shipped faces.

The launcher clears the environment. The run receives only an allowlisted set of variables: the
search path of the locked environment, a private home directory inside the harness directory, the
scratch directory, a cache directory inside the harness directory, the locked font configuration,
the path of the locked rendering engine, an identifier of the system type of the machine, and the
refresh variables, which never contain the credential. Every other variable from the environment of
the caller is left out of the run. Deployment settings, service credentials and developer
preferences cannot change a capture. The runtime is configured not to load environment files from
the repository, such as dotenv files.

The launcher creates a private scratch directory in the system temporary directory, one for each run
and never shared across runs. It removes the directory when the run ends, on every exit path. The
cleanup covers that directory and the processes started by the launcher itself. It does not
supervise the processes started in turn by the rendering engine. The scratch directory contains only
the temporary files written by the runtime and the rendering engine, such as the local socket bound
by the engine. The launcher checks the length of the scratch path against any limit imposed by the
rendering engine. It rejects a longer path before the engine starts, with a message that contains
the name of the override variable. The check counts encoded bytes. A path limit is a byte limit.

The override variable for the scratch directory points to another private directory, used by one
run alone. The launcher removes that directory the same way. The override moves only the scratch
directory. Captures, reports and every other artifact are still written to the harness directory.

The bootstrap run first by the launcher does not import any package. It uses only the standard
library of the runtime. Installing dependencies cannot load application code or environment settings
of the application.

Dependencies are installed from a frozen lock into a cache keyed by the content of the lock. The
bootstrap hashes the dependency lock of the project together with the package manifest and copies
both into a dependency cache directory inside the harness directory, named after that hash. There it
runs the package manager in frozen installation mode with install scripts disabled. An installation
that fails, or a lock that differs after installation from the copy made by the bootstrap, stops the
run with an error message containing the instruction to update the project lock deliberately. An
installed dependency directory never counts as a valid cache just because it exists. A missing lock
fails the run, as does a mismatched one. Locks are never rewritten silently.

Refresh credentials are passed only to the refresh command. The bootstrap reads them from its
standard input and hands them to the child process as JSON on its standard input, only when the verb
is the refresh verb. Every other verb runs without them.

The bootstrap then copies the harness code into the dependency cache keyed by the lock and runs the
requested verb from that copy. It passes the dependency cache and the repository root as variables
and disables the automatic installation of packages by the runtime. The self-test verb runs the test
suite of the harness through the test runner of the runtime. Every other verb runs the command line
described in the part on the command line and the scene registry.
Harness modules resolve packages only from the frozen cache, never from the
dependency directory installed in the project. The content of that directory is not confirmed by a
lock check.

The bootstrap exits with the exit status of the child process. A child that ends without a status,
such as one killed by a signal, counts as a failure. An interrupted capture never reports success.

Fetching dependencies may use the network and happens before any rendering. The rendering run
itself never uses the network. A dependency missing during rendering is a failure and never triggers
an installation. The reference met the rule for the frozen cache with `env -i` and a copied harness
directory, as described in the web realization below, and the rule against network access with the
request interception and browser settings of the data boundary. Neither rule requires enforcement
below the runtime, such as kernel namespaces or a sandbox.

## Two locks

The harness relies on two locks, and neither replaces the other. The dependency lock of the project
locks the application, the framework it uses and the font packages shipped with it. After adoption,
it also locks the automation and image libraries used by the harness. The environment lock locks the
runtime, the rendering engine, the font configuration and the fallback fonts. The receipt records
the hash of both.

The automation library and the rendering engine are locked together, as a combination verified to
work together during implementation: the version of the library in the dependency lock and the
version of the engine in the environment lock. The harness contract of the project lists only
versions verified that way.

## Numbers and their reasons

The reference limited the scratch path to 61 bytes. The browser engine it used binds a local socket
at a fixed suffix under the scratch directory. A Unix socket path can be at most 107 bytes long. The
61-byte limit leaves room for that suffix. Another engine can have a different limit, derived from
the same reason. An engine without such a socket does not need a length check. The survey records
which case applies.

## Web realization in the reference

The reference used a Nix flake as the environment lock, with a launcher application written as a
shell script and started through the flake with a `path:` reference so that uncommitted harness
changes were included. The flake supplied the JavaScript runtimes, Chromium, Git, an archive tool,
core utilities and fontconfig with two fallback font families. It was locked for two Linux system
types. The shell script checked the root, set the creation mask, checked the scratch path, and ran
the bootstrap under `env -i` with the allowlisted variables. The bootstrap was a TypeScript module
that used only the built-in modules of the runtime. It ran the package manager in frozen
installation mode with scripts ignored. It then copied the harness directory into the dependency
cache and started the runtime there, with automatic installation switched off and environment files
not loaded. It exited with the status of the child, or with status 1 when the child ended without a
status. The browser automation library in the dependency lock and the Chromium in the flake were
chosen as a compatible pair. Each release of that library supports a specific range of browser
versions.

## Native and terminal realizations

A native mobile harness locks the emulator or simulator the same way. For Android, the SDK manager
installs exact package revisions of the emulator and the system image. The device profile of the
emulator fixes screen size and density. Dependency locking and verification in the build tool lock
the libraries. For iOS, the harness records the version of the development toolchain and the
simulator runtime, and a mismatch fails the run. Neither can be installed from a lock file the same
way. The toolkit used by an in-process renderer, such as a JVM-side renderer of Android views or a
widget test renderer, is locked through the dependency lock of the project. The user interface test
framework and the emulator, simulator or renderer controlled by it are locked as one verified
combination, the same way as a browser automation library and the engine it controls. The harness
runs from the dependencies resolved by the lock, in the offline mode of the build tool or an
equivalent. A run never fetches or resolves a package by itself.

A desktop harness locks the toolkit and runs the application on a virtual display with a fixed
resolution, such as a virtual framebuffer server or the offscreen platform of the toolkit, inside a
locked environment such as a container image referenced by digest or a Nix environment.

A terminal harness locks the terminal emulator that renders the session to an image, the font file
used by that emulator, the terminal size in columns and rows, and the variables for terminal type
and color capability. The cleared environment matters even more here. Terminal applications read
many environment variables that change their output, such as locale, color and width settings.
