---
name: domain-leakage
description: Applies when you review a change for leaks between the domain core and the infrastructure around it.
---

# Domain leakage

Review the change for domain leakage only: code that crosses the boundary between the domain core
and the mechanisms around it, such as HTTP, databases, queues, user interfaces and third-party SDKs.

- Follow every rule by what it is for. Getting a result forbidden by a rule through another route,
  such as a cast hidden in a helper, a type widened until a value fits or a term redefined until
  the work passes, breaks the rule just as the forbidden form does. When a rule stands in the way
  of your work, name it where you report your work, and never go around it.
- Leave unrelated concerns to other lenses.
- Report domain logic that depends on delivery: business rules that reference HTTP status, ORM
  entities, request or response shapes, framework types or SQL.
- Report infrastructure vocabulary in the core: DTOs, database rows or wire formats used as the
  domain model, and persistence annotations on domain types.
- Report the reverse leak: infrastructure that encodes business rules belonging to the domain, such
  as validation or policy written in a controller, a repository or a serializer.
- Report a query run against a data store outside the component that owns the store, such as in a
  mapping, a provider, a worker or a route. Report also a handle to the store passed to such code.
- Report third-party or framework types crossing into the core instead of being adapted at the edge.
- Name in every finding which direction leaks across which boundary.
