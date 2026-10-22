# TypeScript

- Use the idioms: discriminated unions, const assertions, template literal types.
- Model a closed set of domain values as a string enum, such as
  `enum Outcome { Run = 'run', Refused = 'refused' }`, so the checker rejects a bare `'refused'`
  where an `Outcome` is expected.
- In a tree that allows only erasable syntax, such as one built with `erasableSyntaxOnly` or run
  through the type stripping in Node, model the set as a const-asserted object with the same
  members. Name its members everywhere, since the checker accepts the bare string there.
- Type the tag of a discriminated union over a closed set as a member of the set, such as
  `kind: Outcome.Run`.
- Keep the behavior of the values of a closed set in a `Record<Outcome, …>` beside the set, so a
  value without its behavior fails to compile.
- Read text into a closed set with a check against `Object.values(Outcome)`, never with
  `as Outcome`.
- Never write `any`, a type assertion in either form other than `as const`, or a non-null assertion
  with `!`. Narrow a value with a type guard, such as `instanceof`, or with the validation schema
  used by the project.
- Keep `unknown` to the place where outside data arrives, and convert it there into a typed model
  with a type guard or the validation schema. Never let `unknown` into any other parameter, field or
  return type, such as `Promise<unknown>`.
- Recognize an error thrown by a library with `instanceof` against the error class of the library,
  never by reading into the error through a cast.
- Catch only the errors you can name, turn each into the typed error returned by the function, and
  rethrow every other error. Never return `undefined` or another default value for a failure, and
  never count logging a failure, such as with `console.error`, as handling it.
- Return `undefined` only for a value that is not there. Return a discriminated union that names
  each reason from a function that can give up for several reasons, such as no response, an
  unexpected status or an unreadable body.
- Turn on `strict`, `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` in the TypeScript
  configuration. Turn on the typescript-eslint rules `no-explicit-any`, the `no-unsafe-*` rules,
  `consistent-type-assertions` with `assertionStyle: 'never'` and `no-non-null-assertion`. Let
  warnings fail the check.
