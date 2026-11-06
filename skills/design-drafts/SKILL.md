---
name: design-drafts
description: Draw several design drafts for user to choose from
---

## Before you draw

- Draw as many drafts as user asks for. Three when user does not name a number.
- Read code of screen changed by drafts and of shell around it, e.g. taskbar or status bar: layout,
  theme and its color values, fonts, icon set, resolution and density of target screen.
- Where screen does not have code yet, take resolution, fonts and shell from what user named. Ask
  for resolution in question at end of message when user did not name one, and draw shell as plain
  frame labeled as stand-in.
- Keep drafts in folder of drafts in project cache defined by `workflow-skills:local-cache`.
- Write each page as standalone HTML file, all CSS inside it.
- Copy font and image files used by product into folder of drafts. Draw with them.
- Load nothing from network.
- Use one realistic sample in every draft: real-looking names, texts and values. At least one long
  value where length matters.

## Directions

- Make each draft a different idea, e.g. glass panel over app, solid panel that shrinks app, or
  floating island over part of screen. Drafts differing only in color, spacing or corner radius =
  one direction.
- Name each direction in 1 to 3 words for its idea.
- Give each draft one-line description: view shown by it, still or animated, resolution.
- Draw every element shown by the screen in each draft.
- Animate draft where screen imitated by it animates.
- Draw states that change layout as separate drafts, e.g. smaller screen, values not reported by
  source, text too long for its space.
- Do not write open points on drafts.
- Put point that needs an answer into question at end of message.

## A whole screen

- Draw each whole-screen draft, e.g. web page, dashboard or main view of app, as one complete
  page, as it would ship. Never scale it to fit window.
- Lay out page at width of target screen. Page scrolls only where product scrolls: there at full
  length, never cut to one viewport. Fixed-size screen stays at its size.
- Write overview page, one entry per draft: name, one-line description, link to draft.
- Write overview in dark mode, with name of change as title and one line under it saying what
  drafts show. Draft pages contain only the screen.
- Draw all drafts and overview at once.

## A part of a screen

- Draw drafts of part of screen, e.g. keyboard, panel or way to choose between two modes, on one
  page in dark mode, with name of change as title. One numbered section per direction.
- Draw each direction inside real screen around that part, labeled with its name.
- End page with section showing directions side by side, small size, one column per direction,
  one row per state, each direction with caption of its main property.

## Checking

- Render every page in headless browser at width and height of target screen, animations running.
- Scroll page top to bottom in steps of viewport height before screenshot, so motion started by
  scrolling has run. Take screenshot of whole page, top to bottom, and look at it before showing
  page.
- Check each section sized to viewport height at real viewport height, by one screenshot per
  scroll position. Screenshot of whole page stretches such section.
- Take screenshot of finished state, after every motion on load ended. Headless browser with virtual
  time can hold CSS animations at first frame while timers advance. Screenshot showing empty chart or
  bars at zero shows start frame.
- Check: text does not overflow its box, nothing cut at edge of screen, long value of sample fits or
  is shortened the way product shortens it.

## After the answer

- Whole screen: draw details of chosen direction as new drafts, with their entries on overview.
  Keep each earlier draft beside its new version, labeled "Earlier draft".
- Part of screen: draw details of chosen direction in new sections of same page. Put changed
  detail next to its earlier version, labeled "Earlier draft" and "After".

## Asking

- Open overview or page for user.
- Keep chat message to path of overview and one line per direction.
- End message with one question: which direction user picks, or which parts of which.
