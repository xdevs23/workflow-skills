# TypeScript

- Use the idioms: discriminated unions, const assertions, template literal types.
- Model a closed set of domain values as a const-asserted object, such as
  `const Outcome = { Run: 'run', Refused: 'refused' } as const`, derive the union type from it, and
  name a value as `Outcome.Refused` everywhere else, a discriminated union's tag included, never as
  the bare string.
