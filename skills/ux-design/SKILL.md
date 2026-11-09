---
name: ux-design
description: Behavior of screen for user, such as input, place of parts, saving, state, errors and text on product screen
---

- In user interface, show error only on part that fails. Loading state gets loading indicator
- During save: show progress. Disable every control that could send save again
- Save edited field when it loses focus
- Never add save button to form
- Save field also after pause in input, where that serves reader better than focus loss
- Show progress of field save on that field. Disable no control during it
- Leave view as it was when optional feature cannot apply
- Make product screen self-evident through labels, controls, layout. Never put text explaining
  the product
- When part needs such text because behavior not evident: change the part, e.g. label, grouping,
  control
- Word state of data or action of reader by what happened and what reader can do next. Include
  where to check on work later
- Write string shown on product screen as label, action or state on which reader acts

## Choices

- Let reader choose outcome that reader wants, in reader's terms. Never ask reader to choose step
  of business behind it

## App screens

- Build app screen on layout known from apps of same kind: lists, detail, toolbar, tabs and main
  action where users of such apps look for them

## Order

- Show short fact repeated across items as icon, with its text on hover and as accessible name
- Draw control as icon wherever known icon shows its action. Give it accessible name and text on
  hover. Never write label on it

## Motion and input

- Where picture shows part that moves in real life, let reader move it by pointer, touch and
  keyboard
- Show how object is handled by object itself: let part to grab move slightly on hover and focus.
  Never write instruction for it
- Make interactive object behave as object imitated by it, for every input it takes. Before showing
  page, try each input in browser and compare result with real object
- Make every control work by keyboard, with touch target of at least 44 px and accessible name
- Leave scrolling, zoom, trackpad, touch and keyboard native
