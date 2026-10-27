# Fixtures and drift

Fixtures = data rendered by every scene. Drift = difference that appears when real data shapes of
application change and fixtures do not. Harness makes drift fail visibly at two points: statically,
when fixtures stop type checking against types of application, and at run time, when rendered
screen consumes something not declared by fixtures.

## The shared shell responses

One helper builds responses for shell of application. Every page scene builds on it. Read requests
sent by shell = those listed by survey: navigation badges and counters, version line, account or
organization switchers, health signals, held subscriptions. Scene that needs different shell state,
e.g. switcher drawn because account belongs to several organizations, declares that state
explicitly through helper. Adaptation point: read requests sent by shell.

Read request sent by shell still belongs in helper when application hides failure of that request.
In reference, version line drew shorter line when read request for it failed. Response was therefore
required only by rule that every consumer is declared, since nothing visible on screen depended on
it.

Second helper builds one fixture for read request from key, path, response, query and policy. Uses
repeat policy by default. For each surface, page-fixture builder combines read requests for main
record, shell helper, and read and write requests specific to surface. Also sets count of every
read request repeated by reloads in scene.

## Typed fixtures

Fixtures typed against data types of application, imported from application source, and against
parameter types of its components. Fixture never uses unchecked cast, with at most one declared
exception. Where type in application is narrower than what wire format and display model accept,
fixture may widen exactly that one field, with comment giving reason. Reference used this exception
once, for stored type code that lies outside closed union in type definitions and is shown as
stored by display model.

Fixture content synthetic, labeled as synthetic. Names, texts and help prose written for fixture,
never copied from authoritative documentation or real records. Fixture never substitutes empty
value to remove real affordance. Response to help text request contains entries for every field
that shows help on screen. Response to share or link request contains synthetic stored link, so
normal affordances are drawn. Every address inside fixture uses reserved domain that can never
resolve, e.g. one under `.invalid`. Scenes never navigate to such address.

Edge values in fixtures chosen deliberately. Fixture contains short and long natural-language
values, accented characters, one long unbroken value as stress case, second language with longer
words. State in fixture chosen for tightest layout as well: longest labels drawn by controls, e.g.
longest name of mode or setting, and extra control that fills row the most, e.g. optional button
drawn only in some states. Record without optional translation shows fallback of application. Empty
state comes from empty model or empty declared response. Missing fixture data never produces empty
state.

## Runtime assertions on parsed data

Before data boundary sends first response from fixture set, that set gets validated with runtime
assertions on parsed data: required envelopes, field types, enumeration values, consistency of
referenced identifiers. Harness uses runtime validators of application where they exist, otherwise
narrow ordinary assertions written for bounded fixture set. These assertions check parsed data. They
do not decode wire format a second time. Missing optional data allowed only when scene declares that
state.

Validation runs before rendering engine starts, so broken fixture fails manifest before any
navigation. Every assertion message shows key or field, with instruction to curate fixture again.

## Drift checks

Validation compares fixture set with set expected by scene, fails on each of these differences:

* projection version that differs from version expected by scene;
* main record that fails its type assertions, or whose identifier is not local alias;
* missing response list, or duplicate response key;
* missing fixture key, shown in message;
* method, policy, count or declared status that differs from expected one;
* response for main record that differs from main record in set;
* help text response without entry, description or read-only flag for required field;
* any other read request, except held ones, whose response differs in envelope, type or content;
* path or query that differs;
* body of write request that differs from exact narrow patch asserted by harness;
* extra response key not expected by scene;
* referenced identifier that appears in none of related responses.

Type change, missing property used by scene, unexpected request or missing required response: each
fails visibly. Projection version of fixtures and samples raised on every incompatible change.
Caches of older version invalidated. Absent fields never filled with plausible defaults.

## What drift checks cannot prove

Tolerant data helpers in application can hide wire change by filling missing field with default.
So scenes assert expected rendered values and counts as well as successful requests. Offline
validation cannot prove that live schema never seen by harness is unchanged. Validation reports list
the two separately: offline compatibility as checked, live compatibility as not verified.

## Web realization in the reference

Reference wrote fixtures in TypeScript, imported API types of application, used strict assertion
module of standard library for runtime assertions. Shell helper in reference returned nine
responses: eight read requests with repeat policy, one held subscription. Page-fixture builder
added main record, read requests related to it, help text request, list request for one screen, one
save operation.

## Native and terminal realizations

Native harness types fixtures against model classes of application, e.g. data classes or decodable
structures. Decodes JSON fixtures with decoder in application, so renamed field fails at decoding.
Terminal harness types fixture files against configuration and data structures parsed by
application, runs parser of application over them in validation step.

Fixture files tracked. Validation output and any cached copies written to harness directory inside
project cache, at location defined by `workflow-skills:local-cache`.
