# Part 5: the data boundary

The data boundary is the point where the application receives data. It is the only point where the
harness substitutes anything. Interception covers every data source used by the application. It is
installed on the whole rendering context before the first screen renders, so every read request
sent during start-up passes through it. Adaptation point: the data sources found by the survey. For
a web application these are the request paths called by the data clients in the application, and
for other interfaces they can include files, sockets, databases and subprocesses.

## Matching

A request is matched against the declared response fixtures by its operation or method, its path,
its query parameters after normalization, and for a write request its exact body. The query is
normalized by sorting its key and value pairs, so the order of the parameters never matters. An
extra, missing or changed parameter never matches. The body of a write request is decoded with a
standard JSON decoder and compared by deep equality with the declared body. A write request whose
body cannot be decoded is blocked and recorded. URLs and query strings are parsed with the standard
URL functions provided by the platform.

## Failures

A request that matches none of the fixtures fails the scene. When none of the fixtures declares the
path of the request, the failure message shows the method and the path, with the instruction to add
the exact method, path and query to the response set of the scene. When a fixture declares the path
but the method, query or body differs, the failure message shows the key of that fixture and the
part that did not match.

A request matched by an exhausted fixture fails the scene, with the key of that fixture in the
failure message. A once fixture is exhausted after one delivery. A fixture with a count is exhausted
when the count is reached. A duplicate write request is therefore rejected and recorded, even when
the application ignores the rejection.

The boundary does not send a response to a request not declared by any fixture. It does not return
an empty successful response for unknown requests, does not proxy, does not forward a request to the
real destination and does not fall back to a live service. A missing fixture never counts as a
success with an empty state.

## Blocked escapes

Every escape to an external system is blocked: frames, images, fonts, scripts, data requests,
sockets, downloads and navigation to another origin, and on the web also service worker
registration. Navigation to an external address is blocked before a request for it goes out to the
network. A blocked attempt is recorded as a failure of the scene even when the application catches
the error and continues. A download is cancelled and recorded. The download directory set for the
rendering engine points into the harness directory inside the project cache, at the location
defined by `workflow-skills:local-cache`.

Local traffic passes only when it delivers the application itself. On the web, the modules, styles
and assets sent by the local development server pass through together with the entry document,
limited to read requests under the known source, dependency and internal path prefixes used by that
server. Every other local request is blocked and recorded as unexpected. The rendering engine may
open network connections only to the exact local origin of the development server, which includes
the socket opened by the development client.

The harness leaves the endpoint setting of the realtime transport in the application empty. The
application therefore never opens a socket to a service. A closed widget or a background
feature must not create a session or open a realtime connection during a scene. Any such attempt
fails the scene.

## Error output fails the run

Error output from the application fails the scene: error messages written to the console or the
log, unhandled application errors, and request failures not caused by the harness. A scene about an
error state declares the expected error through a response fixture with a failing status. That
status excuses only the error output for the path of that fixture. The scene fails when the declared
failure never arrives. The harness excuses only declared errors and never suppresses error output in
bulk.

A request left open because the matching fixture is held is not a request failure. A request
cancelled while the scene is closing is not one either. Once the scene has finished, the boundary
aborts every further request without recording it.

## Delivery checks

Before every checkpoint, the boundary checks that every declared read request was delivered at
least once and that every declared failing response has failed. A held read request counts as
delivered once the application has sent it. A missing read request fails the capture. The failure
message shows the key of the fixture, with the instruction to supply the consumer of that response
and to wait for it. All failures collected up to then are raised together.

At the end of every variant, the boundary checks that every once fixture was delivered exactly once
and every fixture with a count was delivered exactly that many times. A mismatch fails with a
message that shows the key, the expected count and the observed count, with the instruction to run
the interactions or reloads defined in the scene.

Held responses are listed as held in the readiness checks and in the receipt. An ordinary missing
response can never use that exemption. The boundary never sends instant successful idle responses in
a loop to a long-held subscription. The boundary also never returns a failing status only to make a
subscription disappear.

Read requests repeated by polling in the shell receive identical declared responses under the
repeat policy. A global signal that the network is idle is never used as the readiness condition.

## Stored state after a write

A write request declared by the scene is fulfilled with a response in the real shape returned by the
update operation of the application. The boundary has a scripted stored state. A declared write
request merges its body into the stored record, the response to the update contains the stored
record, and later read requests for that record return the stored state. A reload after a write
request therefore shows the saved values, although the harness never writes directly into the state
store of the application. Adaptation point: which write requests update which read requests.

## Consumers found during start-up

Start-up may reveal a genuine consumer missed by the survey. The code of that consumer is read, the
exact response expected by it is added to the response set of the scene, and the survey is
corrected. A consumer is never hidden to keep the response set short. A consumer that retries with a
different query when the first response is empty needs both read requests declared, or a fixture
that avoids the retry.

## What the receipt records

The receipt for every variant contains the required response keys, the matched count and the
delivered count for each key, the held keys, every recorded failure, and every local asset request
still pending at the end.

## Web realization in the reference

Before the first navigation, the reference installed the interception through Playwright, routing
every request and every WebSocket on the browser context. It blocked service workers through the
setting on the browser context and replaced the registration function in an initialization script.
An attempt to register was therefore recorded through a function exposed to the page, even when the
application caught the rejected promise. It launched Chromium with background networking, component
updates and proxies disabled, and with a host resolver rule under which every host except the
loopback address failed to resolve. Data requests were recognized by their path prefix. Modules and
assets from the development server passed through by their path prefix. Error output was collected
from the console, page error, request failure and download events of the page. Adaptation point: the
data path prefixes and the local asset prefixes.

## Native and terminal realizations

A native mobile or desktop harness intercepts inside the networking client used by the application,
or behind a local fixture server. Examples are an interceptor in the HTTP client, a loopback mock
server to which the test build points the client, a registered URL loading protocol in an iOS test
build, or a mock client injected into a widget test. Escapes are blocked by starting the emulator,
simulator or process with a network route to the loopback interface only, or by an interceptor that
fails and records every request to a host other than the fixture server. Error output is read from
the platform log, such as the device log filtered to the process of the application. An uncaught
exception fails the scene.

A terminal harness runs the application in a process without network access, such as a separate
network namespace or a container with networking disabled. The files and subprocesses used by the
application as data sources come from a home directory that contains the fixture files, and from
fake executables on the search path. Each of them is declared like a response fixture and recorded
when used. Any output written by the application to its error stream fails the scene unless the
scene declares it.
