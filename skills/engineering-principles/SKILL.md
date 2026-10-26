---
name: engineering-principles
description: Design, build, change, test or debug software, and plan or carry out engineering work.
---

# Engineering principles

- Load `workflow-skills:writing-style` first, and follow it in every comment, document, commit
  message and reply you write under this skill.

## The hollow lattice

- Design the architecture as a hollow lattice, into which a new module slots without a change to
  the core. A core that contains details of the modules plugged into it is defective.
- Add a new kind of thing, such as a message type, a provider or a module, by registering it in a
  registry, never by editing a shared switch or enum.
- Dispatch data to the handler for it by an identifier included in the data for that purpose, such
  as the type declared in the data, never by matching names or pulling a key out of the payload.
- Let the shape of the data flow show the intent. Before you write a step named after an outcome,
  such as "ensure first" or "start turn", check whether the data flow already produces that
  outcome, or would after a small change.
- Never name a concrete case in shared code. Leave module types, the shapes of providers and words
  from the domain out of generic code.
- Design, name and word a platform concept apart from the first consumer that uses it, and plug the
  consumers in as subsystems under the concept.
- Let nothing cross a boundary between layers unchanged. Convert data arriving at a layer into
  typed fields defined in that layer, which do not mention any detail of the other layer. Convert
  the data back into the form used by the other layer when it goes back.
- Map every field of the form used by the other layer, or drop the field on purpose.
- Hand collaborators in, never fetch them from a global registry.
- Give each source of a value and each way of building a dependency one unit, and hand that unit
  to the code that uses it. A change of the source then edits only that unit and the composition
  root, the place where the app creates the dependencies and hands them in.
- Put into a base interface only the members present in every implementation.
- Connect two subsystems that must communicate through one named bridge, so neither contains
  details of the other.
- Keep contracts tiny: one or two required members, the rest optional or derived.
- Discover an interface from the inside out, from what the code implementing it does and needs, one
  piece at a time, never as a full interface written up front from assumptions.
- Shape the architecture so requirements fit naturally.
- Refactor a wrong foundation and delete the machinery compensating for it.
- Preserve useful abstractions.
- Choose structures that show the intent.
- Reject a specification that requires breaking the architecture.
- Build code in distinct modules, layers and interfaces: one adapter handles the input and another
  the output, the core contains details of neither, and the user interface is separate from the
  renderer that draws it.

## Separation and ownership

- Keep data, logic and presentation in distinct layers.
- Put each part of a new feature into the layer the project already has for its kind, such as the
  model into the models, the queries into the services and the handlers into the routes. A package
  or module for one feature that bundles several layers is not a layer of its own, also when each
  layer is a separate file inside it.
- Give each component one job, and put a check into the component responsible for what it checks.
- Keep business logic out of a boundary such as an endpoint or a command handler. The boundary only
  passes what the caller asked for on to the code that contains the logic.
- Let a shell or an adapter only package the application, without any of the logic of the
  application.
- Let each entity own its state and lifecycle. Never build a god object, a bag of loose state or
  global mutable state behind a lock.
- Prefer asking another entity through its contract over reading its stored state directly.
- Run every query against a data store in the component that owns that collection or table, through
  the one place in the project that runs queries. Create the component for a new collection or
  table in that place, shaped and named like the components already there. A mapping, a provider,
  a worker or a route requests the data from that component. Only that component has a handle to
  the store, whatever a class elsewhere is called.
- Write the field names of stored data only in the component that owns the data. Another component
  passes typed values to the component that owns the data, which builds the record from them.
- Never change what was passed into a function. Convert an input into a new value, and change data
  passed in by the caller only when changing it is the stated purpose of the function.
- Represent one resource, such as a device, a connection or an open file, by exactly one object that
  can't be copied by accident.
- Give every concurrent task a scope that waits for it to finish or cancels it.
- Keep state shared between tasks in one task, and let the other tasks send that task messages.
- Never start a fire-and-forget thread, and never read a flag across threads.
- Run code bound to a thread, such as rendering or the user interface, on that thread, and assert at
  its entry point that it runs there.
- Never let a shared component, such as a web server, a database or a message bus, wait for or
  depend on the setup of the services that use it.

