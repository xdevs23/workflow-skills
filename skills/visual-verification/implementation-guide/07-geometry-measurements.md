# Part 7: geometry measurements

Measurements read geometry from the layout engine that drew the screen, never from styling
declarations. A style name says what a developer intended; a measured box says what the engine
drew. Every measurement records its actual values in the receipt, so a failure can be read without
running the scene again.

## Content boxes

A content box is computed from the element's drawn box minus its computed borders and padding on
each side, as the layout engine reports them for that element. The harness never assumes a padding
from a design token or a class. A check that controls fill a row compares the controls' outer edges
with the row's content box, and a check that something lies inside a container compares it with the
container's content box.

## Empty and collapsed measurements

A geometry check fails when the set it measures is empty, or when a measured box or gap has zero
size. A collapsed or missing element would otherwise pass a containment or non-overlap check
trivially: an empty set has no member outside its container, and a box of zero width overlaps
nothing. Every check therefore also requires at least one measured element and a positive width or
height for each box it compares, and a check of a gap requires that gap to be positive.

## Text line boxes

Text geometry is read per drawn line. The harness selects the text of an element and asks the
engine for the rectangles of each drawn line. A check that text stays inside its box compares every
line rectangle with the box, and a check that text wraps or does not wrap counts the lines.

A text is one line when its line rectangles all start at the same height, where parts of one line in
different font sizes may start a pixel or two apart and a new line starts more than half a line
height lower. The element's own height is then at most its line height plus one pixel. When the
engine reports no line height, the reference used one and a half times the font size.

Where text may wrap, its line count is recorded as a diagnostic measurement. A change in wrapping
then shows in the receipt and the report without failing the capture.

## Hit tests

A hit test proves that nothing covers a control. The harness asks the engine which element is drawn
at a point, such as the centre of a control's icon or a point just inside an edge, and checks that
the element belongs to the control. A box inside its container can still be covered by a sibling;
only a hit test shows what a pointer would reach.

## Sticky headers

A sticky header inside a scrolling list is checked at three scroll offsets: the top, a point inside
the second section, and the end. The list must actually scroll, with three distinct offsets. At each
offset, after one frame of the paused clock, one header's top edge equals the list's inner top edge
within half a layout unit, the header spans the list's full inner width, its background is fully
opaque, and the elements drawn at the left, middle and right of the list's top edge belong to that
header, so no row shows above it. Opacity is read from the painted color itself: the reference
painted the computed background color into a one-pixel canvas and read its alpha, and required the
element's own opacity to be one. The list is scrolled back to the top afterwards.

## Other measured facts

The same few measurements compose into the checks a scene needs. The reference's scenes used each of
the following, and a harness provides them as small shared functions:

* A row's controls reach both horizontal edges of the row's content box within one pixel.
* A fixed-width control has its expected width within one pixel.
* A control and the parts of a group lie inside their container's content box within one pixel.
* Controls in reading order do not overlap the one before them, and where one group ends and the
  next begins they are at least the row's gap apart, within half a layout unit.
* A row of controls is one line: its height equals its tallest control plus its own padding within
  one pixel, with every control inside the padded box.
* A truncating label keeps a smallest width: it is at least a stated floor wide, or as wide as its
  whole text where that is shorter, within half a layout unit.
* Floating content, such as a popover or menu, lies inside the viewport, entirely on the side of its
  trigger that its design opens it to, such as above or below, and inside the horizontal edges of
  its host or card.
* Text of a tile or card stays inside the tile's box within one pixel, and no element inside it
  clips its content, which shows as a scroll width larger than the client width by more than one
  pixel on an element whose horizontal overflow is not visible.
* A resting state draws nothing: no element of the component exists, and the content after it starts
  at the container's top edge.
* Options of a choice group have positive rectangles, do not overlap each other, and keep every
  label and hint line inside the option's content box; text may wrap.

The single-line text of an input scrolling natively inside the input is no failure by itself. A
multiline text field fills the content width of its row within one pixel.

Row and containment checks hold both with everything closed and with each popover or menu open.
Opening floating content can move, resize or cover the controls of the row it opens from, so each
open state repeats the row's checks.

## The stability check

Before every screenshot, the target is scrolled into view and its geometry is read repeatedly: the
boxes of the target and of its inputs, text fields, buttons and inline text elements. Between two
readings the paused clock advances exactly one frame, which runs pending frame callbacks and due
timers without letting random cadences drift. The geometry is stable when three consecutive
readings agree with the previous one within half a layout unit in every coordinate. A deadline of
real time fails the capture with a message saying the geometry did not stabilize and asking for the
target's animation to be inspected.

The readiness record of the check holds the font families loaded at that moment, the scroll
positions of every scrolling ancestor of the target, and the number of frames advanced. The receipt
keeps it for every checkpoint.

## Numbers and their reasons

The reference used one CSS pixel as the tolerance of containment and alignment checks, since
fractional layout positions round differently at edges, and half a CSS pixel for stability and for
the flush sticky header, since those compare the same element with itself or with its container
edge. The non-overlap check in reading order and the truncating-label floor check also used half a
CSS pixel, not the one-pixel containment tolerance, since a full pixel there would accept controls
that overlap by a pixel and labels a pixel narrower than their floor. The reference advanced 16
milliseconds per frame, one frame at 60 frames per second, and gave the stability check five
seconds of real time. A toolkit with integer layout units uses one unit where the reference used
one pixel, and keeps the half-unit tolerances meaningful by comparing in its own finest unit.

## Web realization in the reference

The reference measured with the DOM's bounding client rectangles and computed styles for padding
and borders, used a DOM range's client rectangles for text lines, the document's point-to-element
lookup for hit tests, and Playwright's page clock to advance frames. Each measurement function ran
inside the page and returned plain numbers to the scene.

## Native and terminal realizations

A native harness reads bounds from the toolkit's semantics or accessibility tree, such as a
composition node's bounds in its root, a widget finder's rectangle, a UI test element's frame or a
view's global visible rectangle. Padding comes from the toolkit's layout parameters where it exposes
them, and otherwise the content box is taken from the children's bounds. Text lines come from the
toolkit's text layout, such as the line metrics of a laid-out paragraph, and hit tests from the
toolkit's own hit testing. The stability check advances the test framework's clock one frame at a
time where it has one.

A terminal harness measures in cells. The unit is one cell, a box is a rectangle of rows and
columns, text lines are screen rows, and containment compares cell rectangles. The stability check
compares complete screen buffers, including attributes and colors, and requires three identical
consecutive buffers while the controlled clock advances. Overdrawn text shows as expected text
missing at its cell positions, which takes the place of a hit test.

Measurement helpers are tracked harness code; the values they record live only in receipts in the
harness directory inside the project cache, the location `workflow-skills:local-cache` defines.
