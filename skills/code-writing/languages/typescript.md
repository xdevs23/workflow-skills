# TypeScript

- Use the idioms: discriminated unions, const assertions, template literal types.
- Model a closed set of domain values as a string enum, such as
  `enum Outcome { Run = 'run', Refused = 'refused' }`, so the checker refuses a bare `'refused'`
  where an `Outcome` is expected.
- In a tree that allows only erasable syntax, such as one built with `erasableSyntaxOnly` or run
  through Node's type stripping, model the set as a const-asserted object with the same members,
  and name its members everywhere, since the checker accepts the bare string there.
- Type the tag of a discriminated union over a closed set as the set's member, such as
  `kind: Outcome.Run`.
- Keep the behavior of the values of a closed set in a `Record<Outcome, …>` beside the set, so a
  value without its behavior fails to compile.
- Read text into a closed set with a check against `Object.values(Outcome)`, never with
  `as Outcome`.
