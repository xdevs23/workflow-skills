---
name: separation-of-concerns
description: Review change for units with several unrelated jobs and layers fused together
---

# Separation of concerns

Review change for separation of concerns only.

- Leave bugs, performance and naming to other reviewers, unless one of them shows up as violation of
  separation of concerns.
- Report unit, e.g. function, class or module, with more than one reason to change: business logic
  mixed with persistence, transport, formatting, logging or configuration.
- Report fused layers: presentation code computing domain decisions, or orchestration code doing
  leaf-level work inline.
- Report component writing field names of stored data owned by another component.
- Report package or module for one feature that bundles parts of layers separated by project, e.g.
  a model, its queries and its HTTP handlers, also when each part is a separate file inside it. Name
  existing layer for each part.
- Report change to one concern that needs edits scattered across unrelated units. Such edits show
  concern smeared instead of isolated.
- Rank findings by how much each tangle will cost future changes.
