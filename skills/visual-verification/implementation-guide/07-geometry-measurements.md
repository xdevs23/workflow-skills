# Part 7: geometry measurements

Measurements read geometry from the layout engine that drew the screen. They never read it from
style declarations. A style name shows what a developer intended, while a measured box shows what
the engine drew. Every measurement writes the actual values into the receipt, so a failure can be
understood without running the scene again.

## Content boxes

A content box is the drawn box of the element minus the computed borders and padding on each side,
as reported by the layout engine for that element. The harness never takes a padding from a
design token or a class. A check that controls fill a row compares the outer edges of the controls
with the content box of the row. A check that something lies inside a container compares it with
the content box of the container.

## Empty and collapsed measurements

A geometry check fails when the measured set is empty, or when a measured box or gap has zero size.
A collapsed or missing element would otherwise pass a containment or non-overlap check trivially:
an empty set does not contain a member outside the container, and a box of zero width overlaps
nothing. Every check therefore also needs at least one measured element, and a positive width and a
positive height for each compared box. A check of a gap needs that gap to be positive.

## Text line boxes

Text geometry is read for each drawn line. The harness selects the text of an element and asks the
engine for the rectangles of each drawn line. A check that text lies inside its box compares every
line rectangle with the box. A check that text wraps or does not wrap counts the lines.

A text is one line when all its line rectangles start at the same height. Parts of one line in
different font sizes may start a pixel or two apart, while a new line starts more than half a line
height lower. The height of the element is then at most its line height plus one pixel. When the
engine does not report a line height, the reference used one and a half times the font size.

Where text may wrap, the number of lines is recorded as a diagnostic measurement. A change in
wrapping then shows in the receipt and the report without failing the capture.

## Hit tests

A hit test proves that nothing covers a control. The harness asks the engine which element is drawn
at a point, such as the centre of the icon in a control or a point just inside an edge, and checks
that the element is part of the control. A box inside a container can still be covered by a
sibling. Only a hit test shows which element a pointer would hit.

## Sticky headers

A sticky header inside a scrolling list is checked at three scroll offsets: the top, a point inside
the second section, and the end. The list must actually scroll, with three distinct offsets. At each
offset, the check advances the paused clock by one frame and then expects:

* the top edge of one header to lie on the inner top edge of the list, within half a layout unit;
* that header to span the full inner width of the list;
* the background of that header to be fully opaque;
* the elements drawn at the left, middle and right of the top edge of the list to be part of that
  header, so none of the rows shows above it.

Opacity is read from the painted color itself. The reference painted the computed background color
into a one-pixel canvas, read the alpha value of that pixel, and required the opacity property of
the element to be one. The list is scrolled back to the top afterwards.

## Other measured facts

The checks needed by a scene are built from the same few measurements. The scenes in the reference
used every one of the following checks, each provided by the harness as a small shared function:

* The controls in a row extend to both horizontal edges of the content box of the row, within one
  pixel.
* A fixed-width control has its expected width within one pixel.
* A control and the parts of a group lie inside the content box of the surrounding container,
  within one pixel.
* Controls in reading order do not overlap the control before them. Where one group ends and the
  next begins, the controls are at least the gap set for the row apart. Both checks use a tolerance
  of half a layout unit.
* A row of controls is one line: the height of the row equals the height of the tallest control in
  it plus the padding of the row, within one pixel, with every control inside the padded box.
* A truncating label has a minimum width: it is at least as wide as a stated floor, or as wide as
  its whole text where that text is shorter, within half a layout unit.
* Floating content, such as a popover or menu, lies inside the viewport, entirely on the side of the
  trigger where the design places it, such as above or below, and inside the horizontal edges of the
  surrounding host or card.
* Text in a tile or card lies inside the box of the tile within one pixel. Every element inside the
  tile shows its content without clipping. Clipping shows as a scroll width that exceeds the client
  width by more than one pixel, on an element whose horizontal overflow is not visible.
* A resting state draws nothing: the document contains none of the elements of the component, and
  the content after it starts at the top edge of the container.
* The options of a choice group have positive rectangles and do not overlap each other. Every label
  and hint line of an option lies inside the content box of that option. The text in them may wrap.

Single-line text that scrolls natively inside an input is not a failure by itself. A multiline text
field fills the content width of the row containing it, within one pixel.

Row and containment checks must pass both with everything closed and with each popover or menu
open. Opening floating content can move, resize or cover the controls in the row from which it
opens, so the checks of that row run again for each open state.

## The stability check

Before every screenshot, the target is scrolled into view and its geometry is read repeatedly: the
boxes of the target and of the inputs, text fields, buttons and inline text elements inside it.
Between two readings the paused clock advances exactly one frame, which runs pending frame callbacks
and due timers without letting random cadences drift. The geometry is stable when three consecutive
readings match the previous one within half a layout unit in every coordinate. A deadline in real
time fails the capture with a message that the geometry did not stabilize, and with the instruction
to inspect the animation of the target.

The readiness record from the check contains the font families loaded at that moment, the scroll
positions of every scrolling ancestor of the target, and the number of frames advanced. The receipt
contains this record for every checkpoint.

## Numbers and their reasons

The reference used one CSS pixel as the tolerance for containment and alignment checks, since
fractional layout positions round differently at edges. It used half a CSS pixel for stability and
for the flush sticky header, since those checks compare the same element with itself or with the
edge of the container around it. The non-overlap check in reading order and the floor check for
truncating labels also used half a CSS pixel instead of the one-pixel tolerance for containment. A
full pixel there would accept controls that overlap by a pixel, and labels that are a pixel narrower
than the floor. The reference advanced 16 milliseconds per frame, one frame at 60 frames per second,
and gave the stability check five seconds of real time. A toolkit with integer layout units uses one
unit where the reference used one pixel. It compares in the finest unit available in that toolkit,
so the half-unit tolerances still mean something.

## Web realization in the reference

The reference measured boxes with DOM bounding client rectangles, and padding and borders with
computed styles. It used the client rectangles of a DOM range for text lines, the point-to-element
lookup on the document for hit tests, and the Playwright page clock to advance frames. Each
measurement function ran inside the page and returned plain numbers to the scene.

## Native and terminal realizations

A native harness reads bounds from the semantics or accessibility tree provided by the toolkit, such
as the bounds of a composition node relative to its root, the rectangle found by a widget finder,
the frame of a UI test element or the global visible rectangle of a view. Padding comes from the
layout parameters provided by the toolkit where it exposes them. Otherwise the content box is taken
from the bounds of the child elements. Text lines come from the text layout provided by the
toolkit, such as the line metrics of a laid-out paragraph. Hit tests use the hit testing built into
the toolkit. Where the test framework has a clock, the stability check advances it one frame at a
time.

A terminal harness measures in cells. The unit is one cell, a box is a rectangle of rows and
columns, text lines are screen rows, and containment compares cell rectangles. The stability check
compares complete screen buffers, including attributes and colors, and needs three identical
consecutive buffers while the controlled clock advances. Overdrawn text shows up as expected text
missing from its cell positions. This check replaces the hit test.

Measurement helpers are tracked harness code. The values recorded by them are written only to
receipts in the harness directory inside the project cache, at the location defined by
`workflow-skills:local-cache`.
