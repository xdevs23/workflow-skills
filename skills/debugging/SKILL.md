---
name: debugging
description: Find and fix cause of bug, failing build, check or test, or limit hit during work
---

# Debugging

- Fix defect in shared component inside that component. Never by giving each consumer a copy.
- At roadblock, stop. Ask before adding any workaround or compatibility shim.
- Record work that replaces approved workaround as unit of work in `TODO.md`. Name in that entry
  workaround and condition that ends it. Start that work right away. Remove workaround once
  condition met.
- When something fails or hits limit, first ask whether design is right one, also for code that
  existed before your change.
- Work out how failing part would be built cleanly: which phase or component does the work, what it
  has in memory, what it writes for later.
- Where clean design differs from code, rewrite the part or change how it works, in place of fix
  around failure.
- Propose rewrite of code outside your change to user before starting it.
- When one of your own changes caused failure, change or remove that change in place of building
  around it.
- Never offer as option leaving unfixed a known defect in code added or edited by your change. Race
  left possible by change counts as such defect. So does way around a rule.
- Find root cause of bug. Design that makes bug possible is root cause too.
- Never accept "Too hard" as outcome. Test that still fails does not prove dead end. Keep working
  through concrete causes of failure.
- Debug from mechanism: name what controls behavior. State hypotheses. Change one variable at a
  time. Symptom is never evidence of its cause.
- Read error before retrying. Change something before next try.
