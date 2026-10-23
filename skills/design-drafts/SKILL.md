---
name: design-drafts
description: Applies when the user asks for several design drafts or designs to choose from.
---

# Design drafts

- Load `workflow-skills:visual-decisions` and `workflow-skills:writing-style` first.
- Follow every rule by what it is for. Getting a result forbidden by a rule through another route,
  such as a cast hidden in a helper, a type widened until a value fits or a term redefined until
  the work passes, breaks the rule just as the forbidden form does. When a rule stands in the way
  of your work, name it where you report your work, and never go around it.

## Before you draw

- Draw as many drafts as the user asks for, and three when the user names no number.
- Read the code of the screen the drafts change and of the shell around it, such as a taskbar or a
  status bar: the layout, the theme and its color values, the fonts, the icon set, the resolution
  and the density of the target screen.
- Where the screen has no code yet, take the resolution, the fonts and the shell from what the
  user named. Ask for the resolution in the question at the end of the message when the user
  named none, and draw the shell as a plain frame labeled as a stand-in.
- Copy the font and image files used by the product into the folder of the drafts in the project
  cache, and draw with them.
- Load nothing from the network.
- Use the same sample, picked as `workflow-skills:visual-decisions` describes, in every draft.

## Directions

- Make each draft a different idea, such as a glass panel over the app, a solid panel that
  shrinks the app, or a floating island over part of the screen. Drafts that differ only in color,
  spacing or corner radius are one direction.
- Name each direction in one to three words for its idea.
- Give each draft a one-line description: the view it shows, whether it is still or animated, and
  the resolution.
- Draw each draft as the real screen at its real size, with the shell around it, the sample data
  and every element the screen shows.
- Animate a draft where the screen it imitates animates.
- Draw the states that change the layout as separate drafts, such as a smaller screen, values the
  source does not report or text too long for its space.
- Write a measurement into the picture only where the size is part of the question, such as the
  height of a keyboard.
- Write no open points on the drafts.
- Put a point you need answered into the question at the end of the message.

## A whole screen

- Draw each draft of a whole screen, such as a dashboard or the main view of an app, as a separate
  page that shows only the screen, at the resolution of the target screen.
- Give each draft a second page that scales it to the browser window, with a header that contains
  a link to the overview, the name and the one-line description of the draft and a link to the
  page at actual size.
- Write an overview page with one entry per draft: its name, its one-line description and links to
  the scaled page and to the page at actual size.
- Follow on the overview the page rules of `workflow-skills:visual-decisions` for dark mode, the
  title and the line under it. The draft pages and the scaled pages contain nothing beyond what
  this section names.
- Draw all drafts and the overview at once.

## A part of a screen

- Draw drafts of a part of a screen, such as a keyboard, a panel or a way to choose between two
  modes, as one page of `workflow-skills:visual-decisions`, with one numbered section per
  direction.
- Draw each direction inside the real screen around that part, labeled with its name.
- End the page with a section that shows all directions side by side at a small size, each with a
  caption of its main property.

## Checking

- Render every page at its real size, with its animations running, before you take the screenshot
  that `workflow-skills:visual-decisions` asks for.
- Check that no text overflows its box, that nothing is cut at the edge of the screen and that
  the long value of the sample fits or is shortened the way the product shortens it.

## After the answer

- For a whole screen, draw the details of the chosen direction as new drafts with their entries on
  the overview, and keep each earlier draft beside its new version, labeled "Earlier draft".
- For a part of a screen, draw the details of the chosen direction in new sections of the same
  page, with a detail that changed next to its earlier version, labeled "Earlier draft" and
  "After".

## Asking

- Open the overview or the page for the user.
- Keep the chat message to the path of the overview and one line per direction.
- End the message with one question: which direction the user picks, or which parts of which.