## Truth, state and decisions

- Make each decision in one place, record it once, and let all other code read the record.
- A check that derives the same decision a second time shows that the decision isn't recorded.
  Record the decision and delete the second derivation.
- Define a value on which two programs or languages must agree once, never as a copy in each.
- Keep the truth in durable state, such as a database. An event only signals that the stored data
  changed. The receiver reads the current data from the store, and recovery from a crash reads the
  stored data.
- Let a signal contain ids and flags, never content. The receiver fetches what it needs by id.
- Act in a handler on the source identified in the event, never on an ambient "current" instance.
- Derive state, and never store it beside the data from which it follows. This rule comes before
  the preference for asking through a contract: read the stored state of another entity directly
  before you store data derived from it.
- Never treat a cache, a shortcut or any other optimization as the truth. Everything works without
  it, only slower.
- Make a derived form, such as the source data formatted for one consumer or a form for display,
  rebuildable from the data it was derived from, and never read it back as data.
- Make optimizations, caches and buffers that smooth jitter pluggable, so each of them can be
  removed and the system tested without it.
- Compute an expensive derived value, such as a layout or the measurements made on text, once per
  change of the inputs it is computed from, never on every read during a frame. The computed form is
  never the truth. Events, observers, subscriptions or another push mechanism may report the change.
- Keep state deterministic and reloadable. Correctness never depends on short-lived state in the
  client.
- Never let an unordered collection determine a result. When several items can match, define which
  one wins or make the ambiguity an error. Never depend on the order in which a map, a directory
  listing or an unsorted query returns items.
- Show on a screen the decision made by the backend, and never make the decision again in the code
  of the screen. Keep neither optimistic state nor a second copy of the data from the backend there.
- Let a mutation return only success or failure.
- Read the data again when a notification reports that it changed. Let side effects react to that
  notification, never run inside the mutation.
- Let a frontend send the new data and never read it back from the response. The frontend reloads
  the data, fully or partly where supported, through the same code path as a full reload or
  restart.
- Use a subscription, such as websockets, long polling or an event stream, wherever one can be used.
- Prefer reactive, event-driven and data-driven designs over chains of calls in which each step
  starts the next.
- Never synchronize by time. Wait on the event or the state that signals readiness, never on a
  sleep, a delay or a polling loop.
- Count progress in the unit of the work, such as ticks, frames or samples. Use wall time only when
  the intent is real time, such as waiting 200 ms, and measure it on a monotonic clock.
- Write one change in a single transaction of the data store, never spread across several calls to
  the store in separate transactions.
- Write in an update only what the caller supplied. The update does not change a field left out by
  the caller.
- Never run a network call inside a database transaction.
- Make work demand-driven with backpressure. Fetch, read or compute something only when the next
  stage can take it.
- Never drain a queue or a channel in a loop only to discard its values. Process every value in the
  loop, or keep a slot replaced by each new value where only the latest one is needed.
- Let a stream own its resources, and release them when the consumer is dropped.
- Stream files and the bodies of requests and responses, never load them whole.
- Prefer asynchronous code wherever it fits.
- Add a queue, a buffer or a cache only where the design includes it together with its purpose.
- Make work idempotent at a stated granularity, checked against durable state.
- Derive the ids sent to another system from durable positions, such as the id of the stored row or
  the offset in the log from which the work came.
- Record first, then act. Before you perform an action, durably write what it acts on, so the
  action refers to that stored record and recovery after a crash replays from it.
- Never compute first and insert later, and never predict a future id.

## Write once, no hacks

- Write every part once. Duplication is a defect wherever it is found.
- Fix a defect in a shared component inside that component, never by giving each consumer a copy.
- Reuse the utilities, patterns, dependencies and code paths of the project. Prior art in the
  codebase determines how a new piece behaves.
- Fix a hazard through the architecture, never by bolting on a hack, a band-aid, a workaround or a
  protective check.
- When a change needs a bolt-on, change the architecture so the work slots in.
- Redesign a shape to which such checks are added again and again.
- At a roadblock, stop and ask before you add any workaround or compatibility shim.
- Record the work that replaces an approved workaround as a unit of work in `TODO.md`, and name the
  workaround and the condition that ends it in that entry. Start that work right away, and remove
  the workaround once the condition is met.
