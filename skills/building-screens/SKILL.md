---
name: building-screens
description: Build or change a user interface, including the text shown on its screens.
---

# Building screens

- Show on a screen the decision made by the backend, and never make the decision again in the code
  of the screen. Keep neither optimistic state nor a second copy of the data from the backend there.
- Let a frontend send the new data and never read it back from the response. The frontend reloads
  the data, fully or partly where supported, through the same code path as a full reload or
  restart.
- In a user interface, show an error only on the part that fails, and a loading indicator for a
  loading state, never an error.
- During a save, show progress, disable every control that could send the save a second time, and
  wait until the save is done.
- Leave the view as it was when an optional feature can't apply.
- Count as text that explains a product any text on a product screen, where the reader uses the
  product, about how the product computes or stores something, why it was built that way, which
  features it does not offer, or where things sit on the screen.
- Text that describes a state of the data or an action of the reader, such as an empty list, a
  failed save or a retry in progress, does not count as text that explains the product.
- Make a product screen self-evident through its labels, controls and layout, and never put text
  that explains the product on it.
- When a part needs such text because its behavior is not evident, change the part, such as its
  label, its grouping or its control. Do not explain it to a tester either.
- Word a state of the data or the action of the reader by what happened and what the reader can do
  next, including where to check on the work later.
- Write a string shown on a product screen as a label, an action or a state on which the reader
  acts.

## Rules in other skills

- Follow `workflow-skills:copywriting` for a marketing page, where the reader decides whether to use
  the product.
