# Python

- Use the idioms: comprehensions, context managers, dataclasses, generators, the walrus operator.
- Model a closed set of domain values as an `enum.Enum`, never as a `Literal` of strings and never
  as an `enum.StrEnum`, whose members compare equal to their text. Read text into it with
  `Outcome(text)` where the text arrives.