- When something fails or hits a limit, ask first whether the design is the right one, including the
  code that was there before your change.
- Work out how the failing part would be built cleanly: which phase or component does the work, what
  it has in memory and what it writes for later.
- Where the clean design differs from the code, rewrite the part or change how it works in place of
  a fix around the failure.
- Propose a rewrite of code outside your change to the user before you start it.
- When one of your own changes caused the failure, change or remove that change in place of
  building around it.
- Never add a carve-out where the existing path already covers the case.
- Keep branches small and few. Replace a growing conditional with indirection, abstraction or a
  structure that makes the case impossible instead of handled.
- Build critical paths, such as boot, init and deployment, on robust, declarative mechanisms, never
  on fragile shell scripts.
- Keep builds reproducible. Lock every dependency to an exact version fetched with a checksum, and
  run every build, release included, from a clean checkout with one command and without a manual
  step.
- Never write a parser by hand for an established format.
- Never parse structured data as text.
- Keep communication structured.
- Build output from typed parts, never by string interpolation.
- Read the state already reported by the mechanism instead of adding a parallel flag, sentinel or
  magic string.
- Represent absence as absence: an empty collection, a null or optional, or an error, never a
  placeholder of the same type.
- Never let a value that the caller has to supply fall back silently to an empty or default one,
  such as a request body sent empty because none was built. Make the value required, so a call that
  leaves it out fails.

## Types, input, limits and errors

- Type data everywhere. Never look up keys in raw JSON, dispatch on strings or send an anonymous
  structure on a bus.
- Make illegal states unrepresentable.
- Read and write a stored record as a typed model, converted where it enters or leaves the store.
  Never build or read a stored record as a dictionary literal or by looking up its keys.
- Build a request to another system, and read the response to it, as a typed model, converted to
  the wire form in the adapter for that system. Outside that conversion, never build a request
  body or a part of one, such as a filter, a sort order or paging, as a dictionary literal.
- Define the models for the requests to one system, and the fixed values built from them such as a
  standard sort order, once, in the module shared by all code that calls that system.
- Give the function that sends a request a typed parameter for each part of the request, such as
  the filter, the sort order and the paging. Never merge the parts of a request by combining untyped
  maps.
- Never give an untyped structure a name that makes it look typed, such as an alias for a mapping
  of strings to objects. The alias is only a second name for the untyped structure.
- Judge a string in code by its purpose. Turn a string standing for something that can be typed in
  the language into an enum or a class. Keep a string whose purpose is text, such as a message or
  a name fixed by an outside format, as a string, defined in one place.
- Define a closed set of domain values, such as the outcomes of a decision or the states of a job,
  once, as an enum in the form given in the file for the language in
  `workflow-skills:code-writing`.
- Treat a set extended by modules, such as message types or providers, as not closed, and put it
  into a registry.
- Put the definition of a closed set in the module for the concept it belongs to, such as the user
  roles in the access model. Never define the set in another module or in another form, whether as
  strings, a collection of strings or a separate enum, also not in a module that uses the concept.
- Let an adapter at the edge that maps outside spellings, and a test, refer to the values through
  the definition. Neither of them defines a set.
- State an order among the values of a closed set in the definition of the set, as a rank or a
  comparison written out with the values. Never read the order from position, in a list or in the
  declaration, such as the last entry as the highest role or a comparison of ordinals.
- Write the text of a value of a closed set only in the definition of the set, and name the value
  through the definition everywhere else, also where a type lists the allowed strings.
- Map an outside spelling of a value of a closed set, such as the spelling on the wire or in a
  database, in the adapter at that edge, never in the definition.
- Keep the behavior that belongs to a value of a closed set with the definition of the set, never
  in conditions over the text of the value spread across the callers.
- Convert text into a value of a closed set once, where the text arrives, such as from a JSON field
  or a stored value. Use a check that reads text matching none of the values as unknown, never a
  cast or a default value.
- Turn a value of a closed set back into text only where it leaves the program.
- Store a value as a stable identifier: an enum by a stable name or value, never by its position in
  the declaration, and never any value as the text shown to the user.
