---
name: building-screens
description: Build or change user interface, including user-facing text
---

- Show backend decision on screen. Never make it again in code of the screen. Keep there neither
  optimistic state nor second copy of backend data
- Let frontend send new data. Never read back from response. Frontend reloads data, fully or
  partly where supported, through same code path as full reload or restart. Preferred live
  data, like websocket or long-polling/SSE
- In user interface, show error only on part that fails. Loading state gets loading indicator.
- During save: show progress. Disable every control that could send save again.
- Leave view as it was when optional feature cannot apply
- Make product screen self-evident through labels, controls, layout. Never put text explaining
  the product
- When part needs such text because behavior not evident: change the part, e.g. label, grouping,
  control
- Word state of data or action of reader by what happened and what reader can do next. Include
  where to check on work later
- Write string shown on product screen as label, action or state on which reader acts
- Build perfect UX, where user understands immediately by visual only

## Rules in other skills

- Follow `workflow-skills:copywriting` for marketing page, where reader decides whether to use
  product.
