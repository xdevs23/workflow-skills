# Part 14: the self-test suite

The harness has its own bounded test suite, run through the launcher's test verb. It exercises the
fixtures, the comparison, the coloring, the network denial, the launcher's lock refusal, the port
and server settings, the sample refresh against a synthetic transport, and the evidence sheet. The
suite runs only through the launcher, since several tests need the locked engine and the launcher's
variables; those tests assert that the variables are present and name the launcher command when they
are not.

The suite is kept out of the project's ordinary test discovery. Its file name does not match the
test runner's discovery pattern, and the launcher passes the file to the test runner explicitly. The
project's ordinary test run therefore stays free of the environment tool, the rendering engine and
network use.

Every test that writes files writes into a fresh directory under the harness directory in the
project cache, the location `workflow-skills:local-cache` defines, named with a random identifier.

## Categories

The missing-key tests remove the main record's response, one shell response and the help text
response, each independently, and each removal fails the manifest validation before any
navigation, with the missing key in the message.

The help entry tests remove the help text entry of one required field at a time, and each removal
fails validation naming that field.

The shape drift tests check that a wrong projection version, a wrong envelope of a shell response, a
missing consumed field of the main record, a referenced identifier missing from its related read,
and an extra undeclared response each fail validation.

The request identity tests check that a read matches with its query parameters in any order; an
extra query parameter, a different method and a write body with an extra field each fail to match.

The compatibility tests check that a different scene, a different compatibility group such as a
different lock, and an empty checkpoint set each fail the compatibility check, while a different
source revision is accepted.

The zero tolerance tests check that comparing an image with itself gives zero changed pixels, one
changed pixel gives a count of one, and images of different dimensions fail with a dimensions
message.

The coloring tests cover the four acceptance rules of part 11: marks appearing and vanishing on a
light and a dark field, and a moved mark; contrast gain and loss; neutral fills, equal-luma hue
changes and a 1 by 1 image; edge clipping, enclosed pixels and alpha compositing over white,
including the luma of half-opaque black; and the equality of the count with the comparison
component's, the sum of the kinds, the legend colors of recolored pixels and the byte equality of
every other pixel.

The launcher lock test runs the bootstrap in a scratch copy whose package manifest names an
impossible dependency version, and checks that it exits nonzero with the frozen installation
message and leaves the lock and the manifest byte for byte unchanged.

The port tests check that a free port lookup returns an unprivileged loopback port that can be
bound. A requested valid port is used as given, and invalid values, a privileged port, a port above
65535, a fraction, a word and an empty string, are refused with a message naming the port option.

The serving configuration test checks that the composed configuration binds the loopback address,
uses the requested port strictly, switches the watcher off and switches hot reloading off, even when
the application's own configuration sets a polling watcher and another port.

The projection test checks that projecting a record that carries an email address, external media
and private fields yields exactly the synthetic record with the displayed fields, and nothing
private remains.

The credential refusal tests check that a refresh without the origin and the credential refuses
without making a request, a missing sample is refused, and a sample whose manifest says incomplete
is refused.

The controlled refresh test runs a refresh through a synthetic transport that checks the exact
address and that redirects are denied and the method is a read, publishes a sample, refuses a second
refresh to the same label while leaving the published sample byte for byte unchanged, replays the
sample without credentials with mixed provenance and without the credential or any excluded field in
it, refuses a selection with an extra operation before any request, and reports a transport failure
without the raw service error in its message. The request count proves which refreshes reached the
transport.

The network denial test runs in the locked engine, where one probe each attempts an external image,
an external data request, a navigation to an external address, an external frame, an external
socket, an undeclared local data request and a service worker registration, with the application
swallowing the errors. Each probe must add a failure and make the delivery check throw. A trap
server standing in for the outside world must receive zero requests, and the local server must
receive zero data requests. A declared write sent twice is delivered once, the second attempt
records an exhausted response, and the end-of-variant count check throws.

The region tests check that the bounding box of changed pixels covers exactly the differing
rectangle, an unchanged pair has no box, and the region grows the box by the margin and clamps it to
the image.

The sheet grouping test checks that one variant's checkpoints split into changed, new, identical and
before-only correctly, independent of their order, and other variants are ignored.

The sheet rendering test checks that two synthetic captures render into one PNG of exactly the fixed
sheet width; a second render to the same output fails as existing, and a missing capture is refused
by name.

The sheet refusal tests check that captures of different scenes are refused with both capture and
scene names in the message, and a receipt without a source revision is refused naming its capture.

## Web realization in the reference

The reference wrote the suite with the runtime's built-in test module and strict assertion module in
a TypeScript file named so the ordinary test command did not discover it. The launcher ran it with
the runtime's test runner from the dependency cache. The network probes used two local HTTP servers
from the standard library, one for the application's origin and one as the trap.

## Native and terminal realizations

A native harness runs the same categories in its own test framework, as a separate test task or
source set that the ordinary test task does not include. The network probe category uses the
harness's interceptor or loopback fixture server and a second loopback server as the trap, inside
the emulator or process the harness launches. A terminal harness probes escapes by having a probe
program attempt a network connection, open an undeclared file and run an undeclared executable
inside the harness's sandbox.
