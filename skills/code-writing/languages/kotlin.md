# Kotlin

- Keep structure over strings: data stays typed until the rendering boundary, and data becomes text
  only inside the smallest rendering functions, the ones that draw a single element.
- Let the type system carry the enforcement. A constraint that can be a type is one, and runtime
  checks stay at system boundaries.
- Write intent over mechanism: operators, infix functions, extension properties and DSL builders
  make a call site read like the domain.
- Make adding one more entry of a kind, such as a new variant or a new handler, take the same number
  of lines whether it is the third entry or the fiftieth.
- Make domain quantities value types with operators and construction extensions (`120.dp`,
  `width + padding * 2`). Raw numbers don't cross an API boundary.
- Model a closed set of domain values as an enum that carries its serialized form as a property,
  with no string constants and no `when` over raw strings.
- Read text into a closed set with one lookup by its serialized form where the text arrives.
- Make records immutable data classes, built with named arguments and changed with `copy()`.
- Make an invalid instance impossible: validation runs in `init` with `require`.
- Model a finite set of states as a sealed class, exposed as a `StateFlow` when observed, never as a
  set of booleans.
- Type errors as enums with structured records, and convert such errors into the error type the
  application shares across its layers with an extension function, never with scattered catch
  blocks.
- Split capabilities into small interfaces. A component implements only those it supports, and a
  consumer asks for the capability, never the concrete type.
- Let an implementation declare what it's for, with an annotation or a property, and let a registry
  match data to it, with no `when` dispatch.
- Pass capabilities to code as context parameters. Introduce each capability once, at the outermost
  call of the operation that needs it, such as `invoice.country.context { }`, and nest further
  context blocks inside that block for further capabilities, so a call without a capability it needs
  fails to compile.
- Give data access three layers: an interface of suspend functions, a swappable implementation and
  serializable models. Business code never touches the client library, and every interface has a
  mock implementation.
- Decode every database or RPC result into a typed data class, and make RPC parameters typed
  `@Serializable` classes, never `buildJsonObject`.
- Let builders take receiver lambdas (`T.() -> Unit`) under a `@DslMarker`, and let accumulating
  builders use unary `+`.
- Write scoped state so it saves the old value, applies the new value, runs the block and restores
  the old value, so cleanup can't be forgotten.
- Let a type's companion object stand for the type's identity value, so a chain can start from it:
  `Matrix4.translated(position)` is the identity matrix translated by `position`.
- Give a class whose job is one action an `operator fun invoke()`, so the class is called like a
  function, and give a view class a constructor that takes an initializer lambda with the view
  itself as receiver, such as `class Button(init: Button.() -> Unit)`.
- Build generated output from a typed combinator vocabulary (`.spaced`, `.prefixed("| ")`), never by
  string interpolation in a generator.
- Express invariants as property delegates: a property that can be written only once, a property
  that is initialized later, an animated value, and a value kept across frames with `remember`
  inside the body of a render loop.
- Write conversions between layers as extension functions with an exhaustive `when`
  (`TextAlign.toTreeTextAlign()`).
- Keep the public surface small: implementation is `internal`, and `@PublishedApi internal` covers
  what inline functions need. Default arguments and secondary constructors replace overload sets.
- Put a general extension function under the package path of the type it extends.
- Log through a reified extension function that tags each line with the class name of its receiver,
  which is the class the call is written in, behind an inline debug check, so debug logging is
  absent from release builds.
- Pass data to another screen as one typed, serialized object, never as loose extras.
- Run work that needs an open resource inside a block that opens the resource before the work and
  closes the resource after the work, such as `database.transaction { }`.
- Give a one-row table a generic single-entry DAO with a default value and `get` and `save`.
- Inside a lambda passed to an inline function such as `forEach`, remember that a bare `return`
  leaves the enclosing function, and that since Kotlin 2.2 a bare `break` or `continue` acts on the
  enclosing loop. Skip one element with `return@forEach`, or write a `for` loop.
- Remember that a property delegated to another object's property (`by obj::prop`) binds that object
  once, when the property is initialized. Never delegate to a property of an object the class can
  replace.
- Override `hashCode` to match whenever a type overrides `equals`, and let neither throw.
- Use the idioms: scope functions, collection operators, coroutines, channels, flows, sealed classes
  with exhaustive `when`, delegated properties, reified type parameters, infix and inline functions,
  DSLs.
