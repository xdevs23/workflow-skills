# The data boundary

Data boundary = point where application receives data. Only point where harness substitutes
anything. Interception covers every data source used by application. Installed on whole rendering
context before first screen renders, so every read request sent during start-up passes through it.
Adaptation point: data sources found by survey. For web application: request paths called by data
clients in application. For other interfaces they can include files, sockets, databases and
subprocesses.

## Matching

Request matched against declared response fixtures by operation or method, path, query parameters
after normalization, and for write request its exact body. Query normalized by sorting its key and
value pairs, so order of parameters never matters. Extra, missing or changed parameter never
matches. Body of write request decoded with standard JSON decoder, compared by deep equality with
declared body. Write request whose body cannot be decoded: blocked and recorded. URLs and query
strings parsed with standard URL functions provided by platform.

## Failures

Request that matches none of fixtures fails scene. When none of fixtures declares path of request,
failure message shows method and path, with instruction to add exact method, path and query to
response set of scene. When fixture declares path but method, query or body differs, failure
message shows key of that fixture and part that did not match.

Request matched by exhausted fixture fails scene, with key of that fixture in failure message. Once
fixture exhausted after one delivery. Fixture with count exhausted when count reached. Duplicate
write request therefore rejected and recorded, even when application ignores rejection.

Boundary does not send response to request not declared by any fixture. Does not return empty
successful response for unknown requests, does not proxy, does not forward request to real
destination, does not fall back to live service. Missing fixture never counts as success with empty
state.

## Blocked escapes

Every escape to external system blocked: frames, images, fonts, scripts, data requests, sockets,
downloads, navigation to another origin, and on web also service worker registration. Navigation to
external address blocked before request for it goes out to network. Blocked attempt recorded as
failure of scene even when application catches error and continues. Download cancelled and
recorded. Download directory set for rendering engine points into harness directory inside project
cache, at location defined by `workflow-skills:local-cache`.

Local traffic passes only when it delivers application itself. On web: modules, styles and assets
sent by local development server pass through together with entry document, limited to read
requests under known source, dependency and internal path prefixes used by that server. Every other
local request blocked, recorded as unexpected. Rendering engine may open network connections only
to exact local origin of development server, which includes socket opened by development client.

Harness leaves endpoint setting of realtime transport in application empty. Application therefore
never opens socket to a service. Closed widget or background feature must not create session or
open realtime connection during scene. Any such attempt fails scene.

## Error output fails the run

Error output from application fails scene: error messages written to console or log, unhandled
application errors, request failures not caused by harness. Scene about error state declares
expected error through response fixture with failing status. That status excuses only error output
for path of that fixture. Scene fails when declared failure never arrives. Harness excuses only
declared errors, never suppresses error output in bulk.

Request left open because matching fixture is held: not a request failure. Request cancelled while
scene is closing: not one either. Once scene has finished, boundary aborts every further request
without recording it.

## Delivery checks

Before every checkpoint, boundary checks that every declared read request was delivered at least
once and every declared failing response has failed. Held read request counts as delivered once
application has sent it. Missing read request fails capture. Failure message shows key of fixture,
with instruction to supply consumer of that response and to wait for it. All failures collected up
to then raised together.

At end of every variant, boundary checks that every once fixture was delivered exactly once and
every fixture with count delivered exactly that many times. Mismatch fails with message showing
key, expected count, observed count, with instruction to run interactions or reloads defined in
scene.

Held responses listed as held in readiness checks and in receipt. Ordinary missing response can
never use that exemption. Boundary never sends instant successful idle responses in loop to
long-held subscription. Boundary also never returns failing status only to make subscription
disappear.

Read requests repeated by polling in shell receive identical declared responses under repeat
policy. Global signal that network is idle never used as readiness condition.

## Stored state after a write

Write request declared by scene: fulfilled with response in real shape returned by update operation
of application. Boundary has scripted stored state. Declared write request merges its body into
stored record. Response to update contains stored record. Later read requests for that record
return stored state. Reload after write request therefore shows saved values, although harness
never writes directly into state store of application. Adaptation point: which write requests
update which read requests.

## Consumers found during start-up

Start-up may reveal genuine consumer missed by survey. Then code of that consumer gets read, exact
response expected by it gets added to response set of scene, survey gets corrected. Consumer never
hidden to keep response set short. Consumer that retries with different query when first response
is empty needs both read requests declared, or fixture that avoids retry.

## What the receipt records

Receipt for every variant contains required response keys, matched count and delivered count for
each key, held keys, every recorded failure, every local asset request still pending at end.

## Web realization in the reference

Before first navigation, reference installed interception through Playwright, routing every request
and every WebSocket on browser context. Blocked service workers through setting on browser context,
replaced registration function in initialization script. Attempt to register therefore recorded
through function exposed to page, even when application caught rejected promise. Launched Chromium
with background networking, component updates and proxies disabled, and with host resolver rule
under which every host except loopback address failed to resolve. Data requests recognized by path
prefix. Modules and assets from development server passed through by path prefix. Error output
collected from console, page error, request failure and download events of page. Adaptation point:
data path prefixes and local asset prefixes.

## Native and terminal realizations

Native mobile or desktop harness intercepts inside networking client used by application, or
behind local fixture server. Examples: interceptor in HTTP client, loopback mock server to which
test build points client, registered URL loading protocol in iOS test build, mock client injected
into widget test. Escapes blocked by starting emulator, simulator or process with network route to
loopback interface only, or by interceptor that fails and records every request to host other than
fixture server. Error output read from platform log, e.g. device log filtered to process of
application. Uncaught exception fails scene.

Terminal harness runs application in process without network access, e.g. separate network
namespace or container with networking disabled. Files and subprocesses used by application as data
sources come from home directory that contains fixture files, and from fake executables on search
path. Each of them declared like response fixture and recorded when used. Any output written by
application to its error stream fails scene unless scene declares it.
