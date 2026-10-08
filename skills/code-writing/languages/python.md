# Python

- Use the idioms: comprehensions, context managers, dataclasses, generators, the walrus operator.
- Model a closed set of domain values as an `enum.Enum`, never as a `Literal` of strings and never
  with a `str` mixin, such as `enum.StrEnum` or `class Outcome(str, Enum)`, whose members compare
  equal to their text.
- Read text into a closed set with `Outcome(text)` where the text arrives, and read the
  `ValueError` of text that names no value as unknown.