- Read a value defined by the data, such as a currency, a unit, a locale or a timezone, from that
  data, never hardcoded, defaulted or inferred, and fail when it is missing. Where only one value
  is allowed, validate the input against it and use the validated value.
- Treat as a tunable every value whose right setting depends on the hardware, the load, the data
  or the environment, such as a size, a count, an interval or a threshold.
- Make every tunable dynamic: derive it at runtime from what it depends on, such as the image count
  required by a graphics surface, and adjust it to what the code observes while it runs. Never
  hardcode, guess or choose it.
- Count a tunable moved somewhere else as still chosen: a name given to it, a parameter filled in
  by a caller with a value of its own choosing, a value computed from another chosen value, and a
  default of a framework or a tool, such as the time limit put on each test by a test runner, all
  leave it hardcoded.
- Replace a timeout with the event or the state it waits for, as the rules on time describe.
- Write a value as a constant only when it is a product choice, a truth that nothing can change,
  such as a constant of mathematics, or a limit of an external system accepted as the rules below
  describe. Name beside the constant the decision or the definition behind it.
- Read a fact defined by an outside specification, such as the status codes of a protocol, from
  the authoritative source, such as a data file published with the specification or a library
  generated from it. Where that is not possible, copy the fact together with a link to the section
  from which it comes and the date that section was checked.
- Read input resiliently. Read a malformed field as unknown, and keep the rest usable.
- Accept one form per input, and refuse tolerance without a technical reason.
- Make a conversion exact or fail. Never apply automatically a conversion that could lose or
  reinterpret a value, such as narrowing a number, a number to text or a negative to unsigned.
- Make a configuration that can't work fail the build or the start, never the first use of it, by
  checking conflicting or impossible settings where they are defined.
- Never set a limit yourself. The resources of the machine and a refusal from an external system
  are the only limits.
- Never set a limit yourself on how the work runs either. Never order, queue or hold back approved
  work behind other work it does not depend on, a lock, a time of day or a core count that you set
  yourself.
- Never add a fixed or configurable cap, or a shape that caps a count or a rate below what the
  hardware can handle, such as a single point through which every request passes one at a time, a
  scan that grows with the count or a table that can't grow.
- Never assume a limit of an external system. Handle the limit when the system rejects a request,
  and accept it only together with what it costs, the official source that documents it, the date
  that source was checked and approval from a person.
- Never accept a limitation yourself. Report the evidence and stop.
- Reserve memory as data arrives, never up front from a length claimed by the other side.
- Let a measurement on one machine inform an experiment, never set a constant, a default, a
  threshold or the choice of which design is built. Derive such a value from the design, such as
  from what the data structure or the algorithm requires, find it at runtime on the machine where
  the software runs, or remove the mechanism that needs it.
- Where judgment is needed, never keep a hand-curated list. Keep the mechanical check strict and
  give the caller an explicit override.
- Let a check distinguish "the value is wrong" from "I couldn't tell". Its result contains an
  explicit status that takes precedence over the exit code.
- Never let a transient failure discard a good value.
- Fail loud. Something that must be handled raises an error when nothing handles it, and a silent
  check never hides a broken state.
- Use, handle or pass on every value returned by a call, errors included. When a part of it is
  never needed, change the call so it no longer returns that part. For a call that you can't
  change, bind that part to a name saying why it is not needed.
- Return an error as a typed value that identifies what failed and contains the error that caused
  it, so a caller can match on it.
- Turn an error into text only where it is shown or logged.
- Return a boolean only for a yes-or-no question. Return a value that may not arrive as an optional
  or an error, and an outcome with several causes as an enum whose variants identify each cause.
- Report success from a confirmed result. A step that can fail returns its outcome, and the next
  step and the message to the user depend on it.
- Fail closed. Deny all access to an unknown, missing or malformed identity, never give it the most
  powerful access, and never reveal in a refusal that something hidden from the caller exists.
- Check a permission by its exact identifier, never by a pattern or substring over text.
- Never let a default open access or share an identity. Never ship a default password, a root shell
  or an automatic login, or a seed, a UUID or a key shared by two installations.
