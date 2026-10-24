---
name: smearing
description: Review a change for knowledge of one specific case in general code, rules and documents meant to work for every case.
---

# Smearing

Review the change for smearing only.

- Report a generic, base or utility unit that type-checks, downcasts, branches on or special-cases a
  concrete type passed to it, such as `isinstance`, `instanceof` or a tag switch inside generic
  code.
- Report general code that refers to one specific case by value: a module or provider, a route or
  screen, a configuration key, a feature, a customer or tenant, or a domain word, such as
  `if (route === '/invoices')` in a shared list component.
- Report as CRITICAL a module that defines a closed set belonging to another concept, in any form,
  such as `ROLES = ("user", "editor", "admin")` in the module that lists prices, also when the
  module uses the concept. Name the module that defines the concept as the only place where the set
  is defined, as the rules on closed sets in `workflow-skills:engineering-principles` require.
- Report a general rule, skill or document that refers to one specific language, tool or product,
  such as a rule meant for every language that contains a construct of one language, where that
  case belongs in the file or section dedicated to it.
- Report specific domain objects passed through layers meant to be type-agnostic, which makes those
  layers depend on those objects.
- Report a generic parameter that only ever gets one concrete type, where the code silently depends
  on the fields or methods of that type.
- Report knowledge of one specific case spread across many general units instead of localized
  behind the abstraction.
- Leave alone a unit built to contain or wire a specific case, such as a registry entry, an adapter,
  a composition root, a configuration file, a routing table or a test. Such a unit refers to that
  case by design. Report instead the general unit that depends on it.
- Name in every finding the smeared case and the general unit that should not refer to it.
- Say in every finding where the knowledge belongs instead, such as in polymorphism, a method on the
  type, a registry entry, a proper interface, or the module, file or section dedicated to the case.
