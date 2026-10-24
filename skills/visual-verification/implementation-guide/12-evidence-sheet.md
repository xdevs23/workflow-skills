# The evidence sheet

The evidence sheet is one PNG image for a person who reads a pull request. It shows two complete
captures of the same scene, one variant section after another, with every changed checkpoint side by
side. The sheet only shows the two captures and does not give a verdict. It never marks a pair as
passed or failed. The verdict comes from the comparison, with the compatibility
check, the semantic results and the nonzero exit for any difference.

The sheet skips the compatibility check on purpose. An edit to a translation or a fixture changes
the fingerprint that identifies the scene, so the comparison marks the two captures as
incompatible. The sheet still shows what that edit changed on screen. For every checkpoint, the
sheet compares pixels the same way as the comparison and recolors them with the diff coloring.

## The sheet for an intended input change

When a change alters a compatibility input on purpose, the comparison
refuses the pair as incompatible. The refusal is returned together with an evidence sheet of the
same two captures, rendered under an output name never used before. The outcome is judged by reading
that sheet, the two receipts and the measured checks of the after capture. The sheet still does not
give a verdict. A sheet larger than the size limit is split into several sheets with the variant
option, each under a different new output name.

## Refusals

The sheet refuses to run without the variables set by the launcher, with a message that contains the
launcher command.

The output option is required and must be the path of a file ending in `.png`. That file is never
overwritten. When the output file exists, the sheet refuses to run, with a message that contains the
instruction to choose a new output path. The output path is inside the project cache, the location
defined by `workflow-skills:local-cache`: in the harness directory, or in the directory prepared for
a batch of pull requests, which is inside the project cache as well.

When a capture does not exist, the sheet refuses to run, with a message that contains the capture
name and the instruction to capture it first. When the receipt of a capture is missing or
unreadable, the sheet refuses to run, with a message that contains the capture name and the
instruction to capture the complete scene again. When the receipt of a capture does not record a
source revision, the sheet refuses to run the same way with the capture name, since a sheet has to
show which commit each side comes from.

When the two captures show different scenes, the sheet refuses to run, with a message that contains
both capture names, the scene of each, and the instruction to capture the same scene twice.

When a requested variant is missing from the after capture, the sheet refuses to run, with a message
that lists the available variants. Without a variant option, the sheet covers every variant in the
after capture, in capture order. With one or more variant options, it covers only those variants.

When the finished sheet is larger than the size limit, the sheet is deleted and refused, with a
message that contains the limit and suggests the variant option for splitting the sheet into smaller
ones.

## Grouping

For each variant, the checkpoints are split into four groups. Changed checkpoints are present in
both captures and have at least one changed pixel or different dimensions. New checkpoints are
present only in the after capture. Identical checkpoints are present in both with zero changed
pixels. Before-only checkpoints are present only in the before capture.

A changed checkpoint with equal dimensions gets a changed count, a recolored difference image and a
region. The region is the bounding box of the changed pixels recorded by the diff coloring, grown by
a margin on each side and clamped to the image. A changed checkpoint with different dimensions gets
the note that the sizes differ in its caption, in place of a difference image.

## Layout

The sheet starts with the scene name as the title, followed by one line with the name and the short
revision of the before capture and of the after capture. Each variant section starts with the
variant name.

A section with changed checkpoints has a header row with the three column labels before, after and
region. Each changed checkpoint has a caption with the checkpoint name and the changed-pixel count,
grouped in thousands, or the note that the sizes differ. A row of three cells follows the caption.
The first cell is the before image. The second is the after image with the region outlined by a
solid border in the accent color, positioned in percent of the image so it scales with the cell. The
third contains three labeled strips cropped to the region: the before image, the after image and the
recolored difference.

New checkpoints follow as a grid of after images with the checkpoint names. Their heading reads that
the before capture has no baseline for them. Identical checkpoints follow as a grid of the same
kind, with a heading that reads that both captures are identical for them. Before-only checkpoints
are listed by name in one muted line. The sheet ends with the legend of the diff coloring.

The sheet is rendered as an HTML page with a fixed width, fixed colors and a locked font, opened in
the locked rendering engine at a pixel density of one, and captured as one full-page screenshot.
Every image is embedded in the page, so the page loads nothing from outside. A successful run prints
the path of the written sheet, relative to the working directory.

## Numbers and their reasons

The reference used a cell width of 870 pixels, a gap of 24 pixels and a page padding of 40 pixels,
which made the sheet exactly 2,738 pixels wide: three cells, two gaps and the padding on both sides.
The self-test suite asserts that width. The region margin was 24 pixels. The page background was
`#f6f6f7`, the text `#1a1a1c`, secondary text `#6b6b70` and the accent `#d3202a`. The outline was 3
pixels wide. The body text was 20 pixels in DejaVu Sans, a font from the locked fallback set, with
headings at 40, 32 and 24 pixels and strip labels at 16 pixels.

The size limit was 10 MiB, the largest image attachment accepted by the pull request host used in
the reference. A project uses the limit set by the pull request host used by the project.

## Attaching sheets to a pull request

A project that requires visual evidence attaches one sheet for every changed surface, built from a
capture on the base commit of the pull request and one on the candidate commit. The sheets are
prepared before the pull request is created. They are listed as attachments of the pull request and
shown in the description under a separate heading.

The pull request host used in the reference uploaded attachments only through the create command of
the host command-line client. A sheet added after creation therefore needed a new draft or a
comment. The publisher used in the reference accepted at most 50 attachments per pull request. Each
attachment had to be a nonempty PNG, JPEG, GIF or WebP file of at most 10 MiB inside the directory
prepared for the batch, listed once, and referenced in the description by the exact listed path. On
creation, the client rewrote those references to the uploaded addresses. A later update of the
description left them unchanged and uploaded nothing again. When any entry of a batch had
attachments, the publisher checked once that the installed client supported them. Otherwise it
failed the whole batch with a message that contained the capability found and the capability
required.

A pull request that affects rendered output and comes without a sheet is complete only when none of
its commits changes rendered output and its description mentions that. A surface that does not yet
have a scene gets one first, tracked or local, before the pull request is prepared. For a surface
missing on the base commit, the form of the sheet for that surface is decided while the scene for it
is curated. The sheet either shows a capture of what the base commit shows at the same place, or
shows the checkpoints of the candidate commit as new.

## Web realization in the reference

The reference built the HTML of the sheet with the server-side renderer of the interface framework
used by the reference. It decoded and cropped images with `pngjs`, opened the page in the locked
Chromium through Playwright with a viewport as wide as the sheet, waited for the fonts of the
document to load and took a full-page screenshot. The sheet was written to the output path given by
the caller. For a batch of pull requests, that path was inside the directory prepared for the
batch.

## Native and terminal realizations

The sheet works on PNG captures and is the same on every platform. When the harness of a project
does not include a browser engine, the project either composes the sheet with an image library and
draws the captions with a locked font file, or adds a locked headless browser only for rendering
sheets. The sheet reads the captures from the harness directory inside the project cache, the
location defined by `workflow-skills:local-cache`.
