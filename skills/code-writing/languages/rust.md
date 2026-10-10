# Rust

- Use the idioms: iterators, pattern matching, `Result` and `Option` combinators, trait
  implementations.
- Define capabilities as traits in a platform-neutral definitions crate.
- Store a capability's implementation once at start in a type-keyed runtime store, and retrieve it
  by trait, never by concrete type.
- Make late initialization a container that can be set once and whose readers wait until the
  producer sets it, split into a consumer handle and a producer handle (`Deferred` and
  `DeferredHandle`).
- Hand data between two subsystems over a rendezvous channel, never through shared mutable state.
- Let an actor reply through a completable future the message carries.
- Restore state that must be restored on exit in the `Drop` of a value that lives for the scope.
- Hide concrete platform types behind `impl Trait` in return position.
- Select the platform implementation once at the module declaration with
  `#[cfg_attr(..., path = ...)]`.
- Make a hardware port or register a zero-sized type whose traits allow only legal operations.
- Make reactivity fine-grained: a signal records which code reads it and reruns only that code when
  its value changes, a change from outside the reactive system enters through a signal set from
  outside, and a loop reruns whenever a signal it read changes.
- At a foreign-function boundary, catch panics before they cross, return errors as data, document
  the `# Safety` contract of every unsafe entry point, and give each allocation handed out a
  matching free function.
- Forbid `unsafe_code` and turn on clippy `all` and `pedantic` in the workspace lints, and let
  warnings fail the check.
- Use no `unsafe`, except in code where it is unavoidable, such as the parts of an OS kernel that
  require it. Keep that code on its own and as small as possible, and check, test and verify it
  rigorously.
- Put features only tests need in the development dependencies, so they never compile into
  consumers.
- Model a closed set of domain values as an `enum`.
- Read text into a closed set with `FromStr` where the text arrives, and read its error for text
  that names no value as unknown, so the rest of the input stays usable.
