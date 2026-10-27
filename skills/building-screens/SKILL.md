---
name: building-screens
description: Build or change user interface, including text shown on its screens.
---

# Building screens

- Show backend decision on screen. Never make it again in code of the screen. Keep there neither
  optimistic state nor second copy of backend data.
- Let frontend send new data. Never read it back from response. Frontend reloads data, fully or
  partly where supported, through same code path as full reload or restart.
- In user interface, show error only on part that fails. Loading state gets loading indicator,
  never error.
- During save: show progress. Disable every control that could send save again. Wait until save
  done.
- Leave view as it was when optional feature cannot apply.
- Count as text that explains a product: any text on product screen, where reader uses product,
  about how product computes or stores something, why it was built that way, which features it
  does not offer, or where things sit on screen.
- Text that describes state of data or action of reader, e.g. empty list, failed save, retry in
  progress: does not count as text that explains the product.
- Make product screen self-evident through labels, controls, layout. Never put text that explains
  the product on it.
- When part needs such text because behavior not evident: change the part, e.g. label, grouping,
  control. Do not explain it to tester either.
- Word state of data or action of reader by what happened and what reader can do next. Include
  where to check on work later.
- Write string shown on product screen as label, action or state on which reader acts.

## Rules in other skills

- Follow `workflow-skills:copywriting` for marketing page, where reader decides whether to use
  product.
