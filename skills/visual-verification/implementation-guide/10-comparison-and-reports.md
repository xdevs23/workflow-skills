# Comparison and reports

Comparison = verdict. Expects two complete captures, checks they are compatible, compares every
checkpoint pixel by pixel, exits nonzero for any difference. Intended change is still a difference,
to be reviewed by a person. Comparison never marks baseline as approved. Harness never updates,
overwrites or promotes capture automatically.

## The compatibility check

Two captures compatible when receipts have same format version and same scene name, and
compatibility groups in both receipts identical, compared as digests. Check strict: expects same
scene fingerprint, fixture data, harness code, locks, runtime, engine, fonts, variants, clock and
capture settings. Application source may differ. Comparison records that difference, never rejects
pair because of it.

Two captures with different application dependency locks are incompatible. Harness never reuses old
dependencies for new source to make two captures look comparable. Incompatible pair fails with
message listing what must be identical, plus instruction to take capture with identical controlled
inputs.

Two captures must contain same set of checkpoint names, without duplicates, at least one checkpoint.
Missing or extra checkpoint fails comparison with instruction to run complete scene.

## Intended input changes

Change can alter compatibility input on purpose, e.g. translation, fixture, scene module or
dependency lock. User's words for unit of work identify such change before work starts. Comparison
fails such pair as incompatible, like any other incompatible pair. Still strict automatic verdict.
Never loosened for input changed on purpose.

Result for incompatible pair returned together with evidence sheet built from same two captures.
Comparison of incompatible pair checks nothing. Outcome therefore judged by reading that sheet, two
receipts, and measured checks of after capture in its receipt and report.

## Checkpoint comparison

Checkpoints matched by name, never by file order. Each pair of images decoded with PNG library.
Images of different dimensions fail comparison with instruction to capture identical checkpoint
bounds. Never scaled or cropped to fit.

Comparison component counts changed pixels, produces mask marking every changed pixel. Uses fixed
options, recorded by harness in every comparison result and every receipt. Permitted number of
changed pixels: zero. Never raised automatically, per scene or to make run pass. Two clean
captures of same scene with same settings give zero changed pixels.

For each checkpoint, result contains: checkpoint name, number of changed pixels, number for each
kind of change from diff coloring, ratio of changed pixels to image area, measurements of both
captures, name of difference image. Any changed pixel fails comparison.

Semantic checks complement pixel comparison, independent of it. Comparison fails when either capture
failed its checks, even with zero changed pixels. Pair with passing checks still fails on any
changed pixel.

Comparison exits nonzero for incompatible receipts, missing checkpoints, different dimensions,
failed checks and changed pixels. Each of these failures visible in comparison report.

## Outputs

Comparison writes results into comparison directory named after two captures, inside harness
directory in project cache, at location defined by `workflow-skills:local-cache`. Directory created
exclusively, so comparison name, like capture name, never reused. Directory contains difference
image for each checkpoint, structured result file, HTML report. Result file contains both capture
names, verdict, comparison options, coloring parameters, every checkpoint result. Command prints
verdict and path of report, relative to working directory.

## Reports

Every capture and every comparison has HTML report. Capture report starts with verdict. Then shows
failures, records from data boundary, whether inputs were stable, then image of every checkpoint
with its measurements. Comparison report starts with verdict. On failure, verdict reports that
difference was found and that no baseline has been approved. Then shows legend of diff coloring and,
for each checkpoint, before image, after image and difference image side by side, with result for
that checkpoint below them.

Reports self-contained. Images embedded as data addresses. Report does not load any external script,
style sheet, font or image. Every label escaped. Scene names, predicates and measured text can
contain markup characters. Reports generated with templating or rendering library that escapes by
default. Reports written with private permissions.

## Numbers and their reasons

Two pixels count as equal only when library does not measure any color distance between them:
threshold of zero. Library comparing by perceptual color distance, as the one used by reference
does, blends pixel not fully opaque with white before measuring. Two pixels then count as equal when
identical after that blending. Locked environment gives same pixels for same inputs, so threshold
above zero does not have any noise to absorb and would only hide small change of color. Reference
counted anti-aliased pixels as changes, since detecting and ignoring them would hide edge changes of
text and borders, exactly the shifts produced by layout defect. Drew unchanged pixels of difference
image as before image in grayscale, blended halfway towards white with alpha 0.5, so difference
image still shows where on screen a change is. For same reason, did not draw mask alone on
transparent background. Different comparison component uses options chosen for same effects and
records them same way.

## Web realization in the reference

Reference decoded images with `pngjs`, compared them with `pixelmatch`. Rendered reports with
server-side renderer of interface framework used by reference, which escapes text by default.
Embedded every image as base64 data address.

## Native and terminal realizations

Comparison same for every platform once capture is PNG. Some test frameworks for native toolkits
ship snapshot comparison. Native harness uses that comparison only when it offers mode that allows
zero differences, number of changed pixels and mask of changed pixels. Framework that only returns
pass or fail within tolerance does not meet this part, so harness compares PNGs itself. Terminal
harness can also compare screen buffers cell by cell, showing rows and columns that changed. PNG
comparison is still the verdict on what a person sees.
