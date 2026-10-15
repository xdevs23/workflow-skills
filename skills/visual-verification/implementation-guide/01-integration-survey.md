# Part 1: the integration survey

Before any harness code exists, the adopting project fills in a table of its integration points.
Each row contains one responsibility, the evidence found in the source code of the project for how
that responsibility works at the time of the survey, and the design consequence for the harness. The
survey records source observations made at that time and includes an explicit note that it does not
show that a screenshot has been taken.

The survey fills in every adaptation point of this guide. A harness built without it reconstructs
the application from assumptions. Such a harness produces screenshots of something other than the
application.

## The rows every survey has

The row for application start-up records the real entry point of the application: which state
stores, navigation, translations, theme and styles it installs, and how it registers the fonts it
uses. The design consequence is that page scenes start through this entry and never through a
reconstructed screen. Adaptation point: the entry module, the framework and the font registration.

The row for authentication and route protection records where the application reads the session
from, which storage key or keychain entry contains it, how route protection waits for the session
and where route protection sends an unauthenticated visitor. The design consequence is a synthetic
session seeded before any application code runs, with the route protection and the session store
left unchanged. Adaptation point: the storage mechanism, its key and the claims read by the decoder
in the application.

The row for the data boundary records every client used by the application to fetch data: how its
origin is derived, which headers or tokens it attaches, and how it retries or refreshes on an
authentication failure. The design consequence is interception at that boundary, installed before
the first screen renders. Where the documentation of the project describes the boundary differently
from the code, the survey follows the code and notes the difference. Adaptation point: the origin
variable, the client module and the retry behavior.

The row for shell consumers records every request sent by the shell of the application to read data
around each screen: navigation badges, the version line, organization or account switchers, health
signals, status banners, closed widgets, notification hosts and any long-held subscription. The
design consequence is that a response set covering only the main document of the screen is never a
complete fixture. Adaptation point: the list of requests sent by the shell to read data, their exact
queries and their policies.

The row for the build records the build tool, the plugins it uses, the production entry and the
production output. The design consequence is that the harness does not add a production route,
conditional test styling or a harness dependency to the production build. Adaptation point: the
build configuration and the production artifact to inspect.

## Rows that depend on the surfaces

The survey adds one row for each surface covered by the first scenes. Such a row records the real
route or screen with its child sections, every request made by the surface when it opens, including
requests made by only one entry screen, the components that draw the surface and the primitive
components they delegate to. The design consequence lists the chain of real components exercised by
the scene. Scenes never build a parallel model or an invented component. For an item editor screen,
for example, the row lists the request for the item, the requests for related records, the request
for the help text, the save operation with its narrow patch body, and the component that draws each
field.

The survey adds a row for the existing rendering tests of the project. The row records which tests
use a simulated document or widget tree, what they assert about layout, and which of their fixtures
are useful evidence of data shapes. The design consequence is that the shapes of their fixtures may
inform the harness fixtures. The empty translation bundles and module doubles used by those tests
are never a start-up mechanism for a scene.

The survey adds a row for any earlier harness or screenshot tooling in the same organization. The
design consequence is to reuse the mechanisms that locked the engine and fonts and to reject
arbitrary waits, blanket layout overrides, handwritten argument parsing and dependency installation
that can rewrite a lock. The harness never imports another repository at runtime.

## How the reference filled it in

The reference harness was built for a single-page web application. The survey made for the reference
found one entry module that installed the state store, the router and translations, initialized the
theme, imported the stylesheet and registered a monospace font from a bundled file. It found an
authentication store that read a token from local storage under a fixed key, and route protection in
the router that waited until the store was ready and redirected to the login screen. It found one
data client that derived its origin from a build-time environment variable, attached the stored
token and retried an authentication failure through a refresh call. It found a shell that mounted
navigation signals, account loading, a backend version line, status banners, a closed assistant
widget and a notification host. The shell also opened a long-held status subscription and renewed it
as soon as a response arrived on it. The build used a development server with framework, styling and
single-file plugins and produced one production HTML file.

## Native and terminal realizations

A native mobile application has the same rows. The entry is the start-up of the application or
activity. The session is stored in a keychain, keystore or preference store. The data boundary is
the networking client built by the application, such as an HTTP client with interceptors. The shell
consumers are the tab bar, the navigation drawer and background refresh jobs. The row for the build
records the variant of the application installed by the harness on an emulator or simulator, such as
a debug or test build type, and the production variant, which must not contain harness code.

A desktop application has an entry that creates its main window, a session in a settings store or
the credential store of the operating system, and a data boundary that can include local files,
sockets, databases and subprocesses as well as network requests. The survey lists every one of them.

A terminal application has an entry that sets up the terminal, reads its configuration files and
environment, and opens its data sources, which are often files, subprocesses and sockets. The shell
consumers are the status line, headers and background refreshes. The row for the build records the
binary or script that runs inside the terminal emulator used by the harness.

## What the survey produces

The survey ends with the filled table, stored in the harness contract of the project, and a list of
every adaptation point with its value for this project. The adaptation points of every later part of
this guide come from that list. Where work on a later part finds a consumer or fact missed by the
survey, the survey is corrected first, and the part continues from the corrected table. A consumer
is never hidden to keep the table short.

The survey derives a list of responses from reading the code, for the shell and for each surface.
The contract records that list as a manifest to verify during implementation. It is never presented
as a trace of requests observed in the rendering engine. The survey is written before any scene
runs. Start-up can still reveal a consumer that a first pass over the code missed, as described in
part 5.

The table is the only tracked output of the survey. Notes and exploratory reads made while
filling it in are stored in the harness directory inside the project cache, the location defined by
`workflow-skills:local-cache`.
