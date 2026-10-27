# The integration survey

Before any harness code exists, adopting project fills in table of its integration points. Each row
contains one responsibility, evidence found in source code of project for how that responsibility
works at time of survey, and design consequence for harness. Survey records source observations
made at that time, with explicit note that it does not show that a screenshot has been taken.

Survey fills in every adaptation point of this guide. Harness built without it reconstructs
application from assumptions. Such harness produces screenshots of something other than
application.

## The rows every survey has

Row for application start-up records real entry point of application: which state stores,
navigation, translations, theme and styles it installs, and how it registers fonts used by it.
Design consequence: page scenes start through this entry, never through reconstructed screen.
Adaptation point: entry module, framework, font registration.

Row for authentication and route protection records where application reads session from, which
storage key or keychain entry contains it, how route protection waits for session, and where route
protection sends unauthenticated visitor. Design consequence: synthetic session seeded before any
application code runs, route protection and session store left unchanged. Adaptation point:
storage mechanism, its key, claims read by decoder in application.

Row for data boundary records every client used by application to fetch data: how its origin is
derived, which headers or tokens it attaches, how it retries or refreshes on authentication
failure. Design consequence: interception at that boundary, installed before first screen renders.
Where documentation of project describes boundary differently from code, survey follows code and
notes difference. Adaptation point: origin variable, client module, retry behavior.

Row for shell consumers records every request sent by shell of application to read data around
each screen: navigation badges, version line, organization or account switchers, health signals,
status banners, closed widgets, notification hosts, any long-held subscription. Design consequence:
response set covering only main document of screen never counts as complete fixture. Adaptation
point: list of requests sent by shell to read data, their exact queries and their policies.

Row for build records build tool, plugins used by it, production entry and production output. Design
consequence: harness does not add production route, conditional test styling or harness dependency
to production build. Adaptation point: build configuration, production artifact to inspect.

## Rows that depend on the surfaces

Survey adds one row for each surface covered by first scenes. Such row records real route or screen
with its child sections, every request made by surface when it opens, including requests made by
only one entry screen, components that draw surface, and primitive components to which they
delegate. Design consequence lists chain of real components exercised by scene. Scenes never build
parallel model or invented component. For item editor screen, e.g., row lists request for item,
requests for related records, request for help text, save operation with its narrow patch body, and
component that draws each field.

Survey adds row for existing rendering tests of project. Row records which tests use simulated
document or widget tree, what they assert about layout, which of their fixtures are useful evidence
of data shapes. Design consequence: shapes of their fixtures may inform harness fixtures. Empty
translation bundles and module doubles used by those tests are never start-up mechanism for a
scene.

Survey adds row for any earlier harness or screenshot tooling in same organization. Design
consequence: reuse mechanisms that locked engine and fonts. Reject arbitrary waits, blanket layout
overrides, handwritten argument parsing, and dependency installation that can rewrite a lock.
Harness never imports another repository at runtime.

## How the reference filled it in

Reference harness built for single-page web application. Survey made for reference found one entry
module that installed state store, router and translations, initialized theme, imported stylesheet
and registered monospace font from bundled file. Found authentication store reading token from
local storage under fixed key, and route protection in router that waited until store was ready and
redirected to login screen. Found one data client that derived its origin from build-time
environment variable, attached stored token and retried authentication failure through refresh
call. Found shell that mounted navigation signals, account loading, backend version line, status
banners, closed assistant widget and notification host. Shell also opened long-held status
subscription, renewed it as soon as response arrived on it. Build used development server with
framework, styling and single-file plugins, produced one production HTML file.

## Native and terminal realizations

Native mobile application has same rows. Entry: start-up of application or activity. Session
stored in keychain, keystore or preference store. Data boundary: networking client built by
application, e.g. HTTP client with interceptors. Shell consumers: tab bar, navigation drawer,
background refresh jobs. Row for build records variant of application installed by harness on
emulator or simulator, e.g. debug or test build type, and production variant, which must not
contain harness code.

Desktop application has entry that creates main window, session in settings store or credential
store of operating system, and data boundary that can include local files, sockets, databases and
subprocesses as well as network requests. Survey lists every one of them.

Terminal application has entry that sets up terminal, reads its configuration files and
environment, and opens its data sources, often files, subprocesses and sockets. Shell consumers:
status line, headers, background refreshes. Row for build records binary or script that runs inside
terminal emulator used by harness.

## What the survey produces

Survey ends with filled table, stored in harness contract of project, and list of every adaptation
point with its value for this project. Adaptation points of every later part of guide come from
that list. Where work on later part finds consumer or fact missed by survey, survey corrected
first, and part continues from corrected table. Consumer never hidden to keep table short.

Survey derives list of responses from reading code, for shell and for each surface. Contract
records that list as manifest to verify during implementation. List never presented as trace of
requests observed in rendering engine. Survey written before any scene runs. Start-up can still
reveal consumer missed by first pass over code, as described in part on data boundary.

Table: only tracked output of survey. Notes and exploratory reads made while filling it in stored
in harness directory inside project cache, location defined by `workflow-skills:local-cache`.
