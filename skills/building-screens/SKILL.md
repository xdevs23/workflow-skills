---
name: building-screens
description: Build or change user interface, including user-facing text
---

- Show backend decision on screen. Never make it again in code of the screen. Keep there neither
  optimistic state nor second copy of backend data
- Let frontend send new data. Never read back from response. Frontend reloads data, fully or
  partly where supported, through same code path as full reload or restart. Preferred live
  data, like websocket or long-polling/SSE
- In user interface, show error only on part that fails. Loading state gets loading indicator
- During save: show progress. Disable every control that could send save again
- Build create and edit of entity on one shared form, never in dialog, so create and edit never
  diverge
- Prefer creating entity by asking server for new empty entity in inactive state, such as
  disabled, unpublished or disarmed, then opening shared form on it, loaded as on any reload
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

## Rules in other skills

- Follow `workflow-skills:copywriting` for marketing page, where reader decides whether to use
  product
