# The self-test suite

Harness has bounded test suite, run through test verb of launcher. Suite tests fixtures, comparison,
coloring, network denial, lock check in launcher, port and server settings, sample refresh against
synthetic transport, and evidence sheet. Suite runs only through launcher, since several tests need
locked engine and variables set by launcher. Those tests assert variables present. When variables
missing, tests fail with message containing launcher command.

Ordinary test discovery of project does not find suite. Suite file name does not match discovery
pattern of test runner. Launcher passes file to test runner explicitly. So ordinary test run of
project runs without environment tool, without rendering engine, without network.

Every test that writes files writes into fresh directory named with random identifier, under harness
directory in project cache, location defined by `workflow-skills:local-cache`.

## Categories

Tests for missing keys remove response for main record, one shell response and help text response,
each independently. Each removal fails manifest validation before any navigation, missing key in
message.

Help entry tests remove help text entry for one required field at a time. Each removal fails
validation, that field in message.

Shape drift tests check each of these fails validation: wrong projection version, wrong envelope of
shell response, missing consumed field of main record, referenced identifier missing from related
read request, extra undeclared response.

Tests for request matching check read request matches with query parameters in any order. Extra
query parameter, different method and write body with extra field each fail to match.

Compatibility tests check different scene, different compatibility group such as different lock, and
empty set of checkpoints each fail compatibility check. Different source revision passes it.
Compatibility tests also check missing checkpoint, present in one capture and absent from other,
fails comparison. This check adds to incompatible inputs and to different dimensions covered by zero
tolerance tests.

Zero tolerance tests check: image compared with itself gives zero changed pixels, one changed pixel
gives count of one, images of different dimensions fail with message about dimensions.

Coloring tests cover four acceptance rules of diff coloring: marks appearing and vanishing on light
and dark field, and moved mark; contrast gain and loss; neutral fills, equal-luma hue changes and 1
by 1 image; edge clipping, enclosed pixels and alpha compositing over white, including luma of
half-opaque black; and equality of count with count from comparison component, sum of kinds, legend
colors of recolored pixels and byte equality of every other pixel.

Launcher lock test runs bootstrap in scratch copy with package manifest requiring impossible
dependency version. Checks bootstrap exits nonzero with message about frozen installation, leaves
lock and manifest unchanged byte for byte.

Port tests check lookup of free port returns unprivileged loopback port that can be bound. Port
tests also check requested valid port used as given. Tested invalid values: privileged port, port
above 65535, fraction, word, empty string. Each fails with message containing port option.

Serving configuration test checks composed configuration binds loopback address, uses requested port
strictly, switches watcher off, switches hot reloading off. Applies even when configuration of
application sets polling watcher and another port.

Projection test checks projecting record containing email address, external media and private fields
gives exactly synthetic record with displayed fields, nothing private left in it.

Tests for missing credentials check: refresh without origin and credential fails without sending
request, missing sample fails, sample with manifest marked incomplete fails.

Controlled refresh test runs refreshes through synthetic transport that checks exact address, that
redirects denied and that method is a read. Test checks that:

* refresh publishes sample;
* second refresh to same label fails, leaves published sample unchanged byte for byte;
* sample replays without credentials, with mixed provenance, without credential or any excluded
  field in it;
* selection with extra operation fails before any request;
* transport failure reported without raw service error in message;
* refresh stopped before it finishes leaves output marked incomplete.

Count of requests shows which refreshes sent requests to transport.

Network denial test runs in locked engine. One probe each attempts external image, external data
request, navigation to external address, external frame, external socket, undeclared local data
request and service worker registration, while application swallows errors. Each probe must add a
failure, and delivery check before next checkpoint must throw. Trap server standing in for outside
world must receive zero requests. Local server must receive zero data requests. Declared write sent
twice delivered once. Second attempt records exhausted response, and check at end of variant that
counts how often each fixture was delivered throws.

Region tests check: bounding box of changed pixels covers exactly differing rectangle, unchanged
pair does not get a box, region is box grown by margin and clamped to image.

Sheet grouping test checks checkpoints of one variant split correctly into changed, new, identical
and before-only, independent of order, and other variants ignored.

Sheet rendering test checks two synthetic captures render into one PNG of exactly fixed sheet width.
Second render to same output fails because output exists. Missing capture fails with capture name in
message.

Sheet refusal tests check captures of different scenes refused with both capture names and both
scene names in message. They also check receipt without source revision refused with name of capture
in message.

## Web realization in the reference

Reference wrote suite with test module and strict assertion module built into runtime, in TypeScript
file named so ordinary test command did not discover it. Launcher ran suite with test runner of
runtime, taken from dependency cache. Network probes used two local HTTP servers from standard
library: one for origin of application, one as trap.

## Native and terminal realizations

Native harness runs same categories in test framework of native platform, as separate test task or
source set not included in ordinary test task. Network probe category uses interceptor or loopback
fixture server of harness, and second loopback server as trap, inside emulator or process launched
by harness. Terminal harness probes escapes with probe program that attempts network connection,
opens undeclared file and runs undeclared executable inside sandbox set up by harness.
