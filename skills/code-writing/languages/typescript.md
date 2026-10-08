# TypeScript

- Use the idioms: discriminated unions, const assertions, template literal types.
- Model a closed set of domain values as a string enum, such as
  `enum Outcome { Run = 'run', Refused = 'refused' }`, so the checker refuses a bare `'refused'`
  where an `Outcome` is expected, a discriminated union's tag included. Keep the behavior of its
  values in a `Record<Outcome, …>` beside it, so a value without one fails to compile, and read
  text into it with a check against `Object.values(Outcome)`, never with `as Outcome`.
