# Part 12: the evidence sheet

The evidence sheet is one PNG image for a person reading a pull request. It shows two complete
captures of the same scene, one variant section after another, with every changed checkpoint side by
side. It is a view of the two captures and carries no verdict: it never passes or fails a pair, and
the comparison of part 10 stays the verdict with its compatibility check, semantic results and
nonzero exit for any difference.

The sheet deliberately skips the compatibility check. An edit to a translation or a fixture changes
the scene fingerprint, which makes the two captures incompatible for the comparison, and the sheet
still shows what that edit did on screen. It uses the same pixel comparison and the same recoloring
of part 11 for every checkpoint.

## The sheet for an intended input change

A change that alters a compatibility input on purpose, as part 10 describes, makes the comparison
refuse its pair. The refusal is returned together with an evidence sheet of the same two captures,
rendered under an output name never used before, and the outcome is judged by reading that sheet,
the two receipts and the after capture's measured checks. The sheet still carries no verdict. A
sheet larger than the size limit is split into several sheets through the variant option, each
under its own new output name.

## Refusals

The sheet refuses to run without the launcher's variables, and names the launcher command.

The output option is required, must name a file ending in `.png`, and is never overwritten. An
existing output file fails with a message asking for a new output path. The output path lies inside
the project cache, the location `workflow-skills:local-cache` defines: in the harness directory, or
in the prepared directory of a pull request batch that is kept inside the project cache as well.

A capture that does not exist is refused by name, with the instruction to capture it first. A
capture without a readable receipt is refused by name, with the instruction to capture the complete
scene again. A capture whose receipt carries no source revision is refused by name the same way,
since a sheet has to say which commit each side shows.

Two captures of different scenes are refused, and the message names both captures with their scene
names and asks for the same scene to be captured twice.

A requested variant that the after capture does not contain is refused, and the message lists the
variants that are available. Without a variant option the sheet covers every variant of the after
capture, in capture order; with one or more, it covers only those.

A finished sheet larger than the size limit is deleted and refused, with a message naming the limit
and suggesting the variant option to split the sheet into smaller ones.

## Grouping

For each variant, the checkpoints are split into four groups. Changed checkpoints are present in
both captures and have at least one changed pixel or different dimensions. New checkpoints are
present only in the after capture. Identical checkpoints are present in both with zero changed
pixels. Before-only checkpoints are present only in the before capture.

A changed checkpoint of equal dimensions gets its changed count, its recolored difference image and
a region: the bounding box of its changed pixels from part 11, grown by a margin on each side and
clamped to the image. A changed checkpoint of different dimensions gets no difference image, and
its caption says the sizes differ.

## Layout

The sheet opens with the scene name as its title and one line naming the before capture with its
short revision and the after capture with its short revision. Each variant section opens with the
variant name.

A section with changed checkpoints has a header row with the three column labels before, after and
region. Each changed checkpoint has a caption with its name and its changed-pixel count, grouped in
thousands, or the note that the sizes differ, followed by a row of three cells. The first cell is
the before image. The second is the after image with the region outlined by a solid border in the
accent color, positioned in percent of the image so it scales with the cell. The third holds three
labeled strips cropped to the region: the before image, the after image and the recolored
difference.

New checkpoints follow under a heading saying they have no baseline in the before capture, as a grid
of their after images with their names. Identical checkpoints follow under a heading saying both
captures are identical for them, as a grid of the same kind. Before-only checkpoints are named in
one muted line. The sheet ends with the legend of part 11.

The sheet is rendered as an HTML page with a fixed width, fixed colors and a locked font, opened in
the locked rendering engine at a pixel density of one, and captured as one full-page screenshot.
Every image is embedded; nothing external loads. A successful run prints the written sheet's path
relative to the working directory.

## Numbers and their reasons

The reference used a cell width of 870 pixels, a gap of 24 pixels and a page padding of 40 pixels,
which made the sheet exactly 2,738 pixels wide: three cells, two gaps and the padding on both sides.
The self-test suite asserts that width. The region margin was 24 pixels. The page background was
`#f6f6f7`, the text `#1a1a1c`, secondary text `#6b6b70` and the accent `#d3202a`; the outline was
3 pixels wide. The body text was 20 pixels in DejaVu Sans, a font of the locked fallback set, with
headings at 40, 32 and 24 pixels and strip labels at 16 pixels.

The size limit was 10 MiB, the largest image attachment the reference's pull request host accepted.
A project uses its own host's limit.

## Attaching sheets to a pull request

A project that requires visual evidence attaches one sheet for every changed surface, built from a
capture on the pull request's base commit and one on its candidate. The sheets are prepared before
the pull request is created, listed as its attachments, and shown in its description under a heading
of their own. The reference's host uploaded attachments only through its command-line client's
create command, so a sheet added after creation meant a new draft or a comment. The reference's
publisher accepted, per pull request, at most 50 attachments, each a nonempty PNG, JPEG, GIF or WebP
file of at most 10 MiB inside the prepared batch's directory, listed once, and referenced in the
description by its exact listed path; the client rewrote those references to the uploaded addresses
on creation, and a later update of the description kept them without uploading again. When any
entry of a batch carried attachments, the publisher checked once that the installed client supported
them and refused the whole batch otherwise, naming the found and the required capability.

A pull request that touches rendered output without a sheet is complete only when none of its
commits changes rendered output, and its description says so. A surface without a scene gets one
first, tracked or local, before the pull request is prepared. A surface that does not exist on the
base has its sheet form decided while its scene is curated: either a capture of what the base shows
at the same place, or the candidate's checkpoints shown as new.

## Web realization in the reference

The reference built the sheet's HTML with the server-side renderer of its interface framework,
decoded and cropped images with `pngjs`, opened the page in the locked Chromium through Playwright
with a viewport of the sheet width, waited for the document's fonts, and took a full-page
screenshot. The sheet was written to the output path the caller gave, which for a pull request batch
was inside that batch's prepared directory.

## Native and terminal realizations

The sheet works on PNG captures and is the same for every platform. A project without a browser
engine in its harness composes the sheet with an image library instead, drawing its captions with a
locked font file, or adds a locked headless browser only for rendering sheets. The captures it reads
live in the harness directory inside the project cache, the location `workflow-skills:local-cache`
defines.
