---
name: domain-leakage
description: Review change for leaks between domain core and infrastructure around it.
---

# Domain leakage

Review change for domain leakage only: code crossing boundary between domain core and mechanisms
around it, e.g. HTTP, databases, queues, user interfaces, third-party SDKs.

- Leave unrelated concerns to other reviewers.
- Report domain logic that depends on delivery: business rules referencing HTTP status, ORM
  entities, request or response shapes, framework types or SQL.
- Report infrastructure vocabulary in core: DTOs, database rows or wire formats used as domain
  model, persistence annotations on domain types.
- Report reverse leak: infrastructure that encodes business rules belonging to domain, e.g.
  validation or policy written in controller, repository or serializer.
- Report query run against data store outside component that owns the store, e.g. in mapping,
  provider, worker, route or new class next to code of a feature, also when that class is only one
  querying its collection. Name place where project runs its queries. Also report handle to store
  passed to such code.
- Report third-party or framework types crossing into core instead of being adapted at edge.
- In every finding, name which direction leaks across which boundary.