- Leave a value that must be chosen per installation without a default.
- Store a security record, such as a password hash or an encrypted blob, with the algorithm and the
  parameters used to make it, and check the parameters against minimums before you trust it.
- Make a secret impossible to print. Keep it in a type whose printed and debug forms are redacted,
  and remove it from a diagnostic that may contain it before you shorten the diagnostic.
- Never switch transport security off. Keep certificate checks on, and put a private certificate
  authority into the trust store instead of skipping verification.
- Keep authority and consent apart, and check each with a separate mechanism. Authority is whether
  this caller may access something, and consent is whether a person agreed to this act.
- Never let consent grant authority, never count authority as consent, and never let an automatic
  approval grant access.
- Return each verdict together with the facts it was based on. Let each place
  that shows the outcome, such as a command line, a user interface or an API response, write a
  separate message from those facts, so that every message describes the same moment as the
  decision.
- Hand the code that writes a message the facts it needs, such as the operation and the ids it acts
  on, and let that code write the whole sentence. Never define, return or pass a fragment of a
  sentence, such as "for item 42", to be glued into a message.
- Pass a failure across a language or process boundary as data, never as a panic or an exception
  that unwinds across it.
- Choose what leaves a system by an allowlist of fields, never by a denylist.

## Recovery and error messages

- Show an error to a person or an agent only when the system can't recover by itself and only a
  person can fix the cause, such as the one who sees it, someone they can ask, or the developers.
  Until then, let the system recover: it retries a temporary failure, or continues without the
  failed part.
- Give every error shown to a person or an agent a next step, drawn from one central source, never a
  hint written for one case. An error that only reports what happened is incomplete, such as "Image
  processing failed.". So is an error whose next step is what the system could have done itself,
  such as "Image processing failed. Try again later."
  - For a cause they can fix, show how to fix it: "Image couldn't be processed, because its
    metadata is invalid. Upload an image with valid metadata, or convert it to another format
    first."
  - For a cause in the system, show what they can try in the meantime: "Image failed to process due
    to a server error. We have recorded the failure and will work on a fix. In the meantime, try a
    smaller resolution or another format."
  - When nothing is left to try, report in the error that the failure was recorded, and show where
    to check on it later.
- Log every failure whose cause lies in the system, each failed try of a retry included, and say in
  plain words in the error shown for it that it was recorded.
- Always answer a waiting caller. Send a failure back to whoever waits, never only log it on the
  other side.
- Make the system retry by itself a failure known to be temporary, such as a refusal reporting that
  the other side is busy or a network failure, as long as the operation is safe to repeat. An
  operation is safe to repeat when it changes nothing, or when it contains an id derived from
  durable state by which the other side recognizes a repeat.
- Retry a write whose connection dropped only under that condition.
- Never retry automatically a failure not known to be temporary, such as a refused validation or a
  failure that can't be classified. Show it as an error with a next step.
- Show a running retry as progress with the number of tries so far, such as "Image processing
  failed, retrying (3 attempts)…", never as an error.
- Wait between tries for the time given by the refusing system, such as in a `Retry-After` header,
  or else for a randomized pause that grows up to the longest wait acceptable for the purpose of
  the work.
- Retry until the work succeeds or the purpose of it is gone, never until a count or a time limit
  set by the system itself. Do not retry work that would need such a limit.
- Treat a retry that fails again and again as a defect in the code, found through the logs and
  fixed there.
- Give a person who waits on a retry a way to cancel it.
- Give every retry that nobody watches a condition under which its result is no longer needed.
- Once a retry has failed several times, show beside its progress, as information and never as an
  error, that the problem is known and being taken care of and where to check on the work later,
  such as "We're having trouble processing this request and have recorded the incident. Come back
  later to check on its status."
- Give a caller waiting on the work the same information as the response.
- When an external system rejects an optional part of a request, degrade the result instead of
  failing. Send a fallback request without that part, and show a visible note that it was left out.
- Retry a temporary failure of the fallback like any other, and show a refusal from the fallback as
  an error.

## Correctness and change

- Fix a known defect in code that your change adds or edits right away, never record it as work
  for later, and never offer leaving it unfixed as an option. A race left possible by the change
  and a way around a rule are such defects.
