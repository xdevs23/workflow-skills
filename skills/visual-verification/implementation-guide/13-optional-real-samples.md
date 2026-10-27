# Optional real samples

Synthetic scenes mandatory, run without credentials. Samples of real data: optional source of
evidence. Harness proven without them. Harness may ship without refresh verb. When it has one, every
rule in this part applies.

## Selecting a sample

Sample labels such as small, average and loaded: labels picked by user for a selection. Labels claim
nothing about statistics and do not permit scanning records. Selection file lists bounded set of
record identifiers, related identifiers needed by screen, and exact read operations allowed. Refresh
does not crawl through pages, change data, log in, refresh token automatically or discover
endpoints.

Page sample: manifest of every response needed by screen. Saved main record alone is not a page
sample. Page sample may reference static synthetic shell responses explicitly. Provenance of those
responses still recorded as synthetic. Capture using them labeled mixed, never wholly live page.
Required real response never silently falls back to synthetic data.

Selection file contains format version, name of set of projected responses, selected record
identifier, exact list of operations with key, method and path, and list marking every remaining
response key as synthetic. Before sending a request, refresh fails on any other operation and on any
synthetic key missing from that list. Selection file contains identifiers only, never credentials.

Selected record identifier percent-encoded when inserted into path of allowed operation. List of
operations in selection must match that exact encoded operation. So identifier with reserved
characters can never lead to a path other than the one listed in selection.

## Read-only operations

Before refresh operation enabled, code or documentation of service checked to confirm operation
read-only. Read method alone does not prove that. Operations that generate content, create sessions
or have other side effects on read: excluded. Rendering never runs refresh operation.

## Credentials and transport

Credential short-lived, supplied at run time on standard input. Never as command argument, in
environment variable, in committed file or inside rendering context. Launcher passes it only to
refresh verb. Service origin supplied explicitly, must be bare encrypted origin: secure scheme,
without user information, path beyond root, query or fragment. Allowlist of endpoints exact.

Refresh denies redirects. Fails on any response with status other than success and on any redirected
response. Only successful response that was not redirected gets projected. Refresh sends credential
only to that origin. Does not inherit general deployment environment. Never prints headers, bodies,
tokens, query identifiers or raw service errors. When request fails, refresh reports that it is
incomplete, that raw service errors are not logged on purpose and that complete samples already
present are unchanged.
Request waits for response or for connection to fail, never for a time limit. Connections use TCP
keepalive, so service that is gone fails connection on probe schedule of operating system. Service
keeping connection open without answering makes refresh wait until user running it stops it.

## Projection

Each decoded response projected right away through allowlist of fields defined per operation.
Decoding: standard JSON decoder, then explicit assertions on types and shapes. Projection contains
displayed fields and relationships needed by scene. Excludes email addresses, contact details,
bodies of sessions and reports, unrelated organization fields, attachment metadata and unused
private text. Service response never serialized as a whole.

Displayed names under inspection part of projection, stored only in local cache. Data altered for
safety labeled projected or redacted, never described as verbatim live evidence. Identity links
replaced consistently with local aliases where possible. Addresses of external media removed.
Alternatively, assets selected explicitly and obtained safely mapped to local fixture addresses.
Rendering never downloads them.

Projection has name and version, e.g. scene name with version suffix. Also written description of
content: which fields of which record it contains, which aliases it uses, what it removes, which
synthetic responses it includes. Provenance of projection: mixed-projected. Scene gets projection
only after scene curated. Refresh and sample reader fail on scene without projection.

## Publication

Every response and every required manifest entry validated before sample published, same validation
as fixture set. Before first request, refresh creates fresh directory, writes into it manifest
marking sample incomplete. Only after validation, refresh writes responses and complete manifest,
then moves directory to label. Step moving directory fails when sample with that label exists, so
complete sample never overwritten in place.

Publishing another profile under label already used by complete sample needs deliberate step first:
retain existing sample, or manage local cache explicitly, e.g. remove that sample by hand. Refresh
performs neither step automatically. Output of failed, stopped or partial refresh left in directory
marked incomplete, since mark written before first request. Visibly unusable, can never be selected.

Manifest contains projection version, completeness, overall provenance, capture time, provenance and
content hash for each response key, and hash of whole response set. Neither manifest nor any receipt
ever contains credentials.

## Using a sample

Capture selects sample by label. Refresh command runs as separate process with explicit permission
to use network. Scene verb, compare verb and cache miss never start it, so missing sample never
triggers refresh. Sample reader checks:

* label;
* version in manifest;
* that sample complete;
* that hash of response set matches manifest;
* validation against set of responses expected by scene, with main record from sample substituted;
* mixed provenance.

To use real sample: supply origin and credential, run refresh, remove credential from environment,
then capture with sample label.

## Privacy of artifacts

Samples, selections, screenshots, HTML reports, difference images, engine profiles, optional traces
and logs stored in harness directory inside project cache, location defined by
`workflow-skills:local-cache`. Everything containing sample data stored with restrictive
permissions. Screenshots and reports private too. Traces and verbose logs off by default. When
enabled explicitly for diagnosis, credentials redacted in them, artifacts never published.

Only synthetic fixtures and scene definitions committed. Regression found with real data promoted by
curating synthetic equivalent that reproduces observed failure. Private records never copied into
version control.

## The verification boundary

Whether credentialed samples fresh, whether live payloads compatible, how live data looks on screen:
unverified until authorized refresh actually runs. Harness contract in project records them as
unverified. Local fixtures prove results reproducible. Prove nothing about state of production.
Successful refresh prints: sample published locally with provenance, refresh does not verify live
visual compatibility.

Without credentials or selection, refresh fails before any request, with actionable instructions
listing missing inputs. Capture never starts refresh. Self-test suite checks refresh against
synthetic transport. Cannot verify credentialed refresh.

## Web realization in the reference

Reference curated one projection for first page scene. Projection contained map of displayed names
and short descriptions of selected record, used local aliases for identity and related records,
removed external media, included synthetic background text and shell responses. Refresh took
transport as parameter, with fetch function of platform as default, so self-test suite could pass
synthetic one. Authenticated with bearer token header, asked for JSON. Inserted selected identifier
into path of read operation with standard URI component encoding. Sent request with redirects set to
fail. Accepted only response with success status that had not been redirected.

## Native and terminal realizations

Sample refresh: separate program in any stack, independent of rendering platform. Native or terminal
harness hands published sample to application through same data boundary as synthetic fixtures, so
application cannot tell the two apart.
