# The self-test suite

The harness has a bounded test suite, run through the test verb of the launcher. The suite tests the
fixtures, the comparison, the coloring, the network denial, the lock check in the launcher, the port
and server settings, the sample refresh against a synthetic transport, and the evidence sheet. The
suite runs only through the launcher, since several tests need the locked engine and the variables
set by the launcher. Those tests assert that the variables are present and fail with a message
that contains the launcher command when they are missing.

The ordinary test discovery of the project does not find the suite. The file name of the suite does
not match the discovery pattern of the test runner. The launcher passes the file to the test runner
explicitly. The ordinary test run of the project therefore runs without the environment tool,
without the rendering engine and without the network.

Every test that writes files writes into a fresh directory named with a random identifier, under the
harness directory in the project cache, the location defined by `workflow-skills:local-cache`.

## Categories

The tests for missing keys remove the response for the main record, one shell response and the help
text response, each independently. Each removal fails the manifest validation before any navigation,
with the missing key in the message.

The help entry tests remove the help text entry for one required field at a time. Each removal fails
validation with that field in the message.

The shape drift tests check that each of these fails validation: a wrong projection version, a wrong
envelope of a shell response, a missing consumed field of the main record, a referenced identifier
missing from the related read request, and an extra undeclared response.

The tests for request matching check that a read request matches with its query parameters in any
order. An extra query parameter, a different method and a write body with an extra field each fail
to match.

The compatibility tests check that a different scene, a different compatibility group such as a
different lock, and an empty set of checkpoints each fail the compatibility check. A different
source revision passes it. The compatibility tests also check that a missing checkpoint, present in
one capture and absent from the other, fails the comparison. This adds to the incompatible inputs
and to the different dimensions covered by the zero tolerance tests.

The zero tolerance tests check that comparing an image with itself gives zero changed pixels, that
one changed pixel gives a count of one, and that images of different dimensions fail with a message
about the dimensions.

The coloring tests cover the four acceptance rules of the diff coloring: marks appearing and
vanishing on a light and a dark field, and a moved mark; contrast gain and loss; neutral fills,
equal-luma hue changes and a 1 by 1 image; edge clipping, enclosed pixels and alpha compositing over
white, including the luma of half-opaque black; and the equality of the count with the count from
the comparison component, the sum of the kinds, the legend colors of recolored pixels and the byte
equality of every other pixel.

The launcher lock test runs the bootstrap in a scratch copy with a package manifest that requires an
impossible dependency version. It checks that the bootstrap exits nonzero with the message about the
frozen installation and leaves the lock and the manifest unchanged byte for byte.

The port tests check that the lookup of a free port returns an unprivileged loopback port that can
be bound. They check that a requested valid port is used as given. The tested invalid values are a
privileged port, a port above 65535, a fraction, a word and an empty string. Each of them fails with
a message that contains the port option.

The serving configuration test checks that the composed configuration binds the loopback address,
uses the requested port strictly, switches the watcher off and switches hot reloading off. This
applies even when the configuration of the application sets a polling watcher and another port.

The projection test checks that projecting a record that contains an email address, external media
and private fields gives exactly the synthetic record with the displayed fields, with nothing
private left in it.

The tests for missing credentials check that a refresh without the origin and the credential fails
without sending a request, that a missing sample fails, and that a sample with a manifest marked
incomplete fails.

The controlled refresh test runs refreshes through a synthetic transport that checks the exact
address, that redirects are denied and that the method is a read. The test checks that:

* a refresh publishes a sample;
* a second refresh to the same label fails and leaves the published sample unchanged byte for byte;
* the sample replays without credentials, with mixed provenance and without the credential or any
  excluded field in it;
* a selection with an extra operation fails before any request;
* a transport failure is reported without the raw service error in the message;
* a refresh stopped before it finishes leaves its output marked incomplete.

The count of requests shows which refreshes sent requests to the transport.

The network denial test runs in the locked engine. One probe each attempts an external image, an
external data request, a navigation to an external address, an external frame, an external socket,
an undeclared local data request and a service worker registration, while the application swallows
the errors. Each probe must add a failure, and the delivery check before the next checkpoint
must throw. A trap server that stands in for the outside world must receive
zero requests. The local server must receive zero data requests. A declared write sent twice is
delivered once. The second attempt records an exhausted response, and the check at the end of the
variant that counts how often each fixture was delivered throws.

The region tests check that the bounding box of changed pixels covers exactly the differing
rectangle, that an unchanged pair does not get a box, and that the region is the box grown by the
margin and clamped to the image.

The sheet grouping test checks that the checkpoints of one variant split correctly into changed,
new, identical and before-only, independent of their order, and that other variants are ignored.

The sheet rendering test checks that two synthetic captures render into one PNG of exactly the fixed
sheet width. A second render to the same output fails because the output exists, and a missing
capture fails with the capture name in the message.

The sheet refusal tests check that captures of different scenes are refused with both capture names
and both scene names in the message. They also check that a receipt without a source revision is
refused with the name of the capture in the message.

## Web realization in the reference

The reference wrote the suite with the test module and the strict assertion module built into the
runtime, in a TypeScript file named so that the ordinary test command did not discover it. The
launcher ran the suite with the test runner of the runtime, taken from the dependency cache. The
network probes used two local HTTP servers from the standard library, one for the origin of the
application and one as the trap.

## Native and terminal realizations

A native harness runs the same categories in the test framework of the native platform, as a
separate test task or source set not included in the ordinary test task. The network probe category
uses the interceptor or the loopback fixture server of the harness and a second loopback server as
the trap, inside the emulator or process launched by the harness. A terminal harness probes escapes
with a probe program that attempts a network connection, opens an undeclared file and runs an
undeclared executable inside the sandbox set up by the harness.
