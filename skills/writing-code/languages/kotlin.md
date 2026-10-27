# Kotlin

- Use the idioms: scope functions, collection operators, coroutines, channels, flows, extension
  functions, sealed classes with exhaustive `when`, delegated properties, reified type parameters,
  infix and inline functions, DSLs with `@DslMarker` scopes.
- Keep data typed until rendered. Data becomes text only inside smallest rendering functions, the
  ones drawing a single element.
- Make every constraint that can be a type a type.
- Keep runtime checks at system boundaries.
- Put general extension function, one reusable anywhere, in file under package path of the type
  extended by it, e.g. `extensions/androidx/compose/ui/graphics/Color.kt`.
- Make call site read like the domain with operators, infix functions, extension properties and DSL
  builders.
- Make adding one more entry of a kind, e.g. new variant or new handler, take same number of lines
  whether third entry or fiftieth.
- Make domain quantities value types with operators and extensions that construct them (`120.dp`,
  `width + padding * 2`).
- Never pass raw number across API boundary.
- Model closed set of domain values as enum with its serialized form as property. Never use string
  constants or `when` over raw strings for the set.
- Read text into closed set where text arrives, with one lookup by serialized form.
- Make records immutable data classes, built with named arguments, changed with `copy()`.
- Validate in `init` with `require`, so invalid instance cannot exist.
- Model finite set of states as sealed class, exposed as `StateFlow` when observed. Never as set of
  booleans.
- Type errors as enums with structured records.
- Convert errors into error type shared across layers of application with extension function, never
  with scattered catch blocks.
- Split capabilities into small interfaces. Let component implement only interfaces supported by it.
  Let consumer request the capability, never the concrete type.
- Let implementation declare what it's for, with annotation or property. Let registry match data to
  it, never `when` dispatch.
- Pass capabilities to code as context parameters, so call lacking needed capability fails to
  compile.
- Introduce each capability once, at outermost call of operation needing it, e.g.
  `invoice.country.context { }`. Nest further context block inside that block for each further
  capability.
- Give data access three layers: interface of suspend functions, swappable implementation,
  serializable models.
- Never let business code use client library. Give every interface mock implementation.
- Decode every database or RPC result into typed data class.
- Make RPC parameters typed `@Serializable` classes, never `buildJsonObject`.
- Let builders take receiver lambdas (`T.() -> Unit`) under `@DslMarker`.
- Let accumulating builders use unary `+`.
- Write scoped state as one block: save old value, apply new value, run block, restore old value.
- Let companion object of type stand for identity value of type, so chain can start from it:
  `Matrix4.translated(position)` = identity matrix translated by `position`.
- Give class whose job is one action an `operator fun invoke()`, so class is called like function.
- Give view class constructor taking initializer lambda with view itself as receiver, e.g.
  `class Button(init: Button.() -> Unit)`.
- Build generated output from typed combinator vocabulary (`.spaced`, `.prefixed("| ")`), never by
  string interpolation in generator.
- Express invariants as property delegates: property writable only once, property initialized
  later, animated value, and value preserved across frames with `remember` inside body of render
  loop.
- Write conversions between layers as extension functions with exhaustive `when`
  (`TextAlign.toTreeTextAlign()`).
- Mark implementation `internal`. Mark what inline functions need `@PublishedApi internal`.
- Use default arguments and secondary constructors in place of overload sets.
- Log through reified extension function behind inline debug check, so release builds leave out
  debug logging. Function tags each line with class name of its receiver, i.e. class in which the
  call is written.
- Pass data to another screen as one typed, serialized object, never as loose extras.
- Run work needing open resource inside block that opens resource before work and closes it after,
  e.g. `database.transaction { }`.
- Give one-row table generic single-entry DAO with default value and `get` and `save`.
- Skip one element inside lambda passed to inline function such as `forEach` with
  `return@forEach`, or write `for` loop. Inside such lambda, bare `return` leaves enclosing
  function. Since Kotlin 2.2, bare `break` or `continue` acts on enclosing loop.
- Never delegate to property of object replaceable by the class. Property delegated to property of
  another object (`by obj::prop`) binds that object once, when property initialized.
- Override `hashCode` to match whenever type overrides `equals`. Let neither throw.
