# Part 8: fixtures and drift

Fixtures are the data rendered by every scene. Drift is the difference that appears when the real
data shapes of the application change and the fixtures do not. The harness makes drift fail visibly
at two points: statically, when the fixtures stop type checking against the types of the
application, and at run time, when the rendered screen consumes something not declared by the
fixtures.

## The shared shell responses

One helper builds the responses for the shell of the application. Every page scene builds on it.
The read requests sent by the shell are those listed by the survey of part 1: navigation badges and
counters, the version line, account or organization switchers, health signals and held
subscriptions. A scene that needs a different shell state, such as a switcher that is drawn because
the account belongs to several organizations, declares that state explicitly through the helper.
Adaptation point: the read requests sent by the shell.

A read request sent by the shell still belongs in the helper when the application hides a failure
of that request. In the reference, the version line drew a shorter line when the read request for it
failed. The response was therefore required only by the rule that every consumer is declared, since
nothing visible on the screen depended on it.

A second helper builds one fixture for a read request from a key, a path, a response, a query and a
policy, and uses the repeat policy by default. For each surface, a page-fixture builder combines the
read requests for the main record, the shell helper, and the read and write requests specific to
the surface. It also sets the count of every read request repeated by the reloads in the scene.

## Typed fixtures

Fixtures are typed against the data types of the application, imported from the application
source, and against the parameter types of its components. A fixture never uses an unchecked cast,
with at most one declared exception. Where a type in the application is narrower than what the wire
format and the display model accept, a fixture may widen exactly that one field, with a comment
giving the reason. The reference used this exception once, for a stored type code that lies outside
the closed union in the type definitions and is shown as stored by the display model.

Fixture content is synthetic and labeled as synthetic. Names, texts and help prose are written for
the fixture and never copied from authoritative documentation or real records. A fixture never
substitutes an empty value to remove a real affordance. The response to the help text request
contains entries for every field that shows help on the screen. The response to a share or link
request contains a synthetic stored link, so the normal affordances are drawn. Every address inside
a fixture uses a reserved domain that can never resolve, such as one under `.invalid`. Scenes never
navigate to such an address.

The edge values in fixtures are chosen deliberately. A fixture contains short and long
natural-language values, accented characters, one long unbroken value as a stress case, and a
second language with longer words. The state in a fixture is chosen for the tightest layout as
well: the longest labels drawn by the controls, such as the longest name of a mode or setting, and
the extra control that fills a row the most, such as an optional button drawn only in some states.
A record without an optional translation shows the fallback of the application. An empty state
comes from an empty model or an empty declared response. Missing fixture data never produces an
empty state.

## Runtime assertions on parsed data

Before the data boundary sends the first response from a fixture set, the set is validated with
runtime assertions on the parsed data: required envelopes, field types, enumeration values and the
consistency of referenced identifiers. The harness uses the runtime validators of the application
where they exist, and otherwise narrow ordinary assertions written for the bounded fixture set.
These assertions check parsed data. They do not decode the wire format a second time. Missing
optional data is allowed only when the scene declares that state.

Validation runs before the rendering engine starts, so a broken fixture fails the manifest before
any navigation. Every assertion message shows the key or field, with the instruction to curate the
fixture again.

## Drift checks

The validation compares a fixture set with the set expected by the scene, and fails on each of these
differences:

* a projection version that differs from the version the scene expects;
* a main record that fails its type assertions, or whose identifier is not the local alias;
* a missing response list, or a duplicate response key;
* a missing fixture key, shown in the message;
* a method, policy, count or declared status that differs from the expected one;
* a response for the main record that differs from the main record in the set;
* a help text response without an entry, a description or a read-only flag for a required field;
* any other read request, except held ones, whose response differs in envelope, type or content;
* a path or query that differs;
* a body of a write request that differs from the exact narrow patch asserted by the harness;
* an extra response key not expected by the scene;
* a referenced identifier that appears in none of the related responses.

A type change, a missing property used by a scene, an unexpected request or a missing required
response each fails visibly. The projection version of fixtures and samples is raised on every
incompatible change, and caches of an older version are invalidated. Absent fields are never filled
with plausible defaults.

## What drift checks cannot prove

Tolerant data helpers in the application can hide a wire change by filling a missing field with a
default, so scenes assert the expected rendered values and counts as well as successful requests.
Offline validation cannot prove that a live schema never seen by the harness is unchanged.
Validation reports list the two separately: offline compatibility as checked, live compatibility as
not verified.

## Web realization in the reference

The reference wrote the fixtures in TypeScript, imported the API types of the application, and used
the strict assertion module of the standard library for runtime assertions. The shell helper in the
reference returned nine responses: eight read requests with the repeat policy and one held
subscription. The page-fixture builder added the main record, the read requests related to it, the
help text request, a list request for one screen and one save operation.

## Native and terminal realizations

A native harness types the fixtures against the model classes of the application, such as data
classes or decodable structures. It decodes JSON fixtures with the decoder in the application, so a
renamed field fails at decoding. A terminal harness types the fixture files against the
configuration and data structures parsed by the application, and runs the parser of the application
over them in the validation step.

Fixture files are tracked. Validation output and any cached copies are written to the harness
directory inside the project cache, at the location defined by `workflow-skills:local-cache`.
