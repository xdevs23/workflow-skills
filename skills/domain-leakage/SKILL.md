---
name: domain-leakage
description: Review a change for leaks between the domain core and the infrastructure around it.
---

# Domain leakage

Review the change for domain leakage only: code that crosses the boundary between the domain core
and the mechanisms around it, such as HTTP, databases, queues, user interfaces and third-party SDKs.

- Leave unrelated concerns to other reviewers.
- Report domain logic that depends on delivery: business rules that reference HTTP status, ORM
  entities, request or response shapes, framework types or SQL.
- Report infrastructure vocabulary in the core: DTOs, database rows or wire formats used as the
  domain model, and persistence annotations on domain types.
- Report the reverse leak: infrastructure that encodes business rules belonging to the domain, such
  as validation or policy written in a controller, a repository or a serializer.
- Report a query run against a data store outside the component that owns the store, such as in a
  mapping, a provider, a worker, a route or a new class next to the code of a feature, also when
  that class is the only one that queries its collection. Name the place where the project runs its
  queries. Report also a handle to the store passed to such code.
- Report third-party or framework types crossing into the core instead of being adapted at the edge.
- Name in every finding which direction leaks across which boundary.
