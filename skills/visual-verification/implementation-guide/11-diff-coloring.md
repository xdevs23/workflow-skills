# Diff coloring

Difference image recolors every pixel counted as changed by comparison component, so reader can tell
what appeared from what disappeared. Coloring = presentation step. Comparison component and options
recorded for it set which pixels changed, how many, ratio of changed pixels, rule for failure.
Coloring runs afterwards, reads only mask of changed pixels and changed count. Never changes pixel
outside mask.

Coloring parameters defined in one place in harness code. Every comparison result contains them next
to comparison options. Every comparison report starts with legend.

## The algorithm

For each changed pixel, local contrast = absolute distance between luma of pixel and mean luma of
window around it in same image. Window radius 2 pixels, so 5 by 5 pixels, clipped at image edges,
center pixel excluded. Pixel with empty clipped window, as in 1 by 1 image, has local contrast zero.

Luma computed with same coefficients as in comparison component used by reference:

    luma = (0.29889531 * red + 0.58662247 * green + 0.11448223 * blue) * opacity
         + 255 * (1 - opacity)

In that formula, red, green, blue are 0 to 255; opacity = alpha channel divided by 255. Partial
alpha thereby composited over white: half-opaque black has luma 127 over white, fully transparent
pixel counts as white.

Color of changed pixel depends on how local contrast measured for that pixel changed from before
image to after image. Gain = after contrast minus before contrast. Margin = 10 luma units.

* Green, meaning added, painted when gain larger than margin. Mark now stands out where nothing did,
  or stands out more.
* Red, meaning removed, painted when gain below negative margin. Mark that stood out no longer does.
* Blue, meaning neutral, painted for everything else: uniform fills, hue-only recolors, contrast
  changes inside margin, pixels enclosed by ink on every side.

Colors: green as red 0, green 150, blue 0; red as red 220, green 0, blue 0; blue as red 40, green
90, blue 255. Same pass that paints pixels counts pixels of each kind and records bounding box of
all changed pixels, empty when nothing changed. Evidence sheet uses that box.

Coloring reads mask from image written by comparison component. In reference, comparison component
painted every pixel counted as changed in one fixed diff color, opaque red. Coloring found changed
pixels by that exact color and alpha, which is why comparison left that color at default set in
component. With different component, coloring reads mask through whatever interface that component
offers.

## Why it reads correctly

Contrast measured against surrounding pixels in same image. Dark marks on light theme and light
marks on dark theme therefore read same way. Moved mark shows red where it used to sit, green where
it sits now. Coloring = heuristic for reading the picture. Not evidence that elements were inserted
into or removed from interface. Chosen for bounded interface screenshots; not claimed to hold for
images in general.

## Known limits

Interior of solid area larger than window, and mid-tone anti-aliasing pixel enclosed by ink, do not
stand out from pixels around them, so painted neutral. In historical regression comparison run for
reference, such pixels made up six to eight percent of changed pixels. Recolored text that also
changes in luma painted as gain or loss. Shift smaller than window still painted red and green, but
only while window means computed with mark at old and at new position differ by more than margin.

Change of radius or margin = tooling decision, recorded in harness contract in project. Changes
neither tolerance nor changed count.

## The legend

Every comparison report and every evidence sheet contains legend with these statements:

* Changed pixels are recolored by a local-contrast heuristic, and the colors do not come from the
  element tree of the interface.
* Green marks gained contrast against the pixels around them, meaning they appeared.
* Red marks lost it, meaning they disappeared.
* Blue marks other changes without a clear direction.
* A moved mark shows red where it used to sit and green where it sits now.
* The window radius in pixels and the margin in luma units.
* Unchanged pixels show the blended grayscale of the before image.

Each color appears as small swatch next to words about it.

## Acceptance rules

Self-test suite and historical comparison of regression proof check coloring against these rules:

1. Difference function returns same changed count as comparison component run with recorded options.
   Counts of three kinds add up to that count. Every pixel outside mask byte-identical to raw image
   written by comparison component. Every recolored pixel has one of three legend colors. Comparing
   image with itself gives zero pixels of each kind.
2. On synthetic fixtures with white field and with near-black field, inserted 3 by 3 mark painted
   green, removed one red. Moved mark gives nine red and nine green pixels, changed count eighteen.
3. Mark turning from faint to bold painted green; mark turning from bold to faint red. Uniform fill,
   hue change of equal luma, 1 by 1 image, and pixel with clipped window made only of ink painted
   neutral. Mark in corner of image painted by clipped window: 2 by 2 mark there gives four green
   pixels; 3 by 3 mark there gives eight green pixels and one neutral pixel enclosed by ink. Mark on
   fully transparent field painted green. Clearing white to transparent painted neutral. Half-opaque
   black has luma 127 over white. On transparent field, half-opaque mark that appears, vanishes,
   becomes opaque or fades from opaque painted green, red, green and red respectively.
4. Historical regression comparison run in project gives changed counts recorded for each variant.
   In light and dark variant, newly visible element painted green, old one red.

## Web realization in the reference

Reference implemented coloring in small TypeScript module working on PNG buffers decoded by `pngjs`,
after `pixelmatch` had written difference image. Module recolored that image in place.

## Native and terminal realizations

Coloring works on PNG pixels, same on every platform. Images taken by terminal harness from terminal
emulator have clean glyph edges and solid cell backgrounds. Most changed glyphs therefore painted
green and red; changed cell backgrounds painted as neutral fills.

Recolored difference images written into comparison directory inside harness directory in project
cache, location defined by `workflow-skills:local-cache`.
