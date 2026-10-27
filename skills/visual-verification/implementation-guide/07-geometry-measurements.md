# Geometry measurements

Measurements read geometry from layout engine that drew screen. Never read it from style
declarations. Style name shows what developer intended. Measured box shows what engine drew. Every
measurement writes actual values into receipt, so failure understandable without running scene
again.

## Content boxes

Content box = drawn box of element minus computed borders and padding on each side, as reported by
layout engine for that element. Harness never reads padding from design token or class. Check that
controls fill row compares outer edges of controls with content box of row. Check that something
lies inside container compares it with content box of container.

## Empty and collapsed measurements

Geometry check fails when measured set is empty, or when measured box or gap has zero size.
Collapsed or missing element would otherwise pass containment or non-overlap check trivially: empty
set does not contain member outside container, box of zero width overlaps nothing. Every check
therefore also needs at least one measured element, and positive width and positive height for each
compared box. Check of gap needs that gap to be positive.

## Text line boxes

Text geometry read for each drawn line. Harness selects text of element, asks engine for rectangles
of each drawn line. Check that text lies inside its box compares every line rectangle with box.
Check that text wraps or does not wrap counts lines.

Text is one line when all its line rectangles start at same height. Parts of one line in different
font sizes may start a pixel or two apart. New line starts more than half a line height lower.
Height of element is then at most its line height plus one pixel. When engine does not report line
height, reference used one and a half times font size.

Where text may wrap, number of lines recorded as diagnostic measurement. Change in wrapping then
shows in receipt and report without failing capture.

## Hit tests

Hit test proves that nothing covers control. Harness asks engine which element is drawn at a point,
e.g. centre of icon in control or point just inside an edge, checks that element is part of
control. Box inside container can still be covered by sibling. Only hit test shows which element a
pointer would hit.

## Sticky headers

Sticky header inside scrolling list checked at three scroll offsets: top, point inside second
section, end. List must actually scroll, with three distinct offsets. At each offset, check advances
paused clock by one frame, then expects:

* top edge of one header to lie on inner top edge of list, within half a layout unit;
* that header to span full inner width of list;
* background of that header to be fully opaque;
* elements drawn at left, middle and right of top edge of list to be part of that header, so none
  of rows shows above it.

Opacity read from painted color itself. Reference painted computed background color into one-pixel
canvas, read alpha value of that pixel, required opacity property of element to be one. List
scrolled back to top afterwards.

## Other measured facts

Checks needed by scene built from same few measurements. Scenes in reference used every one of
following checks, each provided by harness as small shared function:

* Controls in row extend to both horizontal edges of content box of row, within one pixel.
* Fixed-width control has its expected width within one pixel.
* Control and parts of group lie inside content box of surrounding container, within one pixel.
* Controls in reading order do not overlap control before them. Where one group ends and next
  begins, controls are at least the gap set for row apart. Both checks use tolerance of half a
  layout unit.
* Row of controls is one line: height of row equals height of tallest control in it plus padding of
  row, within one pixel, with every control inside padded box.
* Truncating label has minimum width: at least as wide as stated floor, or as wide as its whole
  text where that text is shorter, within half a layout unit.
* Floating content, e.g. popover or menu, lies inside viewport, entirely on side of trigger where
  design places it, e.g. above or below, and inside horizontal edges of surrounding host or card.
* Text in tile or card lies inside box of tile within one pixel. Every element inside tile shows
  its content without clipping. Clipping shows as scroll width that exceeds client width by more
  than one pixel, on element whose horizontal overflow is not visible.
* Resting state draws nothing: document contains none of elements of component, content after it
  starts at top edge of container.
* Options of choice group have positive rectangles, do not overlap each other. Every label and hint
  line of option lies inside content box of that option. Text in them may wrap.

Single-line text that scrolls natively inside input: not a failure by itself. Multiline text field
fills content width of row containing it, within one pixel.

Row and containment checks must pass both with everything closed and with each popover or menu open.
Opening floating content can move, resize or cover controls in row from which it opens, so checks of
that row run again for each open state.

## The stability check

Before every screenshot, target scrolled into view, its geometry read repeatedly: boxes of target
and of inputs, text fields, buttons and inline text elements inside it. Between two readings paused
clock advances exactly one frame, by frame interval fixed by rendering context. Advancing runs
pending frame callbacks and due timers without letting random cadences drift. Geometry stable when
three consecutive readings match previous one within half a layout unit in every coordinate. Check
fails capture when readings still differ and nothing is left that could still move geometry: paused
clock has passed end time of every finite animation on target or inside it, and does not have any
pending timer or frame callback. Timer or frame callback that schedules itself again makes check run
until user who runs harness stops it. Failure message: geometry did not stabilize, plus instruction
to inspect animation of target.

Readiness record from check contains font families loaded at that moment, scroll positions of every
scrolling ancestor of target, number of frames advanced. Receipt contains this record for every
checkpoint.

## Numbers and their reasons

Reference used one CSS pixel as tolerance for containment and alignment checks, since fractional
layout positions round differently at edges. Used half a CSS pixel for stability and for flush
sticky header, since those checks compare same element with itself or with edge of container around
it. Non-overlap check in reading order and floor check for truncating labels also used half a CSS
pixel instead of one-pixel tolerance for containment. Full pixel there would accept controls that
overlap by a pixel, and labels a pixel narrower than floor. Reference fixed frame interval at 16
milliseconds, one frame at 60 frames per second. Toolkit with integer layout units uses one unit
where reference used one pixel. Compares in finest unit available in that toolkit, so half-unit
tolerances still mean something.

## Web realization in the reference

Reference measured boxes with DOM bounding client rectangles, padding and borders with computed
styles. Used client rectangles of DOM range for text lines, point-to-element lookup on document for
hit tests, Playwright page clock to advance frames. Each measurement function ran inside page,
returned plain numbers to scene.

## Native and terminal realizations

Native harness reads bounds from semantics or accessibility tree provided by toolkit, e.g. bounds of
composition node relative to its root, rectangle found by widget finder, frame of UI test element
or global visible rectangle of view. Padding comes from layout parameters provided by toolkit where
it exposes them. Otherwise content box taken from bounds of child elements. Text lines come from
text layout provided by toolkit, e.g. line metrics of laid-out paragraph. Hit tests use hit testing
built into toolkit. Where test framework has clock, stability check advances it one frame at a time.

Terminal harness measures in cells. Unit = one cell. Box = rectangle of rows and columns.
Text lines = screen rows. Containment compares cell rectangles. Stability check compares complete
screen buffers, including attributes and colors, needs three identical consecutive buffers while
controlled clock advances. Overdrawn text shows up as expected text missing from its cell positions.
This check replaces hit test.

Measurement helpers = tracked harness code. Values recorded by them written only to receipts in
harness directory inside project cache, at location defined by `workflow-skills:local-cache`.
