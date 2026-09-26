# Part 5: the data boundary

The data boundary is the point where the application receives data, and it is the only point where
the harness substitutes anything. Interception covers every data source of the application and is
installed before the first screen renders, on the whole rendering context, so that no read of the
start-up escapes it. Adaptation point: the data sources the survey found, which for a web
application are the request paths of its data clients and for other interfaces can include files,
sockets, databases and subprocesses.

## Matching

A request is matched against the declared response fixtures by its operation or method, its path,
its query parameters after normalization, and for a write its exact body. The query is normalized by
sorting its key and value pairs, so parameter order never matters, and an extra, missing or changed
parameter never matches. A write body is decoded with a standard JSON decoder and compared by deep
equality with the declared body. A write whose body cannot be decoded is blocked and recorded. URLs
and query strings are read with the platform's standard URL facilities.

## Failures

A request that matches no fixture fails the scene. When no fixture declares its path, the failure
names the method and path and asks for its exact method, path and query to be added to the scene's
response set. When a fixture declares the path but the method, query or body differs, the failure
names that fixture's key and says which part mismatched.

A request whose fixture is exhausted fails the scene with the fixture's key. A once fixture is
exhausted after one delivery, and a fixture with a count is exhausted when the count is reached. A
duplicate write is therefore rejected and recorded, even when the application ignores the rejection.

Nothing answers a request that no fixture declares. No catch-all successful empty response, no
proxy, no forwarding of the request to its real destination and no fallback to a live service
exists. A missing fixture is never a blank-state success.

## Blocked escapes

Every escape to an external system is blocked: frames, images, fonts, scripts, data requests,
sockets, downloads and navigation to another origin, and on the web also service worker
registration. Navigation to an external address is blocked before it reaches the network. A blocked
attempt is recorded as a failure of the scene even when the application catches the error and
carries on, because a swallowed escape is still a dependency the scene did not declare. A download
is cancelled and recorded, and the engine's download directory points into the harness directory
inside the project cache, the location `workflow-skills:local-cache` defines.

Local traffic passes only where it is the application itself. On the web, the local development
server's modules, styles, assets and the entry document pass through, restricted to reads under the
server's known source, dependency and internal prefixes; any other local request is blocked and
recorded as unexpected. The only network connection the rendering engine may open goes to the exact
local origin of the development server, including the development client's own socket.

The application's realtime transport stays inert by leaving its endpoint setting empty, so no socket
to a service is ever attempted. A closed widget or background feature must not create a session or
open a realtime connection during a scene; any such attempt fails the scene.

## Error output fails the run

The application's error output fails the scene: error messages on its console or log, unhandled
application errors, and request failures the harness did not cause. A scene about an error state
declares the specific error it expects through a response fixture with a failing status. That status
excuses the error output of its own path only, and the scene fails when the declared failure never
arrives. No blanket suppression of errors exists.

A request that stays open because its fixture is held, and requests cancelled while the scene is
closing, are not request failures. Once the scene has finished, the boundary aborts every further
request without recording it.

## Delivery checks

Before every checkpoint, the boundary checks that every declared read was delivered at least once, a
held read counting as delivered when it was requested, and that every declared failing response has
failed. A missing read fails the capture with the fixture's key and asks for its consumer to be
supplied and awaited. The accumulated failures are raised at the same moment.

At the end of every variant, the boundary checks that every once fixture was delivered exactly once
and every fixture with a count was delivered exactly that many times. A mismatch names the key, the
expected and the observed count, and asks for the scene's named interactions or reloads to be run.

Held responses are listed as held in readiness and in the receipt. An ordinary missing response can
never use that exemption. A long-held subscription is never answered with instantaneous successful
idle responses in a loop, since its consumer renews at once and floods the boundary; a failing
status is never manufactured to make a subscription disappear either.

Repeated reads that the shell polls receive identical declared responses under the repeat policy.
A global network idle signal is never used as readiness, because an interface with polling reads and
held requests never goes idle.

## Stored state after a write

A write the scene declares is fulfilled with the real response shape of the application's update
operation. The boundary keeps a scripted stored state: a declared write merges its body into the
stored record, the update response carries the stored record, and later reads of that record return
the stored state. A reload after a save therefore shows the saved values, with no direct write to
the application's state store. Adaptation point: which writes update which reads.

## Consumers found during start-up

Start-up may reveal a genuine consumer that the survey missed. Its code is read, its exact response
is added to the scene's response set and the survey is corrected. A consumer is never hidden to keep
the response set short. A consumer that retries with a different query when its first answer is
empty needs both reads declared, or a fixture that avoids the retry.

## What the receipt records

The receipt of every variant records the required response keys, the matched count and the
delivered count per key, the held keys, every recorded failure, and any local asset requests still
pending at the end.

## Web realization in the reference

The reference installed its interception with Playwright's routing of every request on the browser
context and its routing of WebSockets, before the first navigation. It blocked service workers
through the browser context setting and replaced the registration function in an initialization
script, so an attempt was recorded through a function exposed to the page even when the application
caught the rejected promise. It launched Chromium with background networking, component updates and
proxies disabled and a host resolver rule that resolved every host except the loopback address to
nothing. Data requests were recognized by their path prefix; the development server's modules and
assets passed through by path prefix. Error output was collected from the page's console, page
error, request failure and download events. Adaptation point: the data path prefixes and the local
asset prefixes.

## Native and terminal realizations

A native mobile or desktop harness intercepts inside the application's networking client or behind a
local fixture server. Examples are an HTTP client interceptor or a loopback mock server that the
test build points the client at, a registered URL loading protocol in an iOS test build, or a mock
client injected into a widget test. Escapes are blocked by starting the emulator, simulator or
process without a network route beyond the loopback interface, or by an interceptor that fails and
records every host except the fixture server. Error output is read from the platform log, such as
the device log filtered to the application's process, and an uncaught exception fails the scene.

A terminal harness runs the application in a process without network access, such as a separate
network namespace or a container with networking disabled. Its file and subprocess data sources are
answered from a fixture home directory and fake executables on the search path, each declared like a
response fixture and each recorded when called. Anything the application writes to its error stream
fails the scene unless the scene declares it.
