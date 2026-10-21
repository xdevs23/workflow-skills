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
  - Give each allocation handed out a matching free function.
- Set `unsafe_code` to deny, clippy `all` and `pedantic`, and the clippy lint
  `undocumented_unsafe_blocks` in the workspace lints, and let warnings fail the check.
- Forbid unsafe code with `#![forbid(unsafe_code)]` at the root of every crate that has none.
- Write `unsafe` code only where it is unavoidable: the code does not work without it, or the safe
  form costs so much in time or memory that the cost justifies a small `unsafe` block.
- Keep every `unsafe` block as small as possible, ideally one line or a few, and check, test and
  verify it rigorously.
- Allow unsafe code with `#[allow(unsafe_code)]` only on the smallest function, method or `impl`
  that declares or contains it, such as an `unsafe` block, an `unsafe fn` or an `unsafe impl`.
- Never put `#[allow(unsafe_code)]` on a crate or a module.
- Write a `// SAFETY:` comment directly above every `unsafe` block and every `unsafe impl`. Explain
  in the comment why the code is unavoidable, how that was checked, such as the safe form that was
  tried or the cost that was measured, and why each condition required by the unsafe operation is
  met.
- Give every `unsafe fn` and `unsafe trait` a `# Safety` section in its documentation, naming what
  the callers of the function or the implementers of the trait must ensure.
- Put features needed only by tests in the development dependencies, so they never compile into
  consumers.
- Model a closed set of domain values as an `enum`.
- Read text into a closed set with `FromStr` where the text arrives, and read the error returned
  for text matching none of the values as unknown, so the rest of the input is still usable.
