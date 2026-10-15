# Part 10: comparison and reports

The comparison is the verdict. It takes two complete captures, checks that they are compatible,
compares every checkpoint pixel by pixel, and exits nonzero for any difference. An intended change
is still a difference to be reviewed by a person. The comparison never marks a baseline as
approved. The harness never updates, overwrites or promotes a capture automatically.

## The compatibility check

Two captures are compatible when their receipts have the same format version and the same scene
name, and when the compatibility groups of part 9 in both receipts are identical, compared as
digests. The check is strict and expects the same scene fingerprint, fixture data, harness code,
locks, runtime, engine, fonts, variants, clock and capture settings. The application source may
differ. The comparison records that difference and never rejects the pair because of it.

Two captures with different application dependency locks are incompatible. The harness never
reuses old dependencies for the new source to make two captures look comparable. An incompatible
pair fails with a message listing what must be identical, together with the instruction to take a
capture with identical controlled inputs.

The two captures must contain the same set of checkpoint names, without duplicates and with at
least one checkpoint. A missing or extra checkpoint fails the comparison with the instruction to run
the complete scene.

## Intended input changes

A change can alter a compatibility input on purpose, such as a translation, a fixture, the scene
module or a dependency lock. The user's words for the unit of work identify such a change before the
work starts. The comparison fails such a pair as incompatible, like any other incompatible pair. It
is still the strict automatic verdict. It is never loosened for an input changed on purpose.

The result for the incompatible pair is returned together with an evidence sheet of part 12, built
from the same two captures. The comparison of an incompatible pair checks nothing. The outcome is
therefore judged by reading that sheet, the two receipts, and the measured checks of the after
capture in its receipt and report.

## Checkpoint comparison

Checkpoints are matched by name, never by file order. Each pair of images is decoded with a PNG
library. Images of different dimensions fail the comparison with the instruction to capture
identical checkpoint bounds. They are never scaled or cropped to fit.

The comparison component counts the changed pixels and produces a mask that marks every changed
pixel. It uses fixed options, recorded by the harness in every comparison result and in every
receipt. The permitted number of changed pixels is zero. It is never raised, whether automatically,
per scene or to make a run pass. Two clean captures of the same scene with the same settings give
zero changed pixels.

For each checkpoint, the result contains the checkpoint name, the number of changed pixels, the
number for each kind of change from part 11, the ratio of changed pixels to the image area, the
measurements of both captures and the name of the difference image. Any changed pixel makes the
comparison fail.

Semantic checks complement the pixel comparison and are independent of it. A comparison fails when
either capture failed its checks, even with zero changed pixels. A pair with passing checks still
fails on any changed pixel.

The comparison exits nonzero for incompatible receipts, missing checkpoints, different dimensions,
failed checks and changed pixels. Each of these failures is visible in the report of the
comparison.

## Outputs

A comparison writes the results into a comparison directory named after the two captures, inside
the harness directory in the project cache, at the location defined by
`workflow-skills:local-cache`. The directory is created exclusively, so a comparison name, like a
capture name, is never reused. The directory contains a difference image for each checkpoint, a
structured result file and an HTML report. The result file contains both capture names, the
verdict, the comparison options, the coloring parameters and every checkpoint result. The command
prints the verdict and the path of the report, relative to the working directory.

## Reports

Every capture and every comparison has an HTML report. A capture report starts with the verdict. It
then shows the failures, the records from the data boundary and whether the inputs were stable,
followed by the image of every checkpoint with its measurements. A comparison report starts with
the verdict. On failure, the verdict reports that a difference was found and that no baseline
has been approved. The report then shows the legend of part 11
and, for each checkpoint, the before image, the after image and the difference image side by side,
with the result for that checkpoint below them.

Reports are self-contained. Images are embedded as data addresses, and a report does not load any
external script, style sheet, font or image. Every label is escaped. Scene names, predicates and
measured text can contain markup characters. Reports are generated with a templating or rendering
library that escapes by default. They are never built by joining strings. Reports are written with
private permissions.

## Numbers and their reasons

The reference compared with a threshold of 0.1, which is the default perceptual color distance in
the library below which two pixels count as equal. It counted anti-aliased pixels as changes, since
detecting and ignoring them would hide edge changes of text and borders, which are exactly the
shifts produced by a layout defect. It drew the unchanged pixels of the difference image as the
before image in grayscale, blended halfway towards white with an alpha of 0.5, so the difference
image still shows where on the screen a change is. For the same reason, it did not draw the mask
alone on a transparent background. A different comparison component uses options chosen for the
same effects and records them the same way.

## Web realization in the reference

The reference decoded images with `pngjs` and compared them with `pixelmatch`. It rendered the
reports with the server-side renderer of the interface framework used by the reference, which
escapes text by default. It embedded every image as a base64 data address.

## Native and terminal realizations

The comparison is the same for every platform once the capture is a PNG. Some test frameworks for
native toolkits ship a snapshot comparison. A native harness uses that comparison only when it
offers a mode that allows zero differences, the number of changed pixels and a mask of changed
pixels. A framework that only returns pass or fail within a tolerance does not meet this part, so
the harness compares the PNGs itself. A terminal harness can also compare the screen buffers cell
by cell, which shows the rows and columns that changed. The PNG comparison is still the verdict on
what a person sees.
