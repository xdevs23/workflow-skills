---
name: debugging
description: Find and fix cause of bug, failing build, check or test, or limit hit during work
---

- Fix defect in shared component inside that component. Never by giving each consumer a copy
- At roadblock, stop. Draw decision as `workflow-skills:visual-decisions` describes, with condition
  that ends workaround, before adding any workaround or compatibility shim
- Start work that replaces approved workaround, as unit of work described by
  `workflow-skills:todo-md`. Remove workaround once that condition met
- When something fails or hits limit, first ask whether design is right one, also for code that
  existed before your change
- Weigh every count found while measuring against what job needs, e.g. files opened, modules
  loaded, queries sent, rows read. Count far above that need = defect of code. Find what in code
  causes it before looking at machine, disk or setup
- Where code runs into machine or setup, make code fit them, as section Limits of
  `workflow-skills:designing-architecture` describes
- Work out how failing part would be built cleanly: which phase or component does the work, what it
  has in memory, what it writes for later
- Where clean design differs from code, rewrite the part or change how it works, in place of fix
  around failure
- Draw rewrite of code outside your change as `workflow-skills:visual-decisions` describes before
  starting it
- When one of your own changes caused failure, change or remove that change in place of building
  around it
- Never offer as option leaving unfixed a known defect in code added or edited by your change. Race
  left possible by change counts as such defect. So does way around a rule
- Find root cause of bug. Design that makes bug possible is root cause too
- Test that still fails does not prove dead end. Keep working through concrete causes of failure
- Debug from mechanism: name what controls behavior. State hypotheses. Change one variable at a
  time. Symptom is never evidence of its cause
- Read error before retrying. Change something before next try
