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
- Give a trait one required method that does the work, such as handing out the writer, and write
  every convenience method as a default method built on it.
- Hand a locked resource to a closure, so the lock is released when the closure returns. Keep the
  closure short: it takes no other lock and never calls back into the same resource.
- Give a type that has to be stored in a `static`, such as a device that exists once in the
  machine, a `const fn` constructor for its empty state, and fill it after start through the
  late-initialization container. Hand every other collaborator in.
- Restore state that must be restored on exit in the `Drop` implementation that runs when the value
  goes out of scope.
- Select the platform implementation once at the module declaration with
  `#[cfg_attr(..., path = ...)]`.
- Keep the platform module private.
- Build a platform type through free functions of the crate that return it as `impl Trait`, so
  adding a platform changes only that crate.
- Export one type alias for the platform type, such as `pub type ArchSerial = arch::Serial;`, only
  for the places that must name the type, such as a `static` or a call of an associated function.
- Declare a dependency needed by one platform only under `[target.'cfg(...)'.dependencies]`, with
  the target cfg, such as `target_arch`, that selects the platform module. For a module selected by
  a Cargo feature, make the dependency optional and enable it from that feature.
- Make a hardware port or register a zero-sized type whose traits allow only legal operations.
  Split those traits by direction, so a write-only register offers only a write.
- Make reactivity fine-grained. A signal records which code reads it and reruns only that code when
  its value changes.
- Bring a change from outside the reactive system in through a signal set from outside.
- Rerun a loop whenever a signal read by the loop changes.
- At a foreign-function boundary:
  - Catch panics before they cross it.
  - Return errors as data.
  - Give each allocation handed out a matching free function.
- Set clippy `all` and `pedantic`, the clippy lint `undocumented_unsafe_blocks` and the lint
  `unsafe_op_in_unsafe_fn` to deny in the workspace lints, and let warnings fail the check.
- Turn on the lints `unused_results` and clippy `let_underscore_must_use` in the workspace lints,
  so a value left unused in a statement and a `#[must_use]` value discarded with `let _ =` fail the
  check.
- Let every member crate inherit the workspace lints with `[lints] workspace = true`.
- Forbid unsafe code with `#![forbid(unsafe_code)]` at the root of every crate that has none.
- Write `unsafe` code only where it is unavoidable: the code does not work without it, or the safe
  form costs so much in time or memory that the cost justifies a small `unsafe` block.
- Keep every `unsafe` block as small as possible, ideally one line or a few, and check, test and
  verify it rigorously.
- Never write `#[allow]` or `#[expect]` for `unsafe_code`.
- Write a `// SAFETY:` comment directly above every `unsafe` block and every `unsafe impl`. Explain
  in the comment why the code is unavoidable, how that was checked, such as the safe form that was
  tried or the cost that was measured, and why each condition required by the unsafe operation is
  met.
- Give every `unsafe fn` and `unsafe trait` a `# Safety` section in its documentation, naming what
  the callers of the function or the implementers of the trait must ensure.
- Declare every external dependency once in `[workspace.dependencies]` with an exact `=`
  requirement, such as `spin = "=0.9.8"`, and every crate of the workspace there as a `path` entry.
- Set the version and the edition once in `[workspace.package]`, and inherit them and the
  dependencies in each member crate with `.workspace = true`.
- Put features needed only by tests in the development dependencies, so they never compile into
  consumers.
- Model a closed set of domain values as an `enum`.
- Give every crate that can fail an error `enum` whose variants identify the operations that fail,
  each containing the error that caused it, and implement `std::error::Error` on it with that
  error as its `source()`.
- Convert a dependency error with `From` only where it has one meaning in the crate. Where it can
  come from several operations, wrap it with `map_err` into the variant of the operation.
- Never store or return an error as a `String` or as `Box<dyn Error>`.
- Read text into a closed set with `FromStr` where the text arrives, and read the error returned
  for text matching none of the values as unknown, so the rest of the input is still usable.
