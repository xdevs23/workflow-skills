# Part 10: comparison and reports

The comparison is the verdict. It takes two complete captures, checks that they are compatible,
compares every checkpoint pixel by pixel, and exits nonzero for any difference. An intended change
is still a difference that a person reviews; the comparison never approves a baseline, and nothing
in the harness updates, overwrites or promotes a capture automatically.

## The compatibility check

Two captures are compatible when their receipt format versions are the same, their scene names are
the same, and their compatibility groups of part 9 are identical, compared as digests. The check is
strict: the same scene fingerprint, fixture data, harness code, locks, runtime, engine, fonts,
variants, clock and capture settings. The application source may differ, since that difference is
the change under review, and the comparison records it; it never rejects it.

Captures whose application dependency locks differ are incompatible. The harness never reuses old
dependencies for the new source to make two captures look comparable. An incompatible pair fails
with a message naming what must be identical and asking for a capture with identical controlled
inputs.

The two captures must hold the same set of checkpoint names, with no duplicates and at least one
checkpoint. A missing or extra checkpoint fails with a message asking for the complete scene to be
run.

## Intended input changes

A change can alter a compatibility input on purpose, such as a translation, a fixture, the scene
module or a dependency lock. The unit of work says so in its criterion before the change starts. The
comparison refuses its pair like any other incompatible pair and stays the strict automatic verdict.
It is never loosened for an input changed on purpose, since a check that accepts some changed
inputs is no longer the strict verdict.

The refusal is returned together with an evidence sheet of part 12 built from the same two captures.
The outcome is judged by reading that sheet, the two receipts and the after capture's own measured
checks in its receipt and report, since the refused comparison checks nothing.

## Checkpoint comparison

Checkpoints are matched by name, never by file order. Each pair of images is decoded with a PNG
library. Images of different dimensions fail the comparison with a message asking for identical
checkpoint bounds; they are never scaled or cropped to fit.

The comparison component counts the changed pixels and produces a per-pixel change mask with fixed
options that the harness records in every comparison result and in every receipt. The permitted
changed-pixel count is zero, and it is never raised, whether automatically, per scene or to make
a run pass. Two clean captures of the same scene with the same settings give zero changed
pixels; a tolerance would hide exactly the one-pixel shifts the harness exists to find.

For each checkpoint the result records the checkpoint name, the changed-pixel count, the counts per
kind of change from part 11, the changed ratio of the image area, the measurements of both captures
and the name of the difference image. Any changed pixel makes the comparison fail.

Semantic checks complement pixels and stay independent of them. A comparison fails when either
capture failed its own checks, even with zero changed pixels, and a pair with passing checks still
fails on any changed pixel.

The comparison exits nonzero for incompatible receipts, missing checkpoints, different dimensions,
failed checks and changed pixels. Every one of these is visible in its report.

## Outputs

A comparison writes its results into a comparison directory named after the two captures, inside the
harness directory in the project cache, the location `workflow-skills:local-cache` defines. The
directory is created exclusively, so a comparison name, like a capture name, is never reused. It
holds a difference image per checkpoint, a structured result file with both capture names, the
verdict, the comparison options, the coloring parameters and every checkpoint result, and an HTML
report. The command prints the verdict and the report's path relative to the working directory.

## Reports

Every capture and every comparison has an HTML report. A capture report opens with the verdict,
shows the failures, the data boundary records and whether the inputs stayed stable, and then shows
every checkpoint's image with its measurements. A comparison report opens with the verdict, which
on failure says that a difference was found and that no baseline has been approved, then shows the
legend of part 11, and then for each checkpoint the before image, the after image and the
difference image side by side, with the checkpoint's result below them.

Reports are self-contained. Images are embedded as data addresses, no external script, style sheet,
font or image is loaded, and every label is escaped, because scene names, predicates and measured
text can contain markup characters. Reports are generated with a templating or rendering library
that escapes by default, never by joining strings. Reports are written with private permissions,
since screenshots of real samples are private.

## Numbers and their reasons

The reference compared with a threshold of 0.1, the library's default perceptual color distance
below which two pixels count as equal. It counted anti-aliased pixels as changes, since detecting
and ignoring them would hide edge changes of text and borders, which are exactly the shifts a layout
defect produces. It drew the unchanged pixels of the difference image as the before image in
grayscale, blended halfway towards white with an alpha of 0.5, so the difference image still shows
where on the screen a change sits, and for the same reason it did not draw the mask alone on a
transparent background. A different comparison component uses its own options chosen for the same
effects and records them the same way.

## Web realization in the reference

The reference decoded images with `pngjs` and compared them with `pixelmatch`. It rendered its
reports with the server-side renderer of its own interface framework, which escapes text by default,
and embedded every image as a base64 data address.

## Native and terminal realizations

The comparison is the same for every platform once the capture is a PNG. A native harness whose test
framework ships its own snapshot comparison uses it only when it exposes a zero-difference mode, the
changed-pixel count and a per-pixel mask; a framework that only answers pass or fail within a
tolerance does not meet this part, and the harness compares the PNGs itself. A terminal harness can
additionally compare the screen buffers cell by cell, which names the rows and columns that changed,
and keeps the PNG comparison as the verdict of what a person sees.
