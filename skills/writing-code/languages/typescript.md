# TypeScript

- Use the idioms: discriminated unions, const assertions, template literal types.
- Model closed set of domain values as string enum, e.g.
  `enum Outcome { Run = 'run', Refused = 'refused' }`, so checker rejects bare `'refused'` where
  `Outcome` expected.
- In tree allowing only erasable syntax, e.g. one built with `erasableSyntaxOnly` or run through
  type stripping in Node, model the set as const-asserted object with same members. Name its
  members everywhere, since checker accepts the bare string there.
- Type tag of discriminated union over closed set as member of the set, e.g. `kind: Outcome.Run`.
- Keep behavior of values of closed set in `Record<Outcome, …>` beside the set, so value without
  its behavior fails to compile.
- Read text into closed set with check against `Object.values(Outcome)`, never with `as Outcome`.
- Never write `any`, type assertion in either form other than `as const`, or non-null assertion
  with `!`. Narrow value with type guard, e.g. `instanceof`, or with validation schema used by
  project.
- Keep `unknown` to place where outside data arrives. Convert it there into typed model with type
  guard or validation schema. Never let `unknown` into any other parameter, field or return type,
  e.g. `Promise<unknown>`.
- Recognize error thrown by library with `instanceof` against error class of the library, never by
  reading into the error through cast.
- Catch only errors known to you by name. Turn each into typed error returned by the function.
  Rethrow every other error. Never return `undefined` or other default value for failure. Never
  count logging failure, e.g. with `console.error`, as handling it.
- Return `undefined` only for value that is not there. From function that can give up for several
  reasons, e.g. no response, unexpected status or unreadable body, return discriminated union
  naming each reason.
- Turn on `strict`, `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` in TypeScript
  configuration. Turn on typescript-eslint rules `no-explicit-any`, the `no-unsafe-*` rules,
  `consistent-type-assertions` with `assertionStyle: 'never'` and `no-non-null-assertion`. Let
  warnings fail the check.
