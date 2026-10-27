# Receipts and fingerprints

Every capture writes receipt next to its images. Receipt contains everything that affects pixels.
Later comparison can then prove two captures differ only where meant to differ. Reader also sees
what was captured without running anything. Receipt written as indented JSON, private file
permissions, into capture directory, inside harness directory in project cache, at location defined
by `workflow-skills:local-cache`.

## The fields

Receipt contains format version and scene name, then four groups of fields.

Compatibility group contains everything that must be identical between two captures for comparison
to be meaningful:

* scene fingerprint over local import graph of scene;
* hash of harness code;
* projection version of fixtures, and digest of fixture set for every variant. Digest covers
  response hashes and, for real sample, hash and provenance of sample;
* variants with all their settings: size, container width, locale, theme;
* hash of dependency lock of selected application source, hash of dependency lock of harness, hash
  of environment lock;
* system type, runtime versions, version of rendering engine, hash of engine executable;
* hash of font configuration, hashes of shipped font assets;
* fixed settings: pixel density, timezone, instants at which clock is installed and paused, frame
  interval of clock, motion preference, animation and caret settings of screenshot, screenshot
  scale, comparison options.

Source group contains fully resolved revision of application source. For capture of working tree,
also fingerprint of relevant content of working tree and fingerprint of staged changes. For capture
exported from revision, both fingerprints empty. Group also contains path of export directory,
relative to harness directory.

For every checkpoint, checkpoints group contains: checkpoint name joined with variant name, file
name of image, what was captured, readiness record from stability check, every measurement with its
predicate, result, actual values and diagnostic flag. Interactions performed by scene are identified
by checkpoints to which they lead.

Run group contains every failure message; record written by data boundary for each variant, with
required keys, matched and delivered counts, held keys, failures, pending local assets; whether
inputs were stable during capture.

Capture passes when inputs did not change, zero failures recorded, at least one checkpoint present,
and every measurement that is not diagnostic passed.

## What a receipt never contains

Receipt never contains real authentication state, absolute paths on machine or raw private payloads.
Paths relative to repository root or harness directory. Before failure message stored, repository
path in it replaced with placeholder. Real sample enters receipt only through its hash, never
through its content.

## The application fingerprint

Application fingerprint covers relevant inputs in working tree: tracked files and untracked files
not ignored, filtered to application inputs as defined by survey. Each file hashed. Tracked file no
longer existing recorded as deleted. Fingerprint = digest of sorted list. Staged changes
fingerprinted separately, as hash of binary diff of index for same inputs, so both staged and
unstaged changes covered. Resolved revision of commit checked out in working tree recorded next to
them.

Ignored output artifacts and dependency caches excluded from application fingerprint. Scene or
sample in ignored directory, explicitly selected for this capture, included through its hash, in
scene fingerprint or fixture digest.

## Fingerprints before and after

Inputs fingerprinted before capture and again after: application fingerprint, hash of harness code,
scene fingerprint, digest of fixture data, with selected sample read again from disk. Difference in
any of them means source or fixture changed during capture. Capture then invalid. Input that became
unreadable invalidates capture as well. Images and measurements already written = evidence of what
happened. They never count as pass.

## Digests

Every digest = cryptographic hash of canonical serialization. Reference hashed file bytes with
SHA-256. Hashed structured values by hashing their JSON serialization. Hashed directory by hashing
sorted list of names of its entries, each with file hash or directory hash of that entry.

## Web realization in the reference

Reference listed application inputs with version control command that lists cached files and other
files not ignored. Filtered that list to source and public directories, entry document, build and
type checker configurations, package manifest and lock of application. Hashed index with binary
cached diff of those paths. Recorded runtime versions by running each runtime with its version flag,
engine version same way, and hash of engine executable. Shipped fonts recorded as hash of directory
of variable font package and hash of monospace font file.

## Native and terminal realizations

Native receipt contains inputs of application build, recorded same way, plus identity of emulator or
simulator: system image or runtime version, device profile, hash of installed application package
built from snapshot. Receipt from in-process renderer contains toolkit version from dependency lock
and settings of renderer. Terminal receipt contains version and executable hash of terminal
emulator, hash of font file, terminal size, and terminal type and color variables seen by
application.
