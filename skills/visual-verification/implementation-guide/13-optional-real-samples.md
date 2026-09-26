# Part 13: optional real samples

Synthetic scenes are mandatory and need no credentials. Real data samples are an optional evidence
source, never a prerequisite for proving the harness. A harness may ship without the refresh verb at
all; when it has one, every rule of this part applies.

## Selecting a sample

Sample labels, such as small, average and loaded, are labels the user picks for a selection. They
make no statistical claim and grant no permission to scan records. A selection file names a bounded
set of record identifiers, the related identifiers the screen needs, and the exact read operations
allowed. The refresh performs no pagination crawling, no mutation, no login flow, no automatic token
refresh and no endpoint discovery.

A page sample is a manifest of every response the screen needs, never a saved main record alone.
Static synthetic shell responses may be referenced explicitly and keep their synthetic provenance,
and such a capture is labeled mixed, never a wholly live page. A required real response never
silently falls back to synthetic data.

The selection file carries a format version, the name of the response set it projects, the selected
record identifier, the exact list of operations with key, method and path, and a list that
explicitly names every remaining response key as synthetic. The refresh refuses any other operation,
and any missing acknowledgement of a synthetic key, before making a request. It carries identifiers
only, never credentials.

The selected record identifier is percent-encoded when it is inserted into the path of the allowed
operation, and the selection's operation list must match that exact encoded operation. An
identifier with reserved characters therefore can never reach a different path than the one the
selection names.

## Read-only operations

Before a refresh operation is enabled, its semantics are verified to be read-only in the service's
code or documentation; a read method alone is no proof. Operations that generate content, create
sessions or have other side effects on read are excluded. Rendering never runs a refresh operation.

## Credentials and transport

The credential is short-lived and supplied at run time through a dedicated environment variable or
another protected input, never as a command argument, in a committed file or inside the rendering
context. The launcher of part 2 passes it only to the refresh verb. The service origin is supplied
explicitly and must be a bare encrypted origin: the secure scheme, no user information, no path
beyond the root, no query and no fragment. The endpoint allowlist is exact.

The refresh denies redirects and fails on any response with a non-success status as well as on a
redirected response; only a successful, non-redirected read is projected. It forwards the credential
only to that origin. It does not inherit the general deployment environment, and never prints
headers, bodies, tokens, query identifiers or raw service errors. A failed read reports that the
refresh is incomplete, that raw service errors are deliberately not logged and that existing
complete samples are unchanged. Every request has a timeout; the reference used fifteen seconds.

## Projection

Decoded responses are projected immediately through per-operation field allowlists. Decoding uses
the standard JSON decoder followed by explicit type and shape assertions, never a custom parser. The
projection keeps the displayed fields and the relationships the scene needs, and excludes email
addresses, contact details, the bodies of sessions and reports, unrelated organization fields,
attachment metadata and unused private text. Service responses are never serialized wholesale.

Displayed names that are the subject of inspection are kept, and only in the local cache. Data
altered for safety is labeled projected or redacted and never described as verbatim live evidence.
Identity links are replaced consistently with local aliases where possible. External media
addresses are removed, or explicitly selected and safely obtained assets are mapped to local fixture
addresses; rendering never downloads them.

A projection has a name and a version, such as the scene name with a version suffix, and a stated
content: which fields of which record it keeps, which aliases it uses, what it removes and which
synthetic responses it retains. Its provenance is mixed-projected. A scene gets a projection only
after it is curated; the refresh and the sample reader refuse a scene without one.

## Publication

Every response and every required manifest entry is validated before a sample is published, with
the same validation as part 8. The refresh writes into a fresh directory marked incomplete, first
with a manifest that says so, and only after validation writes the responses and a complete
manifest, then moves the directory to its label. The move fails when a sample with that label
exists, so a complete sample is never overwritten in place. Publishing another profile under a label
that already holds a complete sample requires a deliberate step first: retain the existing sample,
or explicitly manage the local cache, such as by removing that sample by hand. The refresh takes
neither step on its own. A failed or partial refresh stays in its incomplete directory, visibly
unusable, and can never be selected.

The manifest records the projection version, completeness, the provenance, the capture time, for
each response key its provenance and a content hash, and the hash of the whole response set. It
never records credentials, and neither does any receipt.

## Using a sample

A capture selects a sample by label. The refresh is a separate process that is explicitly allowed to
use the network: the scene verb, the compare verb and a cache miss never invoke it, so a missing
sample never triggers a refresh. The reader checks
the label, the manifest's version, that the sample is complete, that the response set's hash matches
the manifest, the validation against the scene's expected set with the sample's main record
substituted, and the mixed provenance. The flow is: supply the origin and the credential, run the
refresh, remove the credential from the environment, then capture with the sample label.

## Privacy of artifacts

Samples, selections, screenshots, HTML reports, difference images, engine profiles, optional traces
and logs are stored in the harness directory inside the project cache, the location
`workflow-skills:local-cache` defines, with restrictive permissions for everything that carries
sample data. Screenshots and reports are private as well. Traces and verbose logs stay off by
default; when explicitly enabled for diagnosis, credentials are redacted and the artifacts are never
published.

Only synthetic fixtures and scene definitions are committed. A regression found with real data is
promoted by curating a synthetic equivalent that reproduces the observed failure; private records
are never copied into version control.

## The verification boundary

Credentialed sample freshness, live payload compatibility and live visual outcomes stay unverified
until an authorized refresh is actually run, and the project's harness contract says so. Local
fixtures establish reproducibility; they say nothing about the state of production. A successful
refresh prints that the sample was published locally with its provenance and that live visual
compatibility is not verified by a refresh.

Without credentials or a selection, the refresh fails with actionable instructions naming the
missing inputs, before any request, and a capture never invokes it. The self-test suite of part 14
checks the refresh against a synthetic transport, and cannot verify a credentialed refresh.

## Web realization in the reference

The reference curated one projection for its first page scene. It kept the selected record's
displayed name map and short descriptions, used local aliases for identity and related records,
removed external media, and retained synthetic background text and shell responses. The refresh
took the transport as a parameter, defaulting to the platform's fetch function, so the self-test
suite could pass a synthetic one. It authenticated with a bearer token header and asked for JSON.
It inserted the selected identifier into the read path with the standard URI component encoding,
requested with redirects set to fail, and accepted only a response whose status was a success and
which had not been redirected.

## Native and terminal realizations

A sample refresh is a separate program in any stack, independent of the rendering platform. A native
or terminal harness serves the published sample through the same data boundary as its synthetic
fixtures, so the application cannot tell the two apart.
