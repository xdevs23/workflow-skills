---
name: engineering-principles
description: Applies whenever you design, build, change, test or debug software, and whenever you plan or carry out engineering work.
---

# Engineering principles

**Load the `workflow-skills:writing-style` skill first.** It binds every comment, document, commit
message and reply this skill produces, and it is not optional when working with this plugin.

These principles bind the shape of every system you design or change and the way you do the work,
in every language. `workflow-skills:code-writing` holds how the code itself reads.

## The hollow lattice

- Design the architecture as a hollow lattice: a new module slots in without a change to the core. A
  core that knows details of the modules plugged into it is defective.
- Add a new kind of thing, such as a message type, a provider or a module, by registering the new
  kind in a registry, never by editing a shared switch or enum. Make the dispatching code find the
  handler for a piece of data by an identifier the data already carries for that purpose, such as
  its declared type, never by matching names and never by pulling a key out of the payload.
- Let the shape of the data flow carry the intent. Before you write a step whose name states the
  outcome the step should produce, such as "ensure first" or "start turn", check whether the data
  flow already produces that outcome, or would produce the outcome after a small change to the data
  flow.
- Never name a concrete case in shared code: no module types, no provider shapes, no domain words in
  generic code. Design, name and word a platform concept without its first consumer, and plug the
  consumers in as subsystems under it.
- Let nothing cross a layer boundary unchanged. When data arrives from another layer, convert the
  data into typed fields of the receiving layer that name no detail of the other layer. When data
  goes back to the other layer, convert the data from those fields into the other layer's own form.
  Map every field of the other layer's form, or drop that field on purpose.
- Hand collaborators in, never fetch them from a global registry. Put into a base interface only the
  members that every implementation has.
- Connect two subsystems that must talk through one named bridge, so that neither knows the other.
- Keep contracts tiny: one or two required members, everything else optional or derived.
- Discover an interface from the inside out: start from what the code that implements the interface
  actually does and needs, one piece at a time, and never write a full interface up front from
  assumptions.
- Shape the architecture so requirements fit naturally.
- Refactor the wrong foundation and delete the machinery compensating for it.
- Preserve useful abstractions; choose structures that carry the intent.
- Reject specifications that mandate architectural violations.

## Separation and ownership

- Keep data, logic and presentation in distinct layers, and give each component one job. Put a check
  that is not a component's concern into the component whose concern it is.
- Keep business logic out of a boundary such as an endpoint or a command handler: the boundary only
  passes the caller's intent on to the code that holds the logic. A shell or an adapter is packaging
  only, with no application logic.
- Let each entity own its state and lifecycle. No god objects, no state bags, and no global mutable
  state behind a lock. Prefer asking another entity through its contract over reading its stored
  state directly.
- Never change what was passed into a function. Convert an input the function needs in another form
  into a new value, and change the caller's data only when that is the function's stated purpose.
- Represent one resource, such as a device, a connection or an open file, by exactly one object that
  can't be copied by accident.
- Give all background work a scope: every concurrent task belongs to a scope that waits for the task
  to finish or cancels the task. State shared between tasks lives with one task, and the other tasks
  send that task messages. No fire-and-forget thread, and no flag read across threads.
- Code that must run on a particular thread, such as rendering or UI, runs on that thread and
  asserts at its entry point that it is running on that thread.
- Never let a shared component wait for its consumers. A web server, a database or a message bus
  doesn't depend on the setup of the services that use it, so one consumer's failure can't take the
  others down.

## Truth, state and decisions

- Make each decision in one place, record the decision once, and let all other code read the
  recorded decision. If you find that you need a check that derives the same decision a second time,
  the decision isn't recorded: record the decision and delete the second derivation. This holds
  across programs and languages too: a value two programs must agree on has one definition, never a
  copy in each program.
- Keep the truth in durable state, such as a database. Treat an event only as a signal that the
  stored data changed, and let the receiver read the current data from the store, so a duplicate or
  lost event is harmless. Recover from a crash by inspecting the stored data.
- Let a signal carry ids and flags, never content: the receiver fetches what it needs by id.
- Act in a handler on the source the event names, never on an ambient "current" instance.
- Derive state, and never store it beside the data it follows from. This rule comes before the
  preference for asking another entity through its contract: read another entity's stored state
  directly before you store data derived from that state.
- Never treat a cache, a shortcut or any other optimization as the truth: everything works without
  it, only slower. A derived form, such as one consumer's format of the source data or a display
  form, stays rebuildable from its source and is never read back as data. Design optimizations,
  caches and jitter-smoothing buffers in a pluggable fashion so that they can be removed or
  detached easily and tested without.
- Compute an expensive derived value, such as a layout or text measurements, once per change of its
  inputs, never on every read during a frame. As with any cache, the computed form is never the
  truth. You can use events, observer-pattern, subscriptions, or any other push/subscriber pattern
  to be notified of when the data changes.
