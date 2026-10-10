---
name: smearing
description: Applies when you review a change for general code, rules and documents that know a specific case they should stay ignorant of.
---

# Smearing

Review the change through one lens, smearing: an abstraction boundary exists on paper but is useless
in practice, because a general unit knows a specific case it should stay ignorant of. The general
unit is code, or a rule or document meant to hold for every case. It depends on, branches on,
reaches into or names one particular case, and every later case becomes a special case of it.

- Report a generic, base or utility unit that type-checks, downcasts, branches on or special-cases a
  concrete type passed to it, such as `isinstance`, `instanceof` or a tag switch inside generic
  code.
- Report general code that names one specific case by value: a module or provider, a route or
  screen, a configuration key, a feature, a customer or tenant, or a domain word, such as
  `if (route === '/invoices')` in a shared list component.
- Report as CRITICAL a module that defines a closed set belonging to another concept, in any form,
  such as `ROLES = ("user", "editor", "admin")` in the module that lists prices, also when it uses
  the concept. Name the concept's module as the one place the set is defined, as the closed-set
  rules of `workflow-skills:engineering-principles` require.
- Report a general rule, skill or document that names one specific language, tool or product, such
  as a rule for every language that spells out one language's construct, where that case belongs to
  the file or section that owns it.
- Report specific domain objects threaded through layers that claim to be type-agnostic, forcing
  those layers to know things they should not.
- Report generic parameters that only ever receive one concrete type and quietly assume its fields
  or methods.
- Report knowledge of one specific case spread across many general units instead of localized behind
  the abstraction.
- Leave alone a unit whose job is to own or wire a specific case, such as a registry entry, an
  adapter, a composition root, a configuration file, a routing table or a test: it names that case
  by design, and the finding is the general unit that reaches into it.
- Name in every finding the specific case being smeared and the general unit that should not know
  it, and say where the knowledge should live, such as polymorphism, a method on the type, a
  registry entry, a proper interface, or the module, file or section that owns the case.
