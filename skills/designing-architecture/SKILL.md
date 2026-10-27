---
name: designing-architecture
description: Design or plan the shape of a change or a system: its modules, layers and interfaces, where its data, state and decisions live, and how much of it to build.
---

# Designing architecture

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
- Keep state shared between tasks in one task, and let the other tasks send that task messages.
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
- Let a mutation return only success or failure.
- Read the data again when a notification reports that it changed. Let side effects react to that
  notification, never run inside the mutation.
- Use a subscription, such as websockets, long polling or an event stream, wherever one can be used.
- Prefer reactive, event-driven and data-driven designs over chains of calls in which each step
  starts the next.
- Make work demand-driven with backpressure. Fetch, read or compute something only when the next
  stage can take it.
- Add a queue, a buffer or a cache only where the design includes it together with its purpose.
- Make work idempotent at a stated granularity, checked against durable state.
- Derive the ids sent to another system from durable positions, such as the id of the stored row or
  the offset in the log from which the work came.
- Record first, then act. Before you perform an action, durably write what it acts on, so the
  action refers to that stored record and recovery after a crash replays from it.
- Never compute first and insert later, and never predict a future id.

## No hacks

- Fix a hazard through the architecture, never by bolting on a hack, a band-aid, a workaround or a
  protective check.
- When a change needs a bolt-on, change the architecture so the work slots in.
- Redesign a shape to which such checks are added again and again.

## Limits

- Never set a limit yourself. The resources of the machine and a refusal from an external system
  are the only limits.
- Never set a limit yourself on how the work runs either. Never order, queue or hold back approved
  work behind other work it does not depend on, a lock, a time of day or a core count that you set
  yourself.
- Never add a fixed or configurable cap, or a shape that caps a count or a rate below what the
  hardware can handle, such as a single point through which every request passes one at a time, a
  scan that grows with the count or a table that can't grow.

## Settled work and invariants

- Never roll back a settled migration, bring back a retired pattern or reopen settled, approved
  work.
- Never force in a requirement that doesn't fit the architecture. Say why, and refactor the
  structure until the requirement slots in.
- Never relax an invariant for one change. A change that seems to need it is a design problem.

## Scope and size

- Build only what the task needs, and remove what is unused, unasked for or overbuilt, in code,
  files, assets and documents alike.
- Make what you build fit the people who use it. A kit, a report or a set of files made for people
  contains only what a person can look through and choose from.
- Choose the clean, sophisticated option at the smallest size at which it is still clean. A
  one-line filter is better than a separate system that adds nothing.
- Never abstract prematurely.
- Ship a change through every layer affected by it in the same pass.
- Leave a part that isn't defined yet as an empty stub until it is.
- Never ship a stub, placeholder text, a skeleton page or a link to a destination that doesn't exist
  yet in a finished unit.
- Never let a later planned item put a requirement on current work. At most it shows what the
  current architecture can leave room for.

## How the work is done

- Look for patterns, prior art and documentation before you propose an architecture.
- Let work that depends on an open point wait for the experiment that resolves it.
- Make every architectural decision deliberately, and write it down with acceptance criteria that
  can be checked, in the commit message or the pull request for the change.
- Build in layers, scaffolding first and then one piece at a time.

## Rules in other skills

- Follow `workflow-skills:implement` for how a change goes from the user's words to the user's
  review.
