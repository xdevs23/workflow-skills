---
name: reviewer-correctness
description: Applies when you review a change for bugs, races, broken invariants and wrong-granularity assertions.
---

# Correctness

Review the change for correctness only, and leave style to other lenses.

- Try to break the change: hunt the hazards it carries, such as a dedup race, an ordering guarantee
  or a retry path, and every failure mode it adds.
- Review the change only, never work merged before it.
- Read the assertions, and report an invariant asserted in aggregate where the rule binds per row or
  per item, because a degenerate part passes on the strength of its peers.
