# Python

- Use the idioms: comprehensions, context managers, dataclasses, generators, the walrus operator.
- Model a closed set of domain values as an `enum.Enum`, never as a `Literal` of strings and never
  with a `str` mixin, such as `enum.StrEnum` or `class Outcome(str, Enum)`, whose members compare
  equal to their text.
- Read text into a closed set with `Outcome(text)` where the text arrives, and read the
  `ValueError` raised for text matching none of the values as unknown.
- Write a typed model for a request or a response as a dataclass, or as a model built with the
  validation library already used by the project.
- Treat a `dict` or a `Mapping` as untyped when it has no type arguments, as in `list[dict]`, or
  when its values are `Any` or `object`. Treat every alias for one as untyped too, whether declared
  with `type`, `TypeAlias` or a plain assignment.
- Never write `value or {}`, `value or []` or a similar fallback for a value that the caller has to
  supply.
- Do not import inside functions. Only at the top of the file.
