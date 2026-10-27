---
name: debugging
description: Find and fix the cause of a bug, a failing build, check or test, or a limit hit during the work.
---

# Debugging

- Fix a defect in a shared component inside that component, never by giving each consumer a copy.
- At a roadblock, stop and ask before you add any workaround or compatibility shim.
- Record the work that replaces an approved workaround as a unit of work in `TODO.md`, and name the
  workaround and the condition that ends it in that entry. Start that work right away, and remove
  the workaround once the condition is met.
- When something fails or hits a limit, ask first whether the design is the right one, including the
  code that was there before your change.
- Work out how the failing part would be built cleanly: which phase or component does the work, what
  it has in memory and what it writes for later.
- Where the clean design differs from the code, rewrite the part or change how it works in place of
  a fix around the failure.
- Propose a rewrite of code outside your change to the user before you start it.
- When one of your own changes caused the failure, change or remove that change in place of
  building around it.
- Never offer leaving a known defect in code that your change adds or edits unfixed as an option.
  A race left possible by the change and a way around a rule are such defects.
- Find the root cause of a bug. A design that makes the bug possible is a root cause too.
- Never accept "Too hard" as an outcome. A test that still fails does not prove a dead end, so keep
  working through the concrete causes of the failure.
- Debug from the mechanism: name what controls the behavior, state hypotheses, and change one
  variable at a time. A symptom is never evidence of its cause.
- Read the error before you retry, and change something before the next try.
