---
name: design-drafts
description: Draw several design drafts for user to choose from
---

# Design drafts

- Load `workflow-skills:visual-decisions` first.

## Before you draw

- Draw as many drafts as user asks for. Three when user does not name a number.
- Read code of screen changed by drafts and of shell around it, e.g. taskbar or status bar: layout,
  theme and its color values, fonts, icon set, resolution and density of target screen.
- Where screen does not have code yet, take resolution, fonts and shell from what user named. Ask
  for resolution in question at end of message when user did not name one, and draw shell as plain
  frame labeled as stand-in.
- Copy font and image files used by product into folder of drafts in project cache. Draw with them.
- Load nothing from network.
- Use same sample, picked as `workflow-skills:visual-decisions` describes, in every draft.

## Directions

- Make each draft a different idea, e.g. glass panel over app, solid panel that shrinks app, or
  floating island over part of screen. Drafts differing only in color, spacing or corner radius =
  one direction.
- Name each direction in 1 to 3 words for its idea.
- Give each draft one-line description: view shown by it, still or animated, resolution.
- Draw each draft with sample data and every element shown by the screen.
- Animate draft where screen imitated by it animates.
- Draw states that change layout as separate drafts, e.g. smaller screen, values not reported by
  source, text too long for its space.
- Do not write open points on drafts.
- Put point that needs an answer into question at end of message.

## A whole screen

- Draw each draft of whole screen, e.g. dashboard or main view of app, as separate page showing
  only the screen, at resolution of target screen.
- Give each draft second page that scales it to browser window. Its header contains link to
  overview, name and one-line description of draft, and link to page at actual size.
- Write overview page, one entry per draft: name, one-line description, links to scaled page and to
  page at actual size.
- On overview, follow page rules of `workflow-skills:visual-decisions` for dark mode, title and line
  under it. Draft pages and scaled pages contain nothing beyond what this section lists.
- Draw all drafts and overview at once.

## A part of a screen

- Draw drafts of part of screen, e.g. keyboard, panel or way to choose between two modes, as one
  page of `workflow-skills:visual-decisions`. One numbered section per direction.
- Draw each direction inside real screen around that part, labeled with its name.
- End page with section of `workflow-skills:visual-decisions` showing variants side by side, small
  size, each direction with caption of its main property.

## Checking

- Render every page at real size, animations running, before taking the screenshot asked for by
  `workflow-skills:visual-decisions`.
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
