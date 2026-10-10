---
name: type-safety
description: Applies when you review a change for weak typing.
---

# Type safety

Review the change through one lens, type safety, and leave unrelated concerns to other lenses.

- Report escapes from the type system, such as `any`, `unknown`, `as`, unchecked casts,
  `@ts-ignore`, `# type: ignore` and unsafe downcasts, with the blast radius each one opens.
- Report stringly-typed data: strings or ints carrying meaning that should be an enum, a sum type or
  a branded type.
- Report hardcoded domain values: a value of a closed set written as text outside the set's
  definition, such as in a return, an argument, a key or a comparison, also where a type lists the
  allowed strings. The rules on closed sets of domain values in
  `workflow-skills:engineering-principles` say what is required, and the tighter type you name is
  the form the language file of `workflow-skills:code-writing` gives. A string whose purpose is text
  and that is defined in one place is no finding.
- Report positional meaning: code that reads meaning from where a value of a closed set sits, in a
  list or in the declaration, such as `ROLES[-1]` for the most privileged role, a comparison of two
  indexes or ordinals, a slice taken as a tier or a sort by list order. Name the closed-set type in
  the form the language file of `workflow-skills:code-writing` gives, and the order as a rank or a
  comparison written out beside its values, as the closed-set rules of
  `workflow-skills:engineering-principles` require.
- Report nullability holes: values that can be null or undefined flowing into code that assumes
  presence.
- Report illegal states the types can represent: types that permit combinations the domain forbids.
  The fix is usually to make invalid states unconstructable.
- Report validation at the wrong boundary: untrusted input typed as if already validated.
- State in every finding the tighter type that would make the bug unrepresentable.
