# Part 9: receipts and fingerprints

Every capture writes a receipt next to its images. The receipt contains everything that affects the
pixels. A later comparison can then prove that two captures differ only where they are meant to
differ. A reader can also see what was captured without running anything. The receipt is written as
indented JSON with private file permissions into the capture directory, inside the harness directory
in the project cache, at the location defined by `workflow-skills:local-cache`.

## The fields

The receipt contains a format version and the scene name, followed by four groups of fields.

The compatibility group contains everything that must be identical between two captures for a
comparison to be meaningful:

* the scene fingerprint over the local import graph of the scene, from part 3;
* a hash of the harness code;
* the projection version of the fixtures, and a digest of the fixture set for every variant, which
  covers the response hashes and, for a real sample, the hash and provenance of the sample;
* the variants with all their settings: size, container width, locale and theme;
* the hash of the dependency lock of the selected application source, the hash of the dependency
  lock of the harness and the hash of the environment lock;
* the system type, the runtime versions, the version of the rendering engine and a hash of the
  engine executable;
* the hash of the font configuration and the hashes of the shipped font assets;
* the fixed settings: pixel density, timezone, the instants at which the clock is installed and
  paused, the frame interval of the clock, the motion preference, the animation and caret settings
  of the screenshot, the screenshot scale and the comparison options of part 10.

The source group contains the fully resolved revision of the application source. For a capture of
the working tree, it also contains a fingerprint of the relevant content of the working tree and a
fingerprint of the staged changes. For a capture exported from a revision, both fingerprints are
empty. The group also contains the path of the export directory, relative to the harness directory.

For every checkpoint, the checkpoints group contains the checkpoint name joined with the variant
name, the file name of the image, what was captured, the readiness record from the stability check,
and every measurement with its predicate, result, actual values and diagnostic flag. The
interactions performed by a scene are identified by the checkpoints they lead to.

The run group contains every failure message, the record written by the data boundary of part 5
for each variant, with required keys, matched and delivered counts, held keys, failures and pending
local assets, and whether the inputs were stable during the capture.

A capture passes when the inputs did not change, zero failures were recorded, it contains at least
one checkpoint, and every measurement that is not diagnostic passed.

## What a receipt never contains

A receipt never contains real authentication state, absolute paths on the machine or raw private
payloads. Paths are relative to the repository root or to the harness directory. Before a failure
message is stored, the repository path in it is replaced with a placeholder. A real sample enters
the receipt only through its hash, never through its content.

## The application fingerprint

The application fingerprint covers the relevant inputs in the working tree: the tracked files and
the untracked files that are not ignored, filtered to the application inputs as defined by the
survey. Each file is hashed, and a tracked file that no longer exists is recorded as deleted. The
fingerprint is a digest of the sorted list. Staged changes are fingerprinted separately, as a hash
of the binary diff of the index for the same inputs, so staged and unstaged changes are both
covered. The resolved revision of the commit checked out in the working tree is recorded next to
them.

Ignored output artifacts and dependency caches are excluded from the application fingerprint. A
scene or sample in an ignored directory that was explicitly selected for this capture is included
through its hash, in the scene fingerprint or the fixture digest.

## Fingerprints before and after

The inputs are fingerprinted before the capture and again after it: the application fingerprint,
the hash of the harness code, the scene fingerprint and the digest of the fixture data, with a
selected sample read again from disk. A difference in any of them means the source or a fixture
changed during the capture, which makes the capture invalid. An input that became unreadable
invalidates the capture as well. The images and measurements already written are evidence of what
happened, and they never count as a pass.

## Digests

Every digest is a cryptographic hash of a canonical serialization. The reference hashed file bytes
with SHA-256, hashed structured values by hashing their JSON serialization, and hashed a directory
by hashing the sorted list of the names of its entries, each with the file hash or directory hash
of that entry.

## Web realization in the reference

The reference listed the application inputs with the command of the version control system that
lists cached files and other files that are not ignored. It filtered that list to the source and
public directories, the entry document, the build and type checker configurations, the package
manifest and the lock of the application. It hashed the index with a binary cached diff of those
paths. It recorded the runtime versions by running each runtime with its version flag, recorded the
version of the engine the same way, and recorded the hash of the engine executable. The shipped
fonts were recorded as the hash of the directory of the variable font package and the hash of the
monospace font file.

## Native and terminal realizations

A native receipt contains the inputs of the application build, recorded the same way, and adds the
identity of the emulator or simulator: the system image or runtime version, the device profile, and
the hash of the installed application package built from the snapshot. A receipt from an in-process
renderer contains the toolkit version from the dependency lock and the settings of the renderer. A
terminal receipt contains the version and executable hash of the terminal emulator, the hash of the
font file, the terminal size, and the terminal type and color variables seen by the application.