- Keep state deterministic and reloadable. Correctness never depends on ephemeral client state.
- Never let an unordered collection decide a result. When several items can match, define which one
  wins or make the ambiguity an error, and never let a result depend on the order a map, a directory
  listing or an unsorted query happens to return.
- Show on a screen what the backend decided, and never make the same decision again in the code of
  the screen: keep no optimistic state and no second copy of the backend's data.
- Let a mutation answer success or failure only. Read the data afresh when a notification says that
  the data changed, and let side effects react to that notification instead of running inside the
  mutation. This means that a frontend sends the new data but doesn't read it back through the
  response. Rather, the frontend triggers a reload, either a full one or a partial one where supported,
  to obtain the new data through the same codepath as a full frontend reload or restart. Where
  the subscriber pattern can be used (websockets, HTTP long-polling, event streams, ...), use it.
- Prefer reactive, event-driven and data-driven designs over chains of calls in which each step explicitly starts the next step.
- Never synchronize by time: no sleep, delay or polling loop stands in for waiting on the event or
  state that signals readiness.
- Count progress in the unit of the work: ticks, frames or samples. Use wall time only when the
  intent is real time, such as waiting 200 ms, and then measure it on a monotonic clock.
- Make one change one transaction: write the whole change in a single transaction of the data store,
  so observers see the final result once, and never orchestrate one change across several store
  calls in separate transactions.
- Write in an update only what the caller supplied. A field the caller left out keeps its stored
  value.
- Never run a network call inside a database transaction.
- Make work demand-driven with backpressure: nothing is fetched, read or computed before the next
  stage can take it, a stream owns its resources, and dropping the consumer releases them. Stream
  files and request or response bodies, never load them whole, and prefer asynchronous code wherever
  it fits. Add no queue, buffer or cache unless the design names it with its purpose.
- Make work idempotent at a stated granularity, checked against durable state. When work crosses
  into another system, derive the ids the other system receives from durable positions, such as the
  id of the stored row or the log offset the work came from.
- Record first, then act: durably write what the action acts on before you perform the action, so
  the action can name its own record and recovery after a crash can replay from that record. Never
  compute first and insert later, and never predict a future id.

## Write once, no hacks

- Write every part once. Duplication is a defect wherever it is found, and a defect in a shared
  component is fixed inside that component, never by giving each consumer a copy.
- Reuse what exists: the project's utilities, patterns, dependencies and code paths. Prior art and
  precedent in the codebase decide how a new piece behaves.
- Bolt on no hacks, band-aids, workarounds or protective checks: fix a hazard through the
  architecture. When a change needs a bolt-on, stop and change the architecture so the work slots
  in, and redesign a shape that keeps collecting such checks. At a roadblock, stop and ask before
  any workaround or compatibility shim.
- Add no carve-out where the existing path already covers the case.
- Keep branches small and few. Where a conditional grows, replace it with indirection, abstraction
  or a structure that makes the case impossible instead of handled.
- Build critical paths, such as boot, init and deployment, on robust, declarative mechanisms, never
  on fragile shell scripts.
- Keep builds reproducible: lock every dependency to an exact version and fetch it with a checksum,
  and run every build, release included, from a clean checkout with one command and no manual step.
- Write no parser by hand for an established format, and never parse structured data as text. Keep
  communication structured, and build output from typed parts, never by string interpolation.
- Read the state the mechanism already reports instead of adding a parallel flag, sentinel or magic
  string. Represent absence as absence: an empty list, a missing value or "not found" is an empty
  collection, a null or optional, or an error, never a placeholder of the same type.

## Types, input, limits and errors

- Type data everywhere: no raw JSON lookups, no stringly-typed dispatch and no anonymous structures
  on a bus. Make illegal states unrepresentable.
- Store a value as a stable identifier. Store an enum by a stable name or value, never by its
  position in the declaration, and store nothing as the text shown to the user.
- Read a value the data defines, such as a currency, a unit, a locale or a timezone, from that data,
  and never hardcode, default or infer the value. When the value is missing, fail instead of
  assuming a value. Where only one value is allowed, validate the input against that allowed value
  and use the validated value.
- Read input resiliently by design: a malformed field reads as unknown and the rest stays usable.
- Accept one form per input, and refuse tolerance that has no technical reason.
- Make a conversion exact or fail. Never apply automatically a conversion that could lose or
  reinterpret a value, such as narrowing a number, a number to text or a negative to unsigned.
- Make a configuration that can't work fail the build or the start, never its first use: check
  conflicting or impossible settings where they are defined.
