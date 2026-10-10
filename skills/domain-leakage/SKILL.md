---
name: domain-leakage
description: Applies when you review a change for leaks between its domain core and the infrastructure around it.
---

# Domain leakage

Review the change through one lens, domain leakage: erosion of the boundary between the domain core
and the mechanisms around it, such as HTTP, databases, queues, user interfaces and third-party SDKs.
Leave unrelated concerns to other lenses.

- Report domain logic that knows about delivery: business rules referencing HTTP status, ORM
  entities, request or response shapes, framework types or SQL.
- Report infrastructure vocabulary in the core: DTOs, database rows or wire formats used as the
  domain model, and persistence annotations on domain types.
- Report the reverse leak: infrastructure encoding business rules it should not own, such as
  validation or policy living in a controller, a repository or a serializer.
- Report third-party or framework types crossing into the core instead of being adapted at the edge.
- Name in every finding which direction leaks across which boundary.
