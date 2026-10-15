---
name: type-safety
description: Applies when you review a change for weak typing.
---

# Type safety

Review the change for type safety only.

- Leave unrelated concerns to other lenses.
- Report escapes from the type system, such as `any`, `unknown`, `as`, unchecked casts,
  `@ts-ignore`, `# type: ignore` and unsafe downcasts, with everything that can break because of
  each one.
- Report stringly-typed data: strings or ints used for a meaning that belongs in an enum, a sum type
  or a branded type.
- Report hardcoded domain values: a value in a closed set written as text outside the definition of
  the set, such as in a return, an argument, a key or a comparison, also where a type lists the
  allowed strings. The rules on closed sets of domain values in
  `workflow-skills:engineering-principles` define what is required. Name the tighter type in the
  form given by the language file of `workflow-skills:code-writing`. Leave alone a string whose
  purpose is text and which is defined in one place.
- Report code that reads meaning from where a value sits in a closed set, in a list or in the
  declaration, such as `ROLES[-1]` for the most privileged role, a comparison of two indexes or
  ordinals, a slice taken as a tier or a sort by list order. Name the type for the closed set in
  the form given by the language file of `workflow-skills:code-writing`. Name the order as a rank or
  a comparison written out beside the values, as the rules on closed sets in
  `workflow-skills:engineering-principles` require.
- Report a value that can be null or undefined and is passed to code written as if the value were
  always present.
- Report illegal states representable by the types: types that allow combinations forbidden by the
  domain. The fix is usually to make invalid states unconstructable.
- Report a stored record built or read as a dictionary or by looking up its keys, where a typed
  model converted at the store belongs.
- Report validation at the wrong boundary: untrusted input typed as if already validated.
- State in every finding the tighter type that would make the bug unrepresentable.
