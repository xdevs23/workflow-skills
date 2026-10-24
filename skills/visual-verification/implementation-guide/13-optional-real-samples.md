# Optional real samples

Synthetic scenes are mandatory and run without credentials. Samples of real data are an optional
source of evidence. The harness is proven without them. A harness may ship without the refresh
verb. When it has one, every rule in this part applies.

## Selecting a sample

Sample labels, such as small, average and loaded, are labels picked by the user for a selection.
They do not claim anything about statistics and do not permit scanning records. A selection file
lists a bounded set of record identifiers, the related identifiers needed by the screen, and the
exact read operations allowed. The refresh does not crawl through pages, change data, log in,
refresh a token automatically or discover endpoints.

A page sample is a manifest of every response needed by the screen. A saved main record alone is
not a page sample. A page sample may reference static synthetic shell responses explicitly. The
provenance of those responses is still recorded as synthetic, and a capture that uses them is
labeled mixed, never a wholly live page. A required real response never silently falls back to
synthetic data.

The selection file contains a format version, the name of the set of projected responses, the
selected record identifier, the exact list of operations with key, method and path, and a list that
marks every remaining response key as synthetic. Before it sends a request, the refresh fails on any
other operation and on any synthetic key missing from that list. The selection file contains
identifiers only, never credentials.

The selected record identifier is percent-encoded when it is inserted into the path of the allowed
operation. The list of operations in the selection must match that exact encoded operation. An
identifier with reserved characters therefore can never lead to a different path than the one
listed in the selection.

## Read-only operations

Before a refresh operation is enabled, the code or documentation of the service is checked to
confirm that the operation is read-only. A read method alone does not prove that. Operations that
generate content, create sessions or have other side effects on read are excluded. Rendering never
runs a refresh operation.

## Credentials and transport

The credential is short-lived and supplied at run time through a dedicated environment variable or
another protected input, never as a command argument, in a committed file or inside the rendering
context. The launcher passes it only to the refresh verb. The service origin is
supplied explicitly and must be a bare encrypted origin. It uses the secure scheme and does not
contain user information, a path beyond the root, a query or a fragment. The allowlist of
endpoints is exact.

The refresh denies redirects. It fails on any response with a status other than success and on any
redirected response. Only a successful response that was not redirected is projected. The refresh
sends the credential only to that origin. It does not inherit the general deployment environment. It
never prints headers, bodies, tokens, query identifiers or raw service errors. When a request fails,
the refresh reports that it is incomplete, that raw service errors are not logged on purpose and
that the complete samples already present are unchanged. A request waits for its response or for its
connection to fail, never for a time limit. The connections use TCP keepalive, so a service that is
gone fails the connection on the probe schedule of the operating system. A service that keeps the
connection open without answering keeps the refresh waiting until the user who runs it stops it.

## Projection

Each decoded response is projected right away through an allowlist of fields defined per operation.
Decoding uses the standard JSON decoder and then explicit assertions on types and shapes. A custom
parser is never used. The projection contains the displayed fields and the relationships needed by
the scene. It excludes email addresses, contact details, the bodies of sessions and reports,
unrelated organization fields, attachment metadata and unused private text. A service response is
never serialized as a whole.

Displayed names under inspection are part of the projection and are stored only in the local cache.
Data altered for safety is labeled projected or redacted and never described as verbatim live
evidence. Identity links are replaced consistently with local aliases where possible. Addresses of
external media are removed. Alternatively, assets that were selected explicitly and obtained safely
are mapped to local fixture addresses. Rendering never downloads them.

A projection has a name and a version, such as the scene name with a version suffix. It also has a
written description of its content: which fields of which record it contains, which aliases it
uses, what it removes and which synthetic responses it includes. The provenance of a projection is
mixed-projected. A scene gets a projection only after the scene is curated. The refresh and the
sample reader fail on a scene that does not have a projection.

## Publication

Every response and every required manifest entry is validated before a sample is published, with the
same validation as a fixture set. Before its first request, the refresh creates a fresh directory
and writes into it a manifest that marks the sample as incomplete. Only after validation does it
write the responses and a complete manifest, and then it moves the directory to the label. The step
that moves the directory fails when a sample with that label exists, so a complete sample is never
overwritten in place.

Publishing another profile under a label already used by a complete sample needs a deliberate step
first: retain the existing sample, or manage the local cache explicitly, such as by removing that
sample by hand. The refresh performs neither step automatically. The output of a failed, stopped or
partial refresh is left in the directory marked incomplete, since the mark is written before the
first request. It is visibly unusable and can never be selected.

The manifest contains the projection version, the completeness, the overall provenance, the capture
time, the provenance and a content hash for each response key, and the hash of the whole response
set. Neither the manifest nor any receipt ever contains credentials.

## Using a sample

A capture selects a sample by label. The refresh command runs as a separate process with explicit
permission to use the network. The scene verb, the compare verb and a cache miss never start it, so
a missing sample never triggers a refresh. The sample reader checks:

* the label;
* the version in the manifest;
* that the sample is complete;
* that the hash of the response set matches the manifest;
* the validation against the set of responses expected by the scene, with the main record from the
  sample substituted;
* the mixed provenance.

To use a real sample, supply the origin and the credential, run the refresh, remove the credential
from the environment, and then capture with the sample label.

## Privacy of artifacts

Samples, selections, screenshots, HTML reports, difference images, engine profiles, optional traces
and logs are stored in the harness directory inside the project cache, the location defined by
`workflow-skills:local-cache`. Everything that contains sample data is stored with restrictive
permissions. Screenshots and reports are private as well. Traces and verbose logs are off by
default. When they are enabled explicitly for diagnosis, credentials are redacted in them and the
artifacts are never published.

Only synthetic fixtures and scene definitions are committed. A regression found with real data is
promoted by curating a synthetic equivalent that reproduces the observed failure. Private records
are never copied into version control.

## The verification boundary

Whether credentialed samples are fresh, whether live payloads are compatible and how live data looks
on screen are unverified until an authorized refresh actually runs. The harness contract in the
project records them as unverified. Local fixtures prove that results are reproducible. They prove
nothing about the state of production. A successful refresh prints that the sample was published
locally with its provenance and that a refresh does not verify live visual compatibility.

Without credentials or a selection, the refresh fails before any request, with actionable
instructions that list the missing inputs. A capture never starts the refresh. The self-test suite
checks the refresh against a synthetic transport. It cannot verify a
credentialed refresh.

## Web realization in the reference

The reference curated one projection for the first page scene. The projection contained the map of
displayed names and the short descriptions of the selected record, used local aliases for identity
and related records, removed external media, and included synthetic background text and shell
responses. The refresh took the transport as a parameter, with the fetch function of the platform as
the default, so the self-test suite could pass a synthetic one. It authenticated with a bearer token
header and asked for JSON. It inserted the selected identifier into the path of the read operation
with the standard URI component encoding and sent the request with redirects set to fail. It
accepted only a response with a success status that had not been redirected.

## Native and terminal realizations

A sample refresh is a separate program in any stack, independent of the rendering platform. A native
or terminal harness hands the published sample to the application through the same data boundary as
the synthetic fixtures, so the application cannot tell the two apart.
