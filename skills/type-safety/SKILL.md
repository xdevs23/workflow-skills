---
name: type-safety
description: Review change for strict typing
---

# Type safety

Review change for type safety only.

- Follow every rule by letter and by spirit. Getting result forbidden by a rule through another
  route, e.g. cast hidden in helper, type widened until value fits, or term redefined until work
  passes, breaks the rule just as forbidden form does. When rule stands in way of your work, name it
  where you report your work. Never go around it.
- Leave unrelated concerns to other reviewers.
- Report escapes from type system, e.g. `any`, `unknown`, `as`, unchecked casts, `@ts-ignore`,
  `# type: ignore` and unsafe downcasts, with everything that can break because of each one.
- Report stringly-typed data: strings or ints used for meaning that belongs in enum, sum type or
  branded type.
- Report hardcoded domain values: value in closed set written as text outside definition of the
  set, e.g. in return, argument, key or comparison, also where a type lists allowed strings. Rules
  on closed sets of domain values in `workflow-skills:writing-code` define what's required. Name
  tighter type in form given by language file of `workflow-skills:writing-code`. Leave alone string
  whose purpose is text and which is defined in one place.
- Report code reading meaning from where value sits in closed set, in list or in declaration, e.g.
  `ROLES[-1]` for most privileged role, comparison of two indexes or ordinals, slice taken as tier,
  or sort by list order. Name type for the closed set in form given by language file of
  `workflow-skills:writing-code`. Name order as rank or comparison written out beside the values,
  as rules on closed sets in `workflow-skills:writing-code` require.
- Report value that can be null or undefined, passed to code written as if value were always
  present.
- Report illegal states representable by types: types allowing combinations forbidden by domain. Fix
  usually: make invalid states unconstructable.
- Report stored record built or read as dictionary or by looking up its keys, where typed model,
  converted at store, belongs.
- Report request to another system or response from it, or part of request such as filter, sort
  order or paging, built or read as dictionary outside conversion in adapter, where typed model
  belongs.
- Report request model, or fixed value built from one such as sort order, defined in caller, where
  module shared by all code calling that system belongs.
- Report function that sends request and accepts its parts as one untyped body, or merges them as
  untyped maps, where each part belongs in typed parameter.
- Report parameter, return type or field annotated with container whose items are untyped, e.g.
  `list[dict]` or bare `dict`. Name typed model describing the items.
- Report type alias, or any other name, making untyped structure look typed, e.g. alias for
  `Mapping[str, object]` or `dict[str, Any]`.
- Report value to be supplied by caller that falls back silently to empty or default one, e.g.
  `body or {}`, where value belongs in required parameter.
- Report fragment of sentence defined, returned or passed as value, e.g. `"for item 42"`, to be
  glued into message, where facts about the operation belong.
- Report validation at wrong boundary: untrusted input typed as if already validated.
- In every finding, state tighter type that would make the bug unrepresentable.
