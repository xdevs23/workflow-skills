# Rust

- Use the idioms: iterators, pattern matching, `Result` and `Option` combinators, trait
  implementations.
- Define capabilities as traits in platform-neutral crate containing the definitions.
- Store implementation providing a capability once at start in runtime store keyed by type.
  Retrieve it by trait, never by concrete type.
- Make late initialization a container settable once, whose readers wait until producer sets it.
  Split into consumer handle and producer handle (`Deferred` and `DeferredHandle`).
- Hand data between two subsystems over rendezvous channel, never through shared mutable state.
- Let actor reply through completable future contained in the message.
- Give trait one required method doing the work, e.g. handing out the writer. Write every
  convenience method as default method built on it.
- Hand locked resource to closure, so lock released when closure returns. Keep closure short: it
  does not take another lock and never calls back into same resource.
- Give type that has to be stored in `static`, e.g. device existing once in the machine, a
  `const fn` constructor for its empty state. Fill it after start through late-initialization
  container. Hand every other collaborator in.
- Restore state that must be restored on exit in `Drop` implementation running when value goes out
  of scope.
- Select platform implementation once at module declaration with `#[cfg_attr(..., path = ...)]`.
- Keep platform module private.
- Build platform type through free functions of the crate returning it as `impl Trait`, so adding
  platform changes only that crate.
- Export one type alias for platform type, e.g. `pub type ArchSerial = arch::Serial;`, only for
  places that must name the type, e.g. `static` or call of associated function.
- Declare dependency needed by one platform only under `[target.'cfg(...)'.dependencies]`, with
  target cfg, e.g. `target_arch`, that selects platform module. For module selected by Cargo
  feature, make dependency optional and enable it from that feature.
- Make hardware port or register a zero-sized type whose traits allow only legal operations. Split
  those traits by direction, so write-only register offers only write.
- Make reactivity fine-grained. Signal records which code reads it, reruns only that code when its
  value changes.
- Bring change from outside reactive system in through signal set from outside.
- Rerun loop whenever signal read by loop changes.
- At a foreign-function boundary:
  - Catch panics before they cross it.
  - Return errors as data.
  - Give each allocation handed out a matching free function.
- Set clippy `all` and `pedantic`, clippy lint `undocumented_unsafe_blocks` and lint
  `unsafe_op_in_unsafe_fn` to deny in workspace lints. Let warnings fail the check.
- Turn on lints `unused_results` and clippy `let_underscore_must_use` in workspace lints, so value
  left unused in statement and `#[must_use]` value discarded with `let _ =` fail the check.
- Let every member crate inherit workspace lints with `[lints] workspace = true`.
- Forbid unsafe code with `#![forbid(unsafe_code)]` at root of every crate that has none.
- Write `unsafe` code only where unavoidable: code does not work without it, or safe form costs so
  much in time or memory that cost justifies small `unsafe` block.
- Keep every `unsafe` block as small as possible, ideally one line or a few. Check, test and verify
  it rigorously.
- Never write `#[allow]` or `#[expect]` for `unsafe_code`.
- Write `// SAFETY:` comment directly above every `unsafe` block and every `unsafe impl`. Explain in
  it why code is unavoidable, how that was checked, e.g. safe form tried or cost measured, and why
  each condition required by the unsafe operation is met.
- Give every `unsafe fn` and `unsafe trait` a `# Safety` section in its documentation, naming what
  callers of the function or implementers of the trait must ensure.
- Declare every external dependency once in `[workspace.dependencies]` with exact `=` requirement,
  e.g. `spin = "=0.9.8"`, and every crate of workspace there as `path` entry.
- Set version and edition once in `[workspace.package]`. Inherit them and the dependencies in each
  member crate with `.workspace = true`.
- Put features needed only by tests in development dependencies, so they never compile into
  consumers.
- Model closed set of domain values as `enum`.
- Give every crate that can fail an error `enum` whose variants identify the operations that fail,
  each containing the error that caused it. Implement `std::error::Error` on it with that error as
  its `source()`.
- Convert dependency error with `From` only where it has one meaning in the crate. Where it can
  come from several operations, wrap it with `map_err` into variant of the operation.
- Never store or return error as `String` or as `Box<dyn Error>`.
- Read text into closed set with `FromStr` where text arrives. Read error returned for text
  matching none of the values as unknown, so rest of input still usable.