- Set no limit of your own in the software. The machine's resources and an external system's own
  refusal are the only limits: no fixed or configurable cap, and no shape that caps a count or rate
  below what the hardware carries, such as a single point that every request must pass through one
  at a time, a scan that grows with the count or a table that can't grow. Never assume an external
  system's limit: handle it when the system refuses, and accept it only with its cost, its official
  source, the date that source was checked and a person's sign-off. Never accept a limitation
  yourself: report the evidence and stop.
- Reserve memory as data arrives, never up front from a length the other side claims.
- Let a measurement on one machine inform an experiment, and never let the measurement decide a
  constant, a default, a threshold or which design is built. Derive such a value from the design,
  such as from what the data structure or the algorithm requires, find the value at runtime on the
  machine the software runs on, or remove the mechanism that needs the value.
- Keep no hand-curated list where judgment is needed: keep the mechanical check strict and give the
  caller an explicit override.
- Give an error what its reader needs to proceed, drawn from one central source, never a hint
  written for one case.
- Let a check tell "the value is wrong" apart from "I couldn't tell": its answer carries an explicit
  status that outranks the exit code, and a transient failure never discards a good value.
- Fail loud: something that must be handled raises when nothing handles it, and no silent check
  hides a broken state. Never ignore an error a call returns: handle it or pass it on.
- Report success from a confirmed result: a step that can fail returns its outcome, and the next
  step and the message to the user depend on it.
- Fail closed: an unknown, missing or malformed identity resolves to no access, never to the most
  powerful one, and a refusal never reveals that something the caller can't see exists. Check a
  permission by its exact identifier, never by a pattern or substring over text.
- Never let a default open access or share an identity: no default password, root shell or automatic
  login, and no seed, UUID or key that two installations would share. A value that must be chosen
  per installation has no default.
- Store a security record, such as a password hash or an encrypted blob, with its algorithm and
  parameters, so the algorithm can change without breaking old records, and check its parameters
  against minimums before you trust it.
- Make a secret impossible to print: a value that holds one lives in a type whose printed and debug
  forms are redacted, and a diagnostic that may repeat it is cleaned before it is shortened.
- Never switch transport security off. Certificate checks stay on, and a private certificate
  authority goes into the trust store instead of a skipped verification.
- Keep authority and consent apart. Authority answers whether this caller may reach something, and
  consent answers whether a person agreed to this act. Answer each question with its own mechanism,
  and never let the answer to one stand in for the other: consent never grants authority, authority
  never counts as consent, and an automatic approval never grants reach.
- Return a decision's verdict together with the facts the decision read, and let each place that
  shows the outcome, such as a command line, a user interface or an API response, write its own
  message from those facts, so a message never describes a different moment than the decision.
- Pass a failure across a language or process boundary as data, never as a panic or an exception
  that unwinds across it.
- Always give a waiting caller an answer: send a failure back to whoever is waiting, never only log
  it on the other side.
- Choose what leaves a system by an allowlist of fields, never by a denylist.
- Never retry automatically a request that fails the same way on every attempt: stop and show the
  failure.
- When an external system rejects an optional part of a request, degrade the result instead of
  failing: retry once without that part, show a visible note that it was left out, and fail hard
  only if that retry fails too.

## Correctness and change

- Fix a known defect, and never offer leaving the defect unfixed as an option. A race the change
  leaves possible is a defect.
- Keep what works through a change: carrying a working view or contract across the change is part of
  it.
- Build every configuration the code claims to support on every change, and remove a configuration
  that isn't built.
- Never roll back a settled migration, bring back a retired pattern or reopen settled, approved
  work. Find a bug's root cause within the current architecture, and correct a wrong migration with
  a forward migration.
- Let a migration or backfill copy data into its new shape and leave the old data as it is. Removing
  the old data is a separate, later step, taken only when something truly needs deleting.
- Before you change where data lives, such as a mount, a volume or a replaced instance, check what
  data is there and recover what the change would hide or destroy. Persistent storage arrives in the
  same change as the feature that writes to it.
- Let destruction wait for proof and a named yes. Formatting, wiping or replacing runs only on a
  state a check positively proved, an inconclusive check blocks, and the confirmation names exactly
  what will be destroyed, with no default, flag or heuristic that skips it.
- Never force in a requirement that doesn't fit the architecture: say why, and refactor the
  structure until it slots in. "Too hard" is not an outcome, and a test that still fails is no proof
  of a dead end: keep working through its concrete causes.
- Never relax an invariant for one change. A change that seems to need it is a design problem.
- In a user interface, show an error only on the part that fails. Show a loading indicator for a
  loading state, never an error. During a save, show progress, disable every control that could send
  the save a second time, and wait until the save is done. Leave the view as it was when an optional
  feature can't apply. Fix a usability problem in the interface, with an affordance, a label or
  discoverability, never by explaining the interface to the person testing it.

## Tests