- Keep what works through a change. Carrying a working view or contract across is part of the
  change.
- Build every configuration declared as supported by the code on every change.
- Remove a configuration that isn't built.
- Never roll back a settled migration, bring back a retired pattern or reopen settled, approved
  work.
- Find the root cause of a bug. A design that makes the bug possible is a root cause too.
- Correct a wrong migration with a forward migration.
- Let a migration or backfill copy data into its new shape and leave the old data as it is. Remove
  the old data in a separate, later step, and only when something truly needs deleting.
- Before you change where data is stored, such as a mount, a volume or a replaced instance, check
  what data is there and recover what the change would hide or destroy.
- Ship persistent storage in the same change as the feature that writes to it.
- Destroy something only after proof and an explicit yes. Run formatting, wiping or replacing only
  on a state positively proved by a check, and let an inconclusive check block it.
- Ask for a confirmation that lists exactly what will be destroyed, and never let a default, a flag
  or a heuristic skip it.
- Never force in a requirement that doesn't fit the architecture. Say why, and refactor the
  structure until the requirement slots in.
- Never accept "Too hard" as an outcome. A test that still fails does not prove a dead end, so keep
  working through the concrete causes of the failure.
- Never relax an invariant for one change. A change that seems to need it is a design problem.
- In a user interface, show an error only on the part that fails, and a loading indicator for a
  loading state, never an error.
- During a save, show progress, disable every control that could send the save a second time, and
  wait until the save is done.
- Leave the view as it was when an optional feature can't apply.
- Count as text that explains a product any text on a product screen, where the reader uses the
  product, about how the product computes or stores something, why it was built that way, which
  features it does not offer, or where things sit on the screen.
- Text that describes a state of the data or an action of the reader, such as an empty list, a
  failed save or a retry in progress, does not count as text that explains the product.
- Make a product screen self-evident through its labels, controls and layout, and never put text
  that explains the product on it.
- When a part needs such text because its behavior is not evident, change the part, such as its
  label, its grouping or its control. Do not explain it to a tester either.
- Follow `workflow-skills:copywriting` for a marketing page, where the reader decides whether to use
  the product.
- Word a state of the data or the action of the reader by what happened and what the reader can do
  next, including where to check on the work later.
- Avoid imperative or procedural checks. Make the condition fall out of the design where possible.
- Use a conditional database update where possible instead of checking a condition in the program,
  since the data can change after the check and before it is written.

## Tests

- Test an expectation. State the rule followed by the code, run the code on input built by the
  test, and check the result against what that rule gives for that input.
- Never treat the values contained in the shipped code or configuration as an expectation. A test
  that restates them proves nothing.
- Never write a test that checks whether the text of code, a document, a prompt or a configuration,
  as stored in the repository, contains, lacks or matches a string. A check of text produced by the
  code from input built by the test is an expectation and is allowed.
- Delete a test that checks stored text for a string or restates shipped values when your change
  alters it in any way or makes it fail, and keep any assertion in it that runs the code. Never
  rewrite such a test to match the changed text.
- Report a test of that kind outside your change, and leave it in place.
- Keep tests deterministic and reproducible, independent of the clock and of anything outside the
  test.
- Never ship test code. Shipped code takes the same path whether tests exist or not.
- Put failure injection only in an artifact that never ships, and let it run through the real error
  handling.
- Expose nothing for debugging in a release build. Leave debug access out of it, and let the build
  configuration select which kind of build is produced, never a constant edited in source.
- Run tests and probes on synthetic fixtures in throwaway locations, never on real user data or a
  real data store.
- Put test doubles exactly where your own infrastructure ends and nowhere earlier.
- Never double the thing under test, and watch for a permissive double that silently switches off
  the mechanism being tested.
- Let tests contact only the infrastructure you run for them, and block the network beneath every
  client.
- Keep your infrastructure, such as the database, real, at a locked version and in the
  configuration needed in production.
- Keep tests fast and parallel.
- Fail a test that can't get a needed capability, and never skip it. Only a test that needs an
  external artifact, such as a downloaded file, may skip when that artifact is missing. The tests
  in the same suite that use synthetic fixtures still run.
