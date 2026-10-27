# Python

- Use the idioms: comprehensions, context managers, dataclasses, generators, walrus operator.
- Model closed set of domain values as `enum.Enum`. Never as `Literal` of strings, never with `str`
  mixin, e.g. `enum.StrEnum` or `class Outcome(str, Enum)`, whose members compare equal to their
  text.
- Read text into closed set with `Outcome(text)` where text arrives. Read `ValueError` raised for
  text matching none of the values as unknown.
- Write typed model for request or response as dataclass, or as model built with validation
  library already used by project.
- Treat `dict` or `Mapping` as untyped when it lacks type arguments, as in `list[dict]`, or when
  its values are `Any` or `object`. Treat every alias for one as untyped too, whether declared with
  `type`, `TypeAlias` or plain assignment.
- Never write `value or {}`, `value or []` or similar fallback for value to be supplied by
  caller.
- Do not import inside functions. Only at top of file.
