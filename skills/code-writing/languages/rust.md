# Rust

- Use the idioms: iterators, pattern matching, `Result` and `Option` combinators, trait
  implementations.
- Define capabilities as traits in a platform-neutral crate that contains the definitions.
- Store the implementation that provides a capability once at start in a runtime store keyed by
  type, and retrieve it by trait, never by concrete type.
- Make late initialization a container that can be set once and whose readers wait until the
  producer sets it, split into a consumer handle and a producer handle (`Deferred` and
  `DeferredHandle`).
- Hand data between two subsystems over a rendezvous channel, never through shared mutable state.
- Let an actor reply through a completable future contained in the message.
- Restore state that must be restored on exit in the `Drop` implementation that runs when the value
  goes out of scope.
- Hide concrete platform types behind `impl Trait` in return position.
- Select the platform implementation once at the module declaration with
  `#[cfg_attr(..., path = ...)]`.
- Make a hardware port or register a zero-sized type whose traits allow only legal operations.
- Make reactivity fine-grained. A signal records which code reads it and reruns only that code when
  its value changes.
- Bring a change from outside the reactive system in through a signal set from outside.
- Rerun a loop whenever a signal read by the loop changes.
- At a foreign-function boundary:
  - Catch panics before they cross it.
  - Return errors as data.
  - Document the `# Safety` contract of every unsafe entry point.
  - Give each allocation handed out a matching free function.
- Forbid `unsafe_code` and turn on clippy `all` and `pedantic` in the workspace lints, and let
  warnings fail the check.
- Use `unsafe` only in code where it is unavoidable, such as the parts of an OS kernel that require
  it. Keep that code separate and as small as possible, and check, test and verify it rigorously.
- Put features needed only by tests in the development dependencies, so they never compile into
  consumers.
- Model a closed set of domain values as an `enum`.
- Read text into a closed set with `FromStr` where the text arrives, and read the error returned
  for text matching none of the values as unknown, so the rest of the input is still usable.
