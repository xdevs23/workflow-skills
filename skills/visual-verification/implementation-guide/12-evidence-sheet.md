# The evidence sheet

Evidence sheet = one PNG image for person reading pull request. Shows two complete captures of same
scene, one variant section after another, every changed checkpoint side by side. Sheet only shows
two captures, does not give verdict. Never marks pair as passed or failed. Verdict comes from
comparison, with compatibility check, semantic results and nonzero exit for any difference.

Sheet skips compatibility check on purpose. Edit to translation or fixture changes fingerprint that
identifies scene, so comparison marks two captures incompatible. Sheet still shows what that edit
changed on screen. For every checkpoint, sheet compares pixels same way as comparison and recolors
them with diff coloring.

## The sheet for an intended input change

When change alters compatibility input on purpose, comparison rejects pair as incompatible. Refusal
returned together with evidence sheet of same two captures, rendered under output name never used
before. Outcome judged by reading that sheet, two receipts and measured checks of after capture.
Sheet still does not give verdict. Sheet larger than size limit split into several sheets with
variant option, each under different new output name.

## Refusals

Sheet does not run without variables set by launcher, with message containing launcher command.

Output option required, must be path of file ending in `.png`. That file never overwritten. When
output file exists, sheet does not run, with message containing instruction to choose new output
path. Output path inside project cache, location defined by `workflow-skills:local-cache`: in
harness directory, or in directory prepared for batch of pull requests, also inside project cache.

When capture does not exist, sheet does not run, message containing capture name and instruction
to capture it first. When receipt of capture missing or unreadable, sheet does not run, message
containing capture name and instruction to capture complete scene again. When receipt of capture
does not record source revision, sheet does not run same way with capture name, since sheet has to
show which commit each side comes from.

When two captures show different scenes, sheet does not run, message containing both capture
names, scene of each, and instruction to capture same scene twice.

When requested variant missing from after capture, sheet does not run, message listing available
variants. Without variant option, sheet covers every variant in after capture, in capture order.
With one or more variant options, covers only those variants.

When finished sheet larger than size limit, sheet deleted and refused, message containing limit and
suggesting variant option for splitting sheet into smaller ones.

## Grouping

For each variant, checkpoints split into four groups. Changed: present in both captures, with at
least one changed pixel or different dimensions. New: present only in after capture. Identical:
present in both, zero changed pixels. Before-only: present only in before capture.

Changed checkpoint with equal dimensions gets changed count, recolored difference image and region.
Region = bounding box of changed pixels recorded by diff coloring, grown by margin on each side,
clamped to image. Changed checkpoint with different dimensions gets note that sizes differ in its
caption, in place of difference image.

## Layout

Sheet starts with scene name as title, then one line with name and short revision of before capture
and of after capture. Each variant section starts with variant name.

Section with changed checkpoints has header row with three column labels: before, after, region.
Each changed checkpoint has caption with checkpoint name and changed-pixel count, grouped in
thousands, or note that sizes differ. Row of three cells follows caption. First cell: before image.
Second: after image with region outlined by solid border in accent color, positioned in percent of
image so it scales with cell. Third: three labeled strips cropped to region: before image, after
image, recolored difference.

New checkpoints follow as grid of after images with checkpoint names. Their heading reads that
before capture does not have a baseline for them. Identical checkpoints follow as grid of same kind,
heading reading that both captures are identical for them. Before-only checkpoints listed by name in
one muted line. Sheet ends with legend of diff coloring.

Sheet rendered as HTML page with fixed width, fixed colors, locked font, opened in locked rendering
engine at pixel density one, captured as one full-page screenshot. Every image embedded in page, so
page loads nothing from outside. Successful run prints path of written sheet, relative to working
directory.

## Numbers and their reasons

Reference used cell width 870 pixels, gap 24 pixels, page padding 40 pixels, making sheet exactly
2,738 pixels wide: three cells, two gaps, padding on both sides. Self-test suite asserts that width.
Region margin 24 pixels. Page background `#f6f6f7`, text `#1a1a1c`, secondary text `#6b6b70`, accent
`#d3202a`. Outline 3 pixels wide. Body text 20 pixels in DejaVu Sans, font from locked fallback set;
headings at 40, 32 and 24 pixels; strip labels at 16 pixels.

Size limit was 10 MiB, largest image attachment accepted by pull request host used in reference.
Project uses limit set by pull request host used by project.

## Attaching sheets to a pull request

Project requiring visual evidence attaches one sheet for every changed surface, built from capture
on base commit of pull request and one on candidate commit. Sheets prepared before pull request
created. Listed as attachments of pull request, shown in description under separate heading.

Pull request host used in reference uploaded attachments only through create command of host
command-line client. Sheet added after creation therefore needed new draft or comment. Publisher
used in reference accepted at most 50 attachments per pull request. Each attachment had to be
nonempty PNG, JPEG, GIF or WebP file of at most 10 MiB, inside directory prepared for batch, listed
once, and referenced in description by exact listed path. On creation, client rewrote those
references to uploaded addresses. Later update of description left them unchanged, uploaded nothing
again. When any entry of batch had attachments, publisher checked once that installed client
supported them. Otherwise failed whole batch with message containing capability found and capability
required.

Pull request affecting rendered output and coming without sheet is complete only when none of its
commits changes rendered output and its description mentions that. Surface that does not yet have
scene gets one first, tracked or local, before pull request prepared. For surface missing on base
commit, form of sheet for that surface decided while scene for it curated. Sheet either shows
capture of what base commit shows at same place, or shows checkpoints of candidate commit as new.

## Web realization in the reference

Reference built HTML of sheet with server-side renderer of interface framework used by reference.
Decoded and cropped images with `pngjs`, opened page in locked Chromium through Playwright with
viewport as wide as sheet, waited for fonts of document to load, took full-page screenshot. Sheet
written to output path given by caller. For batch of pull requests, that path inside directory
prepared for batch.

## Native and terminal realizations

Sheet works on PNG captures, same on every platform. When harness of project does not include
browser engine, project either composes sheet with image library and draws captions with locked font
file, or adds locked headless browser only for rendering sheets. Sheet reads captures from harness
directory inside project cache, location defined by `workflow-skills:local-cache`.
