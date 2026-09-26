# Part 8: fixtures and drift

Fixtures are the data every scene renders, and drift is the gap that opens when the application's
real data shapes change while the fixtures stay the same. The harness makes drift fail visibly, at
two points: statically, when the fixtures stop type checking against the application's types, and
at run time, when the rendered screen consumes something the fixtures do not declare.

## The shared shell responses

One helper builds the responses of the application's shell, and every page scene builds on it. The
shell's reads are the ones the survey of part 1 listed: navigation badges and counters, the version
line, account or organization switchers, health signals and held subscriptions. A scene that needs a
different shell state, such as a switcher that draws because the account belongs to several
organizations, declares that state explicitly through the helper. Adaptation point: the shell reads.

A read the shell makes but whose failure the application hides still belongs in the helper. The
reference's version line drew a shorter line when its read failed, so the response was required by
the rule that every consumer is declared, and not by anything visible on the screen.

A second helper builds one read fixture from its key, path, response, query and policy, with the
repeat policy as its default. A page-fixture builder per surface composes the main record's reads,
the shell helper, the surface's own reads and its writes, and sets the count of every read the
scene's reloads repeat.

## Typed fixtures

Fixtures are typed against the application's own data types, imported from the application's
source, and against its components' parameter types. No unchecked cast appears in a fixture, with at
most one declared exception: where the application's type is narrower than what its wire format and
display model accept, a fixture may widen exactly that one field, with a comment saying why. The
reference used this exception once, for a stored type code outside the closed union of its type
definitions that the display model shows as stored.

Fixture content is synthetic and labeled as synthetic. Names, texts and help prose are written for
the fixture and never copied from authoritative documentation or real records. A fixture never
substitutes an empty value to erase a real affordance: a help text read gets entries for every field
the screen draws help for, and a share or link read gets a synthetic stored link so the normal
affordances draw. Every address inside a fixture uses a reserved domain that can never resolve, such
as one under `.invalid`, and scenes never navigate to it.

Fixture edge values are deliberate. A fixture carries short and long natural-language values,
accented characters, one long unbroken value as a stress case, and a second language with longer
words, because those are the values that break layouts. Fixture state is chosen for the tightest
layout as well: the longest labels the controls draw, such as the longest name of a mode or
setting, and the extra control that makes a row fullest, such as an optional button that only some
states draw. A record that lacks an optional translation shows the application's fallback, and an
empty state comes from an empty model or an empty declared response, never from missing fixture
data.

## Runtime assertions on parsed data

Before a fixture set is served, it is validated with runtime assertions on the parsed data: required
envelopes, field types, enumeration values and the consistency of referenced identifiers. The
harness uses the application's own runtime validators where they exist and narrow ordinary
assertions for the bounded fixture set otherwise. These assertions check parsed data; they are no
second decoder of the wire format. Missing optional data is allowed only when the scene declares
that state.

Validation runs before the rendering engine starts, so a broken fixture fails the manifest before
any navigation. Every assertion message names the key or field and asks for the fixture to be
curated again.

## Drift checks

The validation compares a fixture set with the set the scene expects and fails on each of these:

* a projection version that differs from the current one;
* a main record that fails its type assertions, or whose identifier is not the local alias;
* a missing response list, or a duplicate response key;
* a missing fixture key, named in the message;
* a method, policy, count or declared status that differs from the expected one;
* a main record response that differs from the set's main record;
* a help text response without an entry, a description or a read-only flag for a required field;
* any other read, excluding held ones, whose response differs in envelope, type or content;
* a path or query that differs;
* a write body that differs, since the harness asserts the exact narrow patch;
* an extra response key the scene does not expect;
* a referenced identifier that no related read contains.

A type change, a missing property a scene uses, an unexpected request or a missing required response
each fails visibly. The projection version of fixtures and samples is raised on every incompatible
change, and caches of an older version are invalidated; absent fields are never filled with
plausible defaults.

## What drift checks cannot prove

Tolerant data helpers in the application can hide a wire change by filling a missing field with a
default, so scenes assert the expected rendered values and counts as well as successful requests.
Offline validation cannot prove that a live schema the harness has never seen is unchanged.
Validation reports keep the two apart: offline compatibility is stated as checked, live
compatibility as not verified.

## Web realization in the reference

The reference wrote its fixtures in TypeScript, imported the application's API types, and used the
standard library's strict assertion module for runtime assertions. Its shell helper returned nine
responses, eight repeat reads and one held subscription, and its page-fixture builder added the main
record, its related reads, the help text read, a list read for one screen and one save operation.

## Native and terminal realizations

A native harness types its fixtures against the application's model classes, such as data classes or
decodable structures, and decodes JSON fixtures with the application's own decoder, so a renamed
field fails at decoding. A terminal harness types its fixture files against the configuration and
data structures the application parses, and runs the application's own parser over them in the
validation step.

Fixture files are tracked. Validation output and any cached copies live in the harness directory
inside the project cache, the location `workflow-skills:local-cache` defines.