- Keep tests deterministic and reproducible, with no dependence on the clock or anything outside the
  test.
- Ship no test code: shipped code takes the same path whether tests exist or not. Put failure
  injection only in an artifact that never ships, and let it run through the real error handling.
  Expose nothing for debugging in a release build: debug access is absent from it, and the build
  configuration decides which kind of build is produced, never a constant edited in source.
- Run tests and probes on synthetic fixtures in throwaway locations, never on real user data or a
  real data store.
- Put test doubles exactly where your own infrastructure ends and nowhere earlier. Never double the
  thing under test, and watch for a permissive double that silently switches off the mechanism being
  tested.
- Let tests reach no service beyond the infrastructure you run for them: block the network beneath
  every client, so no test passes because an outside service answered. Keep infrastructure you own,
  such as the database, real, at a locked version and in the configuration production needs.
- Keep tests fast and parallel. A suite slow enough to skip is a suite that stops being run.
- Fail a test that can't get a capability it needs, and never skip it. Only a test that needs an
  external artifact, such as a downloaded file, may skip when that artifact is missing, and the
  tests of the same suite that use synthetic fixtures still run.
- Reset process-wide state between tests.
- Test each invariant at exactly one level, and don't prove it again at the higher levels.
- Prove a rewrite that must give identical results with an equivalence suite: before the change,
  record the old code's outputs in a canonical serialized form, one that always gives the same bytes
  for the same value, and compare the new code's outputs with those bytes. State why for every
  comparison that is loosened.
- Name the failure mechanism in a regression test, never a ticket, and show it failing against the
  old code.
- Give each acceptance criterion of a design its own test group, and give a known limitation a test
  that asserts it.

## Scope and size

- Build only what the task needs, and remove unused, unasked-for or overbuilt code.
- Choose the clean, sophisticated option at the smallest size that stays clean: a one-line filter
  beats a separate system when the system buys nothing. No premature abstraction.
- Ship a change through every layer it touches in the same pass, and check every consumer of shared
  code.
- Leave a part that isn't defined yet as an empty stub until it is. A finished unit ships no stub,
  no placeholder text, no skeleton page and no link to a destination that doesn't exist yet.
- Let a later planned item put no requirement on current work. At most it hints at what the current
  architecture can leave room for.

## How the work is done

- Read the code first, in full around every search hit, and trace the flow in every direction. Look
  for patterns, prior art and documentation before you propose an architecture.
- Debug from the mechanism: name what controls the behavior, state hypotheses, and change one
  variable at a time. A symptom is never evidence of its cause.
- Prove a change on the real path and across the whole chain, because a green build is no proof. A
  check that can't run the real thing reports itself blocked, never passed on a stand-in, and no
  parallel simulation is built to check again what the real environment already has. Check code
  carried over from another version against the target: every name it uses exists there with the
  same signature and meaning.
- Read the error before you retry, and change something before the next try.
- Put only the generator's output into a generated artifact. Diagnostics never go into it.
- Operate an interface from its observed state: one action, check the result, then the next, never a
  chain of inputs against an assumed screen.
- Stop a process by its own process id, never by a name pattern or the port it listens on.
- Undo only your own edit, by applying its inverse. Never reset, restore or stash a file that may
  hold other uncommitted work.
- Before you add a dependency, choose its version or write against its API, look up its current
  release and documentation online, check that release for known compromise, and record the check
  with its date. Research and pick which library to use yourself, and ask the user before you decide
  where a dependency is fetched from, such as a registry or a git repository, and before you vendor
  a binary.
- State how every claim is known: measured (a probe ran), compile-proven (it builds but never ran),
  proven by reading the source, decided, or open with the experiment that would answer it. Never
  blur the classes. Base a claim about state or cause on raw evidence inspected for that claim,
  never on a summary or a verdict icon. An observation beats a reading of the code, an experiment
  that found nothing is recorded too, and work that depends on an open point waits for its
  experiment.
- Make every architectural decision deliberately and write it down with acceptance criteria that can
  be checked, and change the documentation of an interface others use, such as an API, a command or
  a screen, in the same change as that interface.
- Build in layers, scaffolding first and then one piece at a time. This is the order of building,
  and each feature still ships through all its layers in the same pass.

## Rules other skills hold

- Follow `workflow-skills:code-writing` for how code reads: its style, comments, names and the
  crafts of each language.
- Follow `workflow-skills:writing-style` for the words of comments, documents and messages.
- Follow `workflow-skills:hygiene` for what may leave the machine.
- Follow `workflow-skills:implement-review-verify` for specs, what reaches the user, design
  documents with their rejected alternatives, and checks that run once.
- Follow `workflow-skills:visual-verification` to prove a change to a user interface with
  screenshots.
- Follow `workflow-skills:local-cache` for where scratch files go.
