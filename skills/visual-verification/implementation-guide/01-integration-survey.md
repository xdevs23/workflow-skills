# Part 1: the integration survey

Before any harness code exists, the adopting project fills in a table of its integration points.
Each row names one responsibility, the source evidence found in the project's own code for how that
responsibility works today, and the design consequence for the harness. The survey records current
source observations; it is no evidence that a screenshot has been taken, and it states that openly.

The survey fills in every adaptation point of this guide. A harness built without it reconstructs
the application from assumptions, and a harness built on assumptions produces screenshots of
something other than the application.

## The rows every survey has

The application start-up row records the real entry point of the application: which state stores,
navigation, translations, theme and styles it installs, and how it registers its fonts. The design
consequence is that page scenes start through this entry and never through a reconstructed screen.
Adaptation point: the entry module, the framework and the font registration.

The authentication and route protection row records where the application reads its session, which
storage key or keychain entry holds it, how route protection waits for the session and where it
sends an unauthenticated visitor. The design consequence is a synthetic session seeded before any
application code runs, with the route protection and the session store left untouched. Adaptation
point: the storage mechanism, its key and the claims the application's decoder reads.

The data boundary row records every client the application uses to fetch data: how its origin is
derived, which headers or tokens it attaches, and how it retries or refreshes on an authentication
failure. The design consequence is interception at that boundary, installed before the first screen
renders. Where the project's documentation describes the boundary differently from the code, the
code wins, and the survey notes the difference. Adaptation point: the origin variable, the client
module and the retry behavior.

The shell consumers row records every read the application's shell makes around each screen:
navigation badges, the version line, organization or account switchers, health signals, status
banners, closed widgets, notification hosts and any long-held subscription. The design consequence
is that a response set covering only the screen's main document is never a complete fixture.
Adaptation point: the list of shell reads, their exact queries and their policies.

The build row records the build tool, its plugins, the production entry and the production output.
The design consequence is that the harness adds no production routes, no conditional test styling
and no harness dependency to the production build. Adaptation point: the build configuration and the
production artifact to inspect.

## Rows that depend on the surfaces

The survey adds one row for each surface the first scenes cover. A row records the real route or
screen with its child sections, every read the surface makes when it opens, including reads that
only one entry screen makes, which components draw it and which primitive components they delegate
to. The design consequence names the chain of real components the scene exercises, so no scene
builds a parallel model or an invented component. For an item editor screen, for example, the row
names the item read, the reads of related records, the help text read, the save operation with its
narrow patch body, and the component that draws each field.

The survey adds a row for the project's existing rendering tests. The row records which tests use a
simulated document or widget tree, what they state about layout, and which of their fixtures are
useful shape evidence. The design consequence is that their fixture shapes may inform the harness
fixtures, while their empty translation bundles and module doubles are never a start-up mechanism
for a scene.

The survey adds a row for any earlier harness or screenshot tooling in the same organization. The
design consequence keeps the mechanisms that locked the engine and fonts and refuses arbitrary
waits, blanket layout overrides, handwritten argument parsing and dependency installation that can
rewrite a lock. The harness never imports another repository at runtime, so the project can
reproduce its own evidence independently.

## How the reference filled it in

The reference was a single-page web application. Its survey found one entry module installing the
state store, the router and translations, initializing the theme, importing the stylesheet and
registering a monospace font from a bundled file. It found the authentication store reading a token
from local storage under a fixed key, with the router's route protection waiting for store readiness
and redirecting to the login screen. It found one data client deriving its origin from a build-time
environment variable, attaching the stored token and retrying an authentication failure through a
refresh call. It found a shell that mounted navigation signals, account loading, a backend version
line, status banners, a closed assistant widget and a notification host, and a long-held status
subscription that the shell renewed as soon as it answered. The build used a development server with
framework, styling and single-file plugins and produced one production HTML file.

## Native and terminal realizations

A native mobile application has the same rows. Its entry is the application or activity start-up,
its session lives in a keychain, keystore or preference store, its data boundary is the networking
client the application builds, such as an HTTP client with interceptors, and its shell consumers are
the tab bar, navigation drawer and background refresh jobs. The build row records the application
variant, such as a debug or test build type, that the harness installs on an emulator or simulator,
and the production variant that must not contain harness code.

A desktop application has an entry that creates its main window, a session in a settings store or
the operating system's credential store, and a data boundary that can include local files, sockets,
databases and subprocesses as well as network requests. The survey lists every one of them.

A terminal application has an entry that sets up the terminal, reads its configuration files and
environment, and opens its data sources, which are often files, subprocesses and sockets. The shell
consumers are the status line, headers and background refreshes. The build row records the binary or
script that runs inside the harness's terminal emulator.

## What the survey produces

The survey ends with the filled table, stored in the project's harness contract, and a list of every
adaptation point with its value for this project. Every later part of this guide reads its
adaptation points from that list. Where a later part finds a consumer or fact the survey missed, the
survey is corrected first and the part continues from the corrected table; no consumer is hidden to
keep the table short.

The table is the survey's only tracked output. Notes and exploratory reads made while filling it in
stay in the harness directory inside the project cache, the location `workflow-skills:local-cache`
defines.
