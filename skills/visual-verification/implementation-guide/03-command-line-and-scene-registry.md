# Part 3: the command line and the scene registry

The command line has six verbs: `list`, `scene`, `compare`, `sheet`, `test` and `refresh`. The
launcher of part 2 runs `test` through the runtime's test runner and every other verb through the
command-line module. The verb names here are the reference's; a project may name them differently,
and the set of responsibilities stays the same.

## The verbs and their options

The `list` verb prints every registered scene with its name and its one-sentence purpose. It takes
no arguments.

The `scene` verb runs one scene: every variant, every interaction, every check and every checkpoint,
and writes one capture. It takes exactly one scene name and accepts four options: a capture name, a
source revision to export the application from, a sample label that selects a real data sample of
part 13, and a port for the local server. Without a capture name, it generates a new unique name
from the scene name and a random identifier and prints it.

The `compare` verb compares two complete captures and is the verdict of part 10. It takes exactly
two capture names and no options.

The `sheet` verb renders the evidence sheet of part 12 from two captures. It takes exactly two
capture names, requires an output file option, and accepts a repeatable variant option that limits
the sheet to named variants.

The `test` verb runs the harness's own self-test suite of part 14.

The `refresh` verb fetches an optional real data sample of part 13. It takes exactly one scene name
and requires a sample label and a selection file option.

Every other option of a verb is refused, and so is a wrong number of positional arguments. The
refusal prints one usage line that lists every verb with its options, and exits nonzero. An option
that belongs to another verb is refused like an unknown one.

The command line uses the language's standard argument parser in its strict mode, with positional
arguments allowed. No handwritten argument parser is written, and the same holds for every
structured format the harness touches: JSON, URLs and query strings, HTML, tokens and images are
read and written with standard libraries.

Capture names and sample labels are checked against a short safe pattern before they reach the file
system. The reference allowed a letter or digit followed by up to a hundred letters, digits,
hyphens and underscores, and refused everything else with a message asking for a short name of those
characters.

A capture name is exclusive. A run under an existing capture name fails, and no command ever
overwrites a capture implicitly. Every repeated attempt uses a new name.

Error messages print the message alone, without a stack trace, and set a nonzero exit status. A
successful capture or comparison exits zero, and a failed one exits nonzero.

## The scene registry

Tracked scenes are registered in an explicit list inside the command-line module, each imported as
a typed module. The registry is the only place a tracked scene name resolves. An unknown name fails
with a message pointing to `list` and to curating a local scene.

The command line validates a scene before running it: its kind is a page or a component scene, it
declares at least one variant, and its projection version equals the version the harness currently
expects. A scene that fails any of these fails as an invalid typed scene.

## Untracked local scenes

Untracked exploratory scenes run without being staged. A local scene is a module inside a
local-scenes directory of the harness directory in the project cache, the location
`workflow-skills:local-cache` defines, with the scene file suffix the project uses. The command line
accepts such a path in place of a scene name, resolves it, and refuses it when the resolved path
leaves the local-scenes directory. Local scenes are trusted local code written by the user or an
agent in this checkout; the harness never loads a scene supplied from elsewhere, such as a plugin
downloaded at run time.

A local scene imports the tracked scenes' fixtures and mechanisms, changes only the variant or the
interactions its question needs, and keeps its selectors and expected outcomes inside itself. A
local scene is promoted to the tracked scenes only when it has been deliberately curated as part 16
and the skill's curation steps describe.

## The scene fingerprint

Every capture records a fingerprint of its scene, computed over the scene's local import graph. The
fingerprint starts at the scene module, hashes its bytes, and follows every relative import to the
imported module or data file, recursively, visiting each file once. Imports of packages are not
followed, since the dependency lock hash covers them. Each entry is keyed by its path relative to
the repository root, a file outside the root gets a fixed placeholder key, the entries are sorted by
key, and the fingerprint is a digest of the sorted list.

Imports are read with the language's own import resolution, never with a pattern match over the
source text. The reference used the TypeScript compiler's import preprocessor to list the imports of
a file and the compiler's module resolution, in its bundler mode with TypeScript extensions and JSON
modules allowed, to resolve each one. A relative import that does not resolve fails the run with a
message asking for explicit local imports.

The fingerprint includes the bytes of a local scene and of every local fixture it imports, so an
edited fixture changes the fingerprint even when nothing is staged. The runtime of part 6 computes
the fingerprint again after the run, and a difference invalidates the capture.

## Native and terminal realizations

A native or desktop harness keeps the same verbs, usually as tasks of the project's build tool or as
a small command-line program in the test source set, and the same registry of typed scene classes.
The scene fingerprint follows the language's own import or module graph where its tooling exposes
one, such as a compiler's dependency output; where it does not, each scene declares its fixture
files explicitly and the fingerprint hashes the scene source and every declared file. A terminal
harness written as a script uses the script language's own module resolution the same way.
