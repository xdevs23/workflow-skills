---
name: design-drafts
description: Draw several design drafts for user to choose from
---

## Drafts

- Draw as many drafts as user asks for. Three when user does not name a number
- Match screen changed by drafts: layout, theme and its color values, fonts, icon set, resolution
  and density of target screen
- Draw screen of app alone. Never draw status bar, taskbar, frame of device or other part of
  operating system around it. Draw shell only where drafts change shell itself
- Where screen does not have code yet, take resolution and fonts from what user named. Pick
  resolution yourself when user did not name one
- Keep drafts in folder of drafts in project cache defined by `workflow-skills:local-cache`
- Write each page as standalone HTML file, all CSS inside it, as raw CSS or Tailwind classes
- Draw draft of app screen in dark and light theme. Follow system setting
- Copy font and image files used by product into folder of drafts. Draw with them
- Load nothing from network
- Use one realistic sample in every draft: real-looking names, texts and values. At least one long
  value where length matters

## Directions

- Make each draft a different idea, e.g. glass panel over app, solid panel that shrinks app, or
  floating island over part of screen. Drafts differing only in color, spacing or corner radius =
  one direction
- Name each direction in 1 to 3 words for its idea
- Give each draft one-line description: view shown by it, still or animated, resolution
- Draw every element shown by the screen in each draft
- Animate draft where screen imitated by it animates
- Draw states that change layout as separate drafts, e.g. smaller screen, values not reported by
  source, text too long for its space
- Do not write open points on drafts

## A whole screen

- Draw each whole-screen draft, e.g. web page, dashboard or main view of app, as one complete
  page, as it would ship. Never scale it to fit window
- Lay out page at width of target screen. Page scrolls only where product scrolls: there at full
  length, never cut to one viewport. Fixed-size screen stays at its size
- Write overview page, one entry per draft: name, one-line description, link to draft
- Write overview in dark mode, with name of change as title and one line under it saying what
  drafts show. Draft pages contain only the screen
- Draw all drafts and overview at once

## A part of a screen

- Draw drafts of part of screen, e.g. keyboard, panel or way to choose between two modes, on one
  page in dark mode, with name of change as title. One numbered section per direction
- Draw each direction inside real screen around that part, labeled with its name
- End page with section showing directions side by side, small size, one column per direction,
  one row per state, each direction with caption of its main property

## Finished page

- At width and height of target screen: text does not overflow its box, nothing is cut at edge of
  screen, long value of sample fits or is shortened the way product shortens it, section sized to
  viewport height fits real viewport height

## After the choice

- Whole screen: draw details of chosen direction as new drafts, with their entries on overview.
  Keep each earlier draft beside its new version, labeled "Earlier draft"
- Part of screen: draw details of chosen direction in new sections of same page. Put changed
  detail next to its earlier version, labeled "Earlier draft" and "After"

## Opening

- Open overview or page for user
- Keep chat message to path of overview and one line per direction
