# Part 9: receipts and fingerprints

Every capture writes a receipt beside its images. The receipt records everything that decides the
pixels, so a later comparison can prove that two captures differ only in what they are meant to
differ in, and so a reader can see what was captured without running anything. It is written as
indented JSON with private file permissions in the capture's directory, inside the harness directory
in the project cache, the location `workflow-skills:local-cache` defines.

## The fields

The receipt carries a format version and the scene name, then four groups of fields.

The compatibility group holds everything that must be identical between two captures for a
comparison to be meaningful:

* the scene fingerprint over its local import graph, from part 3;
* a hash of the harness's own code;
* the projection version of the fixtures, and a digest of every variant's fixture set, which covers
  the response hashes and, for a real sample, the sample's own hash and provenance;
* the variants with all their settings: size, container width, locale and theme;
* the hash of the selected application source's dependency lock, the hash of the harness's
  dependency lock and the hash of the environment lock;
* the system type, the runtime versions, the rendering engine's version and a hash of the engine
  executable;
* the hash of the font configuration and the hashes of the shipped font assets;
* the fixed settings: pixel density, timezone, the clock's install and pause instants, the motion
  preference, the animation and caret settings of the screenshot, the screenshot scale and the
  comparison options of part 10.

The source group holds the fully resolved revision of the application source, and for a capture of
the working tree a fingerprint of the relevant working content and a fingerprint of the staged
changes. For a capture exported from a revision, both fingerprints are empty, since the export is
exactly that revision. The group also holds the export's path relative to the harness directory.

The checkpoints group holds, for every checkpoint, its name joined with its variant, its image file
name, what was captured, the readiness record of the stability check, and every measurement with its
predicate, result, actual values and diagnostic flag. The interactions a scene performed are named
by the checkpoints they lead to.

The run group holds every failure message, the per-variant record of the data boundary from part 5,
with required keys, matched and delivered counts, held keys, failures and pending local assets, and
whether the inputs stayed stable during the capture.

A capture passes when its inputs stayed stable, it recorded no failure, it holds at least one
checkpoint, and every measurement that is not diagnostic passed.

## What a receipt never contains

A receipt never contains real authentication state, absolute paths of the machine or raw private
payloads. Paths are relative to the repository root or to the harness directory, and failure
messages replace the repository path with a placeholder before they are stored. A real sample enters
the receipt only through its hash, never through its content.

## The application fingerprint

The application fingerprint covers the relevant inputs of the working tree: the tracked files and
the untracked files that are not ignored, filtered to the application's inputs as the survey defined
them. Each file is hashed, a tracked file that no longer exists is recorded as deleted, and the
fingerprint is a digest of the sorted list. Staged changes are fingerprinted separately, as a hash
of the binary diff of the index for the same inputs, so staged and unstaged changes are both
covered. The resolved revision of the working tree's commit is recorded beside them.

Ignored output artifacts and dependency caches are excluded from the application fingerprint. A
scene or sample that lives in an ignored directory and was explicitly selected for this capture is
included through its own hash, in the scene fingerprint or the fixture digest.

## Fingerprints before and after

The inputs are fingerprinted before the capture and again after it: the application fingerprint,
the hash of the harness code, the scene fingerprint and the digest of the fixture data, reading a
selected sample again from disk. A difference in any of them means the source or a fixture changed
during the capture, and the capture is invalid. An input that became unreadable invalidates the
capture as well. The images and measurements already written stay as evidence of what happened; they
never pass.

## Digests

Every digest is a cryptographic hash of a canonical serialization. The reference hashed file bytes
with SHA-256, hashed structured values by hashing their JSON serialization, and hashed a directory
by hashing the sorted list of its entries' names with each entry's file hash or directory hash.

## Web realization in the reference

The reference listed the application's inputs with the version control system's file listing of
cached and other non-ignored files, filtered to its source and public directories, its entry
document, its build and type checker configurations, its package manifest and its lock. It hashed
the index with a binary cached diff of those paths. It recorded the runtime versions by running each
runtime with its version flag, the engine's version the same way, and the engine executable's hash.
Its shipped fonts were recorded as the hash of the variable font package's directory and of the
monospace font file.

## Native and terminal realizations

A native receipt records the application build's inputs the same way, and adds the emulator or
simulator identity: the system image or runtime version, the device profile, and the hash of the
installed application package built from the snapshot. A receipt of an in-process renderer records
the toolkit version from the dependency lock and the renderer's own settings. A terminal receipt
records the terminal emulator's version and executable hash, the font file hash, the terminal size,
and the terminal type and color variables the application saw.
