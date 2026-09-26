# Part 2: the launcher

The harness starts through one command, run from the repository root, that takes a verb and its
arguments. The launcher is the only way to run the harness; every other entry point refuses to
capture when the variables the launcher sets are absent, and names the launcher command in its
error.

## Start-up, environment and dependencies

The launcher refuses to run outside the repository root. It checks for a file that exists only at
the root, such as the harness's own command-line module, and exits with a message naming the root
before doing anything else.

The launcher sets private file permissions for everything the run creates, so that captures,
receipts, samples and reports are readable only by the user running the harness. The reference set a
restrictive file creation mask before any other step.

The runtime, the rendering engine and the fonts come from a locked environment. The launcher never
uses an engine already installed on the machine, never lets an automation library download an
engine at run time, and never installs anything globally. The fonts the capture uses are the
application's own shipped font files plus a locked set of fallback fonts under a locked font
configuration; system fonts never substitute for the shipped faces.

The launcher clears the environment. The run receives only an allowlisted set of variables: the
search path of the locked environment, a private home directory inside the harness directory, the
scratch directory, a cache directory inside the harness directory, the locked font configuration,
the path of the locked rendering engine, an identifier of the machine's system type, and the refresh
variables of part 13. Nothing else from the caller's environment reaches the run, so no deployment
setting, service credential or developer preference changes a capture. The runtime is told not to
load environment files from the repository, such as dotenv files.

The launcher creates a private scratch directory. By default it lives inside the harness directory
in the project cache, the location `workflow-skills:local-cache` defines. The launcher checks the
length of the scratch path against any limit the rendering engine imposes and refuses a longer path
before the engine starts, with a message naming the override variable. The check counts encoded
bytes, since a path limit is a byte limit.

The scratch override variable names a private directory that one run uses alone, never shared
across runs. When the default path is too long for the rendering engine, or the checkout sits on a
slow shared file system, the scratch directory still lives in the project cache: the setup makes it
reachable at a short path through a mount or share, such as a virtual machine's file share or a bind
mount, and each run's override names that run's own directory below the short path, never the
shared short path itself. In a unit spec, the orchestrating session provides that short path to the
stages. The system temporary directory is used only when no mount or share is possible, and then
within the user's global rules. The override moves only the scratch directory; captures, reports and
every other artifact stay in the harness directory.

The bootstrap that the launcher runs first imports no packages. It uses only the runtime's own
standard library, so that installing dependencies cannot load application code or application
environment settings.

Dependencies are installed from a frozen lock into a cache keyed by the lock content. The bootstrap
hashes the project's dependency lock together with its package manifest, copies both into a
dependency cache directory named by that hash inside the harness directory, and runs the package
manager's frozen installation there with install scripts disabled. An installation that fails, or a
lock that differs after installation from the one the bootstrap copied, stops the run with a message
telling the user to update the project lock deliberately. The cache is keyed by lock content; the
mere presence of an installed dependency directory never counts as a valid cache. A missing lock
fails the run, as does a mismatched one. Locks are never rewritten silently.

Refresh credentials are passed only to the refresh command. The bootstrap reads the refresh
variables, removes them from its own environment, and hands them to the child process only when the
verb is the refresh verb. Every other verb runs without them.

The bootstrap then copies the harness code into the lock-keyed dependency cache and runs the
requested verb from that copy, with the dependency cache and the repository root passed as
variables and the runtime's automatic installation of packages disabled. The self-test verb runs the
harness's own test suite through the runtime's test runner, and every other verb runs the command
line of part 3. Harness modules therefore resolve packages only from the frozen cache, never from
the project's own installed dependency directory, whose content no lock check has confirmed.

The bootstrap exits with the child process's exit status. A child that ends without a status, such
as one killed by a signal, counts as a failure, so an interrupted capture never reports success.

Dependency acquisition may use the network, and it happens before any rendering. The rendering run
itself never uses the network, and a missing dependency during rendering is a failure; it never
triggers an installation.

## Two locks

The harness relies on two locks, and neither substitutes for the other. The project's dependency
lock locks the application, its framework and its shipped font packages, and after adoption also
locks the automation and image libraries of the harness. The environment lock locks the runtime, the
rendering engine, the font configuration and the fallback fonts. The receipt of part 9 records the
hash of both.

The automation library and the rendering engine are locked together, as a combination verified to
work together during implementation: the library's version in the dependency lock and the engine's
version in the environment lock. The project's harness contract names only versions that were
verified that way, and claims no version that was not.

## Numbers and their reasons

The reference refused a scratch path longer than 61 bytes. Its browser engine binds a local socket
at a fixed suffix under the scratch directory, and a Unix socket path holds at most 107 bytes, so 61
bytes leaves room for that suffix. Another engine has its own limit, derived from the same reason;
an engine without such a socket needs no length check, and the survey records which case applies.

## Web realization in the reference

The reference used a Nix flake as its environment lock, with a launcher application written as a
shell script and started through the flake with a `path:` reference so that uncommitted harness
changes were included. The flake supplied the JavaScript runtimes, Chromium, Git, an archive tool,
core utilities and fontconfig with two fallback font families, and was locked for two Linux system
types. The shell script checked the root, set the creation mask, checked the scratch path, and ran
the bootstrap under `env -i` with the allowlisted variables. The bootstrap was a TypeScript module
using only the runtime's built-in modules, and it ran the package manager's frozen installation with
scripts ignored. It then copied the harness directory into the dependency cache, started the
runtime there with its automatic installation and its environment file loading switched off, and
exited with the child's status, or with one when the child ended without a status. The browser
automation library in the dependency lock and the Chromium in the flake were chosen as a compatible
pair, since each release of that library supports a specific range of browser versions.

## Native and terminal realizations

A native mobile harness locks the emulator or simulator the same way. For Android, the SDK manager
installs exact package revisions of the emulator and the system image, the emulator's device profile
fixes screen size and density, and the build tool's dependency locking and verification lock the
libraries. For iOS, the development toolchain version and the simulator runtime are recorded and a
mismatch refuses the run, since they cannot be installed from a lock file in the same way. An
in-process renderer, such as a JVM-side renderer of Android views or a widget test renderer, locks
its toolkit through the project's own dependency lock. The user interface test framework and the
emulator, simulator or renderer it controls are locked as one verified combination, the same way as
a browser automation library and its engine. The harness runs from the dependencies the lock
resolved, with the build tool's offline mode or its equivalent, so no run fetches or resolves a
package on its own.

A desktop harness locks the toolkit and runs the application on a virtual display with a fixed
resolution, such as a virtual framebuffer server or the toolkit's own offscreen platform, inside a
locked environment such as a container image referenced by digest or a Nix environment.

A terminal harness locks the terminal emulator that renders the session to an image, the font file
it draws with, the terminal size in columns and rows, and the terminal type and color capability
variables. The cleared environment matters even more here, since terminal applications read many
environment variables that change their output, such as locale, color and width settings.
