# Part 11: diff coloring

The difference image recolors the pixels the comparison component counted as changed, so a reader
can tell what appeared from what disappeared. The coloring is a presentation step. Which pixels
changed, how many, their ratio and the failure rule stay with the comparison component and its
recorded options; the coloring runs afterwards on that per-pixel change mask and the changed count
alone, and never touches a pixel outside the mask.

The coloring's parameters live in one place in the harness code. Every comparison result records
them beside the comparison options, and every comparison report opens with a legend.

## The algorithm

For each changed pixel, the local contrast is the absolute distance between the pixel's luma and the
mean luma of its surrounding window in the same image. The window has a radius of 2 pixels, so it is
5 by 5 pixels, clipped at the image edges, with the center pixel excluded. A pixel whose clipped
window is empty, as in a 1 by 1 image, has a local contrast of zero.

Luma uses the same coefficients as the reference's comparison component:

    luma = (0.29889531 * red + 0.58662247 * green + 0.11448223 * blue) * opacity
         + 255 * (1 - opacity)

In that formula, red, green and blue are 0 to 255 and opacity is the alpha channel divided by 255.
Partial alpha is thereby composited over white: half-opaque black has a luma of 127 over white, and
a fully transparent pixel reads as white.

The pixel is painted by comparing its local contrast in the after image with its local contrast in
the before image. The gain is the after contrast minus the before contrast, and the margin is 10
luma units.

* Green, meaning added, is painted when the gain is larger than the margin. A mark now stands out
  where nothing did, or stands out more.
* Red, meaning removed, is painted when the gain is below the negative margin. A mark that stood out
  no longer does.
* Blue, meaning neutral, is painted for everything else: uniform fills, hue-only recolors, contrast
  changes inside the margin, and pixels enclosed by ink on every side.

The colors are green as red 0, green 150, blue 0; red as red 220, green 0, blue 0; and blue as red
40, green 90, blue 255. The same pass that paints the pixels counts the pixels of each kind and
records the bounding box of all changed pixels, which is empty when nothing changed. The evidence
sheet of part 12 uses that box.

The mask is read from the comparison component's own output. The reference's component painted every
counted changed pixel in one fixed diff color, opaque red, and the coloring recognized changed
pixels by that exact color and alpha; the comparison left that color at its default for this reason.
A different component supplies its mask through whatever interface it has, and the coloring reads it
from there.

## Why it reads correctly

Because contrast is measured against each image's own surroundings, dark marks on a light theme and
light marks on a dark theme read the same way, and a moved mark shows red at its old position and
green at its new one. The coloring is a heuristic for reading the picture. It is no evidence that
elements were inserted into or removed from the interface. It is chosen for bounded interface
screenshots and makes no claim for images in general.

## Known limits

Interiors of solid areas larger than the window, and mid-tone anti-aliasing pixels enclosed by ink,
have no surroundings to stand out from and stay neutral. In the reference's historical regression
comparison these were six to eight percent of the changed pixels. A recolor of text that also
changes its luma reads as a gain or a loss. A shift smaller than the window still separates into
red and green only while the old and new positions leave the window means apart by more than the
margin.

Changing the radius or the margin is a tooling decision recorded in the project's harness contract,
never a tolerance change. The changed count is unaffected either way.

## The legend

Every comparison report and every evidence sheet carries a legend that states: changed pixels are
recolored by a local-contrast heuristic and not by evidence from the interface's element tree; green
marks gained contrast against their surroundings, meaning they appeared; red marks lost it, meaning
they disappeared; blue marks other changes without a clear direction; a moved mark shows red at its
old place and green at its new place; the window radius in pixels and the margin in luma units; and
that unchanged pixels keep the blended grayscale of the before image. Each color is shown as a small
swatch beside its words.

## Acceptance rules

The self-test suite of part 14 and the historical comparison of part 17 verify the coloring with
these rules:

1. The difference function returns the same changed count as the comparison component with the
   recorded options, the three kind counts sum to it, and every pixel outside the mask is
   byte-identical to the comparison component's raw output. Every recolored pixel uses one of the
   three legend colors, and comparing an image with itself gives zero of each kind.
2. Synthetic fixtures paint an inserted 3 by 3 mark green and a removed one red, on both a white
   field and a near-black field; a moved mark yields nine red and nine green pixels and a changed
   count of eighteen.
3. A faint-to-bold mark paints green and a bold-to-faint mark red. A uniform fill, a hue change of
   equal luma, a 1 by 1 image and a pixel whose clipped window is all ink stay neutral. A mark at
   the image corner is painted by its clipped window, so a 2 by 2 mark there paints four green
   pixels, and a 3 by 3 mark there paints eight green pixels and one neutral pixel enclosed by ink.
   A mark on a fully transparent field paints green, and clearing white to transparent stays
   neutral. Half-opaque black has luma 127 over white, and a half-opaque mark appearing, vanishing,
   becoming opaque or fading from opaque on a transparent field paints green, red, green and red
   respectively.
4. The project's historical regression comparison keeps its recorded changed counts per variant, and
   the newly visible element paints green and the old one red in the light and the dark variants.

## Web realization in the reference

The reference implemented the coloring in a small TypeScript module operating on the decoded PNG
buffers of `pngjs`, after `pixelmatch` had written its difference image. It recolored that image in
place.

## Native and terminal realizations

The coloring works on PNG pixels and is the same for every platform. A terminal harness whose images
come from a terminal emulator gets clean glyph edges and solid cell backgrounds, so most changed
glyphs separate into green and red and changed cell backgrounds read as neutral fills.

The recolored difference images are written into the comparison directory inside the harness
directory in the project cache, the location `workflow-skills:local-cache` defines.
