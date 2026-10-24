# The command line and the scene registry

The command line has six verbs: `list`, `scene`, `compare`, `sheet`, `test` and `refresh`. The
launcher runs `test` through the test runner of the runtime, and every other
verb through the command-line module. The verb names here come from the reference. A project may
name them differently, but the set of responsibilities is the same.

## The verbs and their options

The `list` verb prints every registered scene with its name and its one-sentence purpose. It takes
no arguments.

The `scene` verb runs one scene: every variant, every interaction, every check and every checkpoint,
and writes one capture. It takes exactly one scene name and accepts four options: a capture name, a
source revision to export the application from, a sample label that selects a real data sample,
and a port for the local server. Without a capture name, it generates a new
unique name from the scene name and a random identifier and prints it.

The `compare` verb compares two complete captures and gives the verdict. It
takes exactly two capture names and rejects every option.

The `sheet` verb renders the evidence sheet from two captures. It accepts
exactly two capture names, requires an output file option, and accepts a repeatable variant option
that limits the sheet to named variants.

The `test` verb runs the self-test suite of the harness.

The `refresh` verb fetches an optional real data sample. It accepts exactly one
scene name and requires a sample label and a selection file option.

The command line rejects every other option of a verb and a wrong number of positional arguments.
It then prints one usage line that lists every verb with its options, and exits nonzero. An option
of another verb is rejected like an unknown one.

The command line uses the standard argument parser of the language in its strict mode, with
positional arguments allowed. Every structured format used by
the harness is read and written with standard libraries: JSON, URLs and query strings, HTML, tokens
and images.

Capture names and sample labels are checked against a short safe pattern before they are used in
the file system. The reference allowed a letter or digit followed by up to a hundred letters,
digits, hyphens and underscores. It rejected everything else with an error message requesting a
short name made of those characters.

Each capture name is used once. A run under an existing capture name fails. A command never
overwrites a capture implicitly. Every repeated attempt uses a new name.

An error prints its message alone, without a stack trace, and sets a nonzero exit status. A
successful capture or comparison exits zero, and a failed one exits nonzero.

## The scene registry

Tracked scenes are registered in an explicit list inside the command-line module, each imported as
a typed module. The registry is the only place where the name of a tracked scene resolves. An
unknown name fails with a message pointing to `list` and to curating a local scene.

The module file of a tracked scene is named after the scene, with the scene file suffix used in the
project, such as `<scene name>.scene.ts` in the reference. The command line finds that file from the
scene name to compute the scene fingerprint. A module whose file name differs from its scene name is
fingerprinted from the wrong file or from none.

The command line validates a scene before running it: its kind is a page or a component scene, it
declares at least one variant, and it declares the version of the projection that the harness
currently expects. A scene that fails any of these checks fails as an invalid typed scene.

## Untracked local scenes

Untracked exploratory scenes run without being staged. A local scene is a module inside the
local-scenes directory within the harness directory in the project cache, the location defined by
`workflow-skills:local-cache`, with the scene file suffix used in the project. The command line
accepts such a path in place of a scene name, resolves it, and rejects it when the resolved path is
outside the local-scenes directory. Local scenes are trusted local code, written by the user or an
agent in this checkout. The harness never loads a scene supplied from elsewhere, such as a plugin
downloaded at run time.

A local scene imports fixtures and mechanisms from the tracked scenes, changes only the variant or
the interactions needed by its question, and contains its selectors and expected outcomes itself. A
local scene is promoted to the tracked scenes only after deliberate curation, as described in the
part on the records in the project and in the curation steps of the skill.

## The scene fingerprint

Every capture records a fingerprint of the scene it captured, computed over the local import graph
of the scene. The computation starts at the scene module, hashes its bytes, and follows every
relative import to the imported module or data file, recursively, visiting each file once. Imports
of packages are not followed. The hash of the dependency lock covers them. Each entry is keyed by
its path relative to the repository root. A file outside the root gets a fixed placeholder key. The
entries are sorted by key, and the fingerprint is a digest of the sorted list.

Imports are read with the import resolution of the language tooling, never with a pattern match
over the source text. The reference used the import preprocessor of the TypeScript compiler to list
the imports of a file, and the module resolution of the compiler, in bundler mode with TypeScript
extensions and JSON modules allowed, to resolve each one. A relative import that does not resolve
fails the run with a message requesting explicit local imports.

The fingerprint includes the bytes of a local scene and of every local fixture imported by it. An
edited fixture changes the fingerprint even when nothing is staged. The runtime
computes the fingerprint again after the run, and a difference invalidates the capture.

## Native and terminal realizations

A native or desktop harness has the same verbs, usually as tasks of the build tool used in the
project or as a small command-line program in the test source set, and the same registry of typed
scene classes. The scene fingerprint follows the import or module graph of the language where the
language tooling exposes one, such as the dependency output of a compiler. Where the tooling does
not, each scene declares the fixture files it uses explicitly, and the fingerprint hashes the scene
source and every declared file. A terminal harness written as a script uses the module resolution of
the script language the same way.