- Reset process-wide state between tests.
- Test each invariant at exactly one level, and don't prove it again at higher levels.
- Prove a rewrite that must give identical results with a suite of equivalence tests. Before the
  change, record the outputs produced by the old code in a canonical serialized form, one that
  always gives the same bytes for the same value, and compare the outputs produced by the new code
  with those bytes. The outputs produced by the old code are the expectation for the rewrite.
- State why for every comparison that is loosened.
- Name the failure mechanism in a regression test, never a ticket, and show the test failing
  against the old code.
- Give each acceptance criterion of a design a separate group of tests.
- Give a known limitation a test that asserts it.

## Scope and size

- Build only what the task needs, and remove what is unused, unasked for or overbuilt, in code,
  files, assets and documents alike.
- Make what you build fit the people who use it. A kit, a report or a set of files made for people
  contains only what a person can look through and choose from.
- Choose the clean, sophisticated option at the smallest size at which it is still clean. A
  one-line filter is better than a separate system that adds nothing.
- Never abstract prematurely.
- Ship a change through every layer affected by it in the same pass.
- Check every consumer of shared code.
- Leave a part that isn't defined yet as an empty stub until it is.
- Never ship a stub, placeholder text, a skeleton page or a link to a destination that doesn't exist
  yet in a finished unit.
- Never let a later planned item put a requirement on current work. At most it shows what the
  current architecture can leave room for.

## How the work is done

- Read the code first, in full around every search hit, and trace the flow in every direction.
- Look for patterns, prior art and documentation before you propose an architecture.
- Debug from the mechanism: name what controls the behavior, state hypotheses, and change one
  variable at a time. A symptom is never evidence of its cause.
- Prove a change on the real path and across the whole chain. A green build is not proof.
- Let a check that can't run the real thing report itself as blocked, never as passed on a
  stand-in.
- Never build a parallel simulation to check again what the real environment already has.
- Check code carried over from another version against the target. Every name used in it must exist
  there with the same signature and meaning.
- Read the error before you retry, and change something before the next try.
- Put into a generated artifact only the output produced by the generator, never diagnostics.
- Operate an interface from its observed state: one action, check the result, then the next, never
  a chain of inputs against an assumed screen.
- Stop a process by its process id, never by a name pattern or the port on which it listens.
- Undo only your own edit, by applying its inverse. Never reset, restore or stash a file that may
  contain other uncommitted work.
- Before you add a dependency, choose its version or write against its API, look up its current
  release and documentation online, check that release for known compromise, and record the check
  with its date.
- Research and pick which library to use yourself.
- Ask the user before you decide where a dependency is fetched from, such as a registry or a git
  repository, and before you vendor a binary.
- State how every claim is known, without blurring the classes: measured (a probe ran),
  compile-proven (it builds but never ran), proven by reading the source, decided, or open with the
  experiment that would resolve it.
- Base a claim about state or cause on raw evidence inspected for that claim, never on a summary or
  a verdict icon. An observation outweighs a conclusion drawn from reading the code.
- Record an experiment that found nothing too.
- Let work that depends on an open point wait for the experiment that resolves it.
- Make every architectural decision deliberately, and write it down with acceptance criteria that
  can be checked, in the commit message or the pull request for the change.
- Change the documentation that describes an interface used by others, such as an API, a command or
  a screen, in the same change as that interface.
- Build in layers, scaffolding first and then one piece at a time. This orders the building only:
  each feature still ships through all its layers in the same pass.
- Never copy code that breaks the rules. If the existing code already violates the rules, never use
  it as prior art to excuse writing the same kind of code. Bad code is debt.
- Where scope allows, rewrite the existing code cleanly. Otherwise integrate your part well and
  leave the rest as it is.

## Rules in other skills

- Follow `workflow-skills:code-writing` for how code reads: its style, comments, names and the
  practices for each language.
- Follow `workflow-skills:writing-style` for the words of comments, documents and messages.
- Follow `workflow-skills:hygiene` for what may leave the machine.
- Follow `workflow-skills:implement` for how a change goes from the user's words to the user's
  review.
- Follow `workflow-skills:visual-verification` to prove a change to a user interface with
  screenshots.
- Follow `workflow-skills:local-cache` for where scratch files go.
