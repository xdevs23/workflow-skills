---
name: separation-of-concerns
description: Applies when you review a change for units doing several unrelated jobs and layers fused together.
---

# Separation of concerns

Review the change through one lens, separation of concerns, and leave bugs, performance and naming
to other lenses unless they show up as a concerns violation.

- Report a unit, such as a function, a class or a module, with more than one reason to change:
  business logic mixed with persistence, transport, formatting, logging or configuration.
- Report fused layers: presentation computing domain decisions, or orchestration code doing
  leaf-level work inline.
- Report a change to one concern that forces edits scattered across unrelated units, a sign the
  concern is smeared instead of isolated.
- Rank the findings by how much the tangle will cost future change.
