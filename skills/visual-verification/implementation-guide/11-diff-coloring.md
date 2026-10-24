# Diff coloring

The difference image recolors every pixel counted as changed by the comparison component, so a
reader can tell what appeared from what disappeared. The coloring is a presentation step. The
comparison component and the options recorded for it set which pixels changed, how many changed,
the ratio of changed pixels and the rule for failure. The coloring runs afterwards and reads only
the mask of changed pixels and the changed count. It never changes a pixel outside the mask.

The parameters of the coloring are defined in one place in the harness code. Every comparison
result contains them next to the comparison options. Every comparison report starts with a legend.

## The algorithm

For each changed pixel, the local contrast is the absolute distance between the luma of the pixel
and the mean luma of the window around it in the same image. The window has a radius of 2 pixels,
so it is 5 by 5 pixels, clipped at the image edges, with the center pixel excluded. A pixel with an
empty clipped window, as in a 1 by 1 image, has a local contrast of zero.

Luma is computed with the same coefficients as in the comparison component used by the reference:

    luma = (0.29889531 * red + 0.58662247 * green + 0.11448223 * blue) * opacity
         + 255 * (1 - opacity)

In that formula, red, green and blue are 0 to 255 and opacity is the alpha channel divided by 255.
Partial alpha is thereby composited over white: half-opaque black has a luma of 127 over white, and
a fully transparent pixel counts as white.

The color of a changed pixel depends on how the local contrast measured for that pixel changed from
the before image to the after image. The gain is the after contrast minus the before contrast. The
margin is 10 luma units.

* Green, meaning added, is painted when the gain is larger than the margin. A mark now stands out
  where nothing did, or stands out more.
* Red, meaning removed, is painted when the gain is below the negative margin. A mark that stood out
  no longer does.
* Blue, meaning neutral, is painted for everything else: uniform fills, hue-only recolors, contrast
  changes inside the margin, and pixels enclosed by ink on every side.

The colors are green as red 0, green 150, blue 0; red as red 220, green 0, blue 0; and blue as red
40, green 90, blue 255. The same pass that paints the pixels counts the pixels of each kind and
records the bounding box of all changed pixels, which is empty when nothing changed. The evidence
sheet uses that box.

The coloring reads the mask from the image written by the comparison component. In the reference,
the comparison component painted every pixel counted as changed in one fixed diff color, opaque red.
The coloring found the changed pixels by that exact color and alpha, which is why the comparison
left that color at the default set in the component. With a different component, the coloring reads
the mask through whatever interface that component offers.

## Why it reads correctly

Contrast is measured against the surrounding pixels in the same image. Dark marks on a light theme
and light marks on a dark theme therefore read the same way. A moved mark shows red where it used to
sit and green where it sits now. The coloring is a heuristic for reading the picture. It is not
evidence that elements were inserted into or removed from the interface. It is chosen for bounded
interface screenshots and is not claimed to hold for images in general.

## Known limits

The interior of a solid area larger than the window and a mid-tone anti-aliasing pixel enclosed by
ink do not stand out from the pixels around them, so they are painted neutral. In the historical
regression comparison run for the reference, such pixels made up six to eight percent of the
changed pixels. Recolored text that also changes in luma is painted as a gain or a loss. A shift
smaller than the window is still painted red and green, but only while the window means computed
with the mark at the old and at the new position differ by more than the margin.

A change of the radius or the margin is a tooling decision, recorded in the harness contract in the
project. It changes neither the tolerance nor the changed count.

## The legend

Every comparison report and every evidence sheet contains a legend with these statements:

* Changed pixels are recolored by a local-contrast heuristic, and the colors do not come from the
  element tree of the interface.
* Green marks gained contrast against the pixels around them, meaning they appeared.
* Red marks lost it, meaning they disappeared.
* Blue marks other changes without a clear direction.
* A moved mark shows red where it used to sit and green where it sits now.
* The window radius in pixels and the margin in luma units.
* Unchanged pixels show the blended grayscale of the before image.

Each color appears as a small swatch next to the words about it.

## Acceptance rules

The self-test suite and the historical comparison of the regression proof check the
coloring against these rules:

1. The difference function returns the same changed count as the comparison component run with the
   recorded options. The counts of the three kinds add up to that count. Every pixel outside the
   mask is byte-identical to the raw image written by the comparison component. Every recolored
   pixel has one of the three legend colors. Comparing an image with itself gives zero pixels of
   each kind.
2. On synthetic fixtures with a white field and with a near-black field, an inserted 3 by 3 mark is
   painted green and a removed one red. A moved mark gives nine red and nine green pixels and a
   changed count of eighteen.
3. A mark that turns from faint to bold is painted green, and a mark that turns from bold to faint
   red. A uniform fill, a hue change of equal luma, a 1 by 1 image and a pixel with a clipped window
   made only of ink are painted neutral. A mark in a corner of the image is painted by the clipped
   window: a 2 by 2 mark there gives four green pixels, and a 3 by 3 mark there gives eight green
   pixels and one neutral pixel enclosed by ink. A mark on a fully transparent field is painted
   green. Clearing white to transparent is painted neutral. Half-opaque black has luma 127 over
   white. On a transparent field, a half-opaque mark that appears, vanishes, becomes opaque or fades
   from opaque is painted green, red, green and red respectively.
4. The historical regression comparison run in the project gives the changed counts recorded for
   each variant. In the light and the dark variant, the newly visible element is painted green and
   the old one red.

## Web realization in the reference

The reference implemented the coloring in a small TypeScript module that worked on PNG buffers
decoded by `pngjs`, after `pixelmatch` had written the difference image. The module recolored that
image in place.

## Native and terminal realizations

The coloring works on PNG pixels and is the same on every platform. Images taken by a terminal
harness from a terminal emulator have clean glyph edges and solid cell backgrounds. Most changed
glyphs are therefore painted green and red, and changed cell backgrounds are painted as neutral
fills.

The recolored difference images are written into the comparison directory inside the harness
directory in the project cache, the location defined by `workflow-skills:local-cache`.
