# The command line and the scene registry

Command line has six verbs: `list`, `scene`, `compare`, `sheet`, `test` and `refresh`. Launcher
runs `test` through test runner of runtime, every other verb through command-line module. Verb names
here come from reference. Project may name them differently, but set of responsibilities is same.

## The verbs and their options

`list` verb prints every registered scene with its name and one-sentence purpose. Does not
accept any arguments.

`scene` verb runs one scene: every variant, every interaction, every check, every checkpoint. Writes
one capture. Expects exactly one scene name, accepts four options: capture name, source revision
from which to export application, sample label that selects real data sample, port for local server.
Without capture name, generates new unique name from scene name and random identifier, prints it.

`compare` verb compares two complete captures, gives verdict. Expects exactly two capture names,
rejects every option.

`sheet` verb renders evidence sheet from two captures. Accepts exactly two capture names, requires
output file option, accepts repeatable variant option that limits sheet to named variants.

`test` verb runs self-test suite of harness.

`refresh` verb fetches optional real data sample. Accepts exactly one scene name, requires sample
label and selection file option.

Command line rejects every other option of a verb and wrong number of positional arguments. Then
prints one usage line listing every verb with its options, exits nonzero. Option of another verb
rejected like unknown one.

Command line uses standard argument parser of language in its strict mode, positional arguments
allowed. Every structured format used by harness read and written with standard libraries: JSON,
URLs and query strings, HTML, tokens, images.

Capture names and sample labels checked against short safe pattern before use in file system.
Reference allowed letter or digit followed by up to a hundred letters, digits, hyphens and
underscores. Rejected everything else with error message requesting short name made of those
characters.

Each capture name used once. Run under existing capture name fails. Command never overwrites
capture implicitly. Every repeated attempt uses new name.

Error prints its message alone, without stack trace, sets nonzero exit status. Successful capture or
comparison exits zero, failed one exits nonzero.

## The scene registry

Tracked scenes registered in explicit list inside command-line module, each imported as typed
module. Registry: only place where name of tracked scene resolves. Unknown name fails with message
pointing to `list` and to curating local scene.

Module file of tracked scene named after scene, with scene file suffix used in project, e.g.
`<scene name>.scene.ts` in reference. Command line finds that file from scene name to compute scene
fingerprint. Module whose file name differs from its scene name gets fingerprinted from wrong file
or from none.

Command line validates scene before running it: kind is page or component scene, declares at least
one variant, declares version of projection currently expected by harness. Scene failing any of
these checks fails as invalid typed scene.

## Untracked local scenes

Untracked exploratory scenes run without being staged. Local scene: module inside local-scenes
directory within harness directory in project cache, location defined by
`workflow-skills:local-cache`, with scene file suffix used in project. Command line accepts such
path in place of scene name, resolves it, rejects it when resolved path lies outside local-scenes
directory. Local scenes: trusted local code, written by user or agent in this checkout. Harness
never loads scene supplied from elsewhere, e.g. plugin downloaded at run time.

Local scene imports fixtures and mechanisms from tracked scenes, changes only variant or
interactions needed by its question, contains its selectors and expected outcomes itself. Local
scene promoted to tracked scenes only after deliberate curation, as described in part on records in
project and in curation steps of skill.

## The scene fingerprint

Every capture records fingerprint of scene captured by it, computed over local import graph of
scene. Computation starts at scene module, hashes its bytes, follows every relative import to
imported module or data file, recursively, visiting each file once. Imports of packages not
followed. Hash of dependency lock covers them. Each entry keyed by its path relative to repository
root. File outside root gets fixed placeholder key. Entries sorted by key. Fingerprint: digest of
sorted list.

Imports read with import resolution of language tooling, never with pattern match over source text.
Reference used import preprocessor of TypeScript compiler to list imports of a file, and module
resolution of compiler, in bundler mode with TypeScript extensions and JSON modules allowed, to
resolve each one. Relative import that does not resolve fails run with message requesting explicit
local imports.

Fingerprint includes bytes of local scene and of every local fixture imported by it. Edited fixture
changes fingerprint even when nothing staged. Runtime computes fingerprint again after run.
Difference invalidates capture.

## Native and terminal realizations

Native or desktop harness has same verbs, usually as tasks of build tool used in project or as
small command-line program in test source set, and same registry of typed scene classes. Scene
fingerprint follows import or module graph of language where language tooling exposes one, e.g.
dependency output of compiler. Where tooling does not, each scene declares fixture files used by it
explicitly, and fingerprint hashes scene source and every declared file. Terminal harness written as
script uses module resolution of script language same way.
