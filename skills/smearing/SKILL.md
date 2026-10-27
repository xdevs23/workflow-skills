---
name: smearing
description: Review change for knowledge of one specific case in general code, rules and documents meant to work for every case.
---

# Smearing

Review change for smearing only.

- Report generic, base or utility unit that type-checks, downcasts, branches on or special-cases
  concrete type passed to it, e.g. `isinstance`, `instanceof` or tag switch inside generic code.
- Report general code referring to one specific case by value: module or provider, route or screen,
  configuration key, feature, customer or tenant, or domain word, e.g.
  `if (route === '/invoices')` in shared list component.
- Report as CRITICAL module that defines closed set belonging to another concept, in any form, e.g.
  `ROLES = ("user", "editor", "admin")` in module listing prices, also when module uses the
  concept. Name module defining the concept as only place where set is defined, as rules on closed
  sets in `workflow-skills:writing-code` require.
- Report general rule, skill or document referring to one specific language, tool or product, e.g.
  rule meant for every language containing construct of one language, where that case belongs in
  file or section dedicated to it.
- Report specific domain objects passed through layers meant to be type-agnostic, which makes those
  layers depend on those objects.
- Report generic parameter that only ever gets one concrete type, where code silently depends on
  fields or methods of that type.
- Report knowledge of one specific case spread across many general units instead of localized
  behind the abstraction.
- Leave alone unit built to contain or wire specific case, e.g. registry entry, adapter,
  composition root, configuration file, routing table or test. Such unit refers to that case by
  design. Report instead general unit that depends on it.
- In every finding, name smeared case and general unit that should not refer to it.
- In every finding, say where knowledge belongs instead, e.g. in polymorphism, method on the type,
  registry entry, proper interface, or module, file or section dedicated to the case.
