---
name: separation-of-concerns
description: Applies when you review a change for units that do several unrelated jobs and layers fused together.
---

# Separation of concerns

Review the change for separation of concerns only.

- Follow every rule by what it is for. Getting a result forbidden by a rule through another route,
  such as a cast hidden in a helper, a type widened until a value fits or a term redefined until
  the work passes, breaks the rule just as the forbidden form does. When a rule stands in the way
  of your work, name it where you report your work, and never go around it.
- Leave bugs, performance and naming to other lenses, unless one of them shows up as a violation of
  the separation of concerns.
- Report a unit, such as a function, a class or a module, with more than one reason to change:
  business logic mixed with persistence, transport, formatting, logging or configuration.
- Report fused layers: presentation code that computes domain decisions, or orchestration code that
  does leaf-level work inline.
- Report a component that writes the field names of stored data owned by another component.
- Report a change to one concern that needs edits scattered across unrelated units. Such edits show
  that the concern is smeared instead of isolated.
- Rank the findings by how much each tangle will cost future changes.
