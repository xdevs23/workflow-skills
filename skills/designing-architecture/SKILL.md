---
name: designing-architecture
description: Design or plan shape of change or system: modules, layers, interfaces, where data, state and decisions live, how much to build
---

# Designing architecture

## The hollow lattice

- Design architecture as hollow lattice. New module slots in without change to core. Core containing
  details of modules plugged into it = defective.
- Add new kind of thing, e.g. message type, provider or module, by registering it in registry.
  Never by editing shared switch or enum.
- Dispatch data to handler for it by identifier included in data for that purpose, e.g. type
  declared in data. Never by matching names or pulling key out of payload.
- Let shape of data flow show intent. Before writing step named after outcome, e.g. "ensure first"
  or "start turn", check whether data flow already produces that outcome, or would after small
  change.
- Never name concrete case in shared code. Leave module types, shapes of providers and words from
  domain out of generic code.
- Design, name and word platform concept apart from first consumer using it. Plug consumers in as
  subsystems under the concept.
- Let nothing cross boundary between layers unchanged. Convert data arriving at layer into typed
  fields defined in that layer, which do not mention any detail of other layer. Convert data back
  into form used by other layer when it goes back.
- Map every field of form used by other layer, or drop field on purpose.
- Hand collaborators in, never fetch them from global registry.
- Give each source of a value and each way of building a dependency one unit. Hand that unit to
  code using it. Change of source then edits only that unit and composition root, the place where
  app creates dependencies and hands them in.
- Put into base interface only members present in every implementation.
- Connect two subsystems that must communicate through one named bridge, so neither contains details
  of the other.
- Keep contracts tiny: one or two required members, rest optional or derived.
- Discover interface from inside out, from what implementing code does and needs, one piece at a
  time. Never as full interface written up front from assumptions.
- Shape architecture so requirements fit naturally.
- Refactor wrong foundation. Delete machinery compensating for it.
- Preserve useful abstractions.
- Choose structures that show intent.
- Reject specification that requires breaking the architecture.
- Build code in distinct modules, layers and interfaces: one adapter handles input, another
  output, core contains details of neither, UI separate from renderer drawing it.

## Separation and ownership

- Keep data, logic and presentation in distinct layers.
- Put each part of new feature into the layer already present in project for its kind, e.g. model
  into models, queries into services, handlers into routes. Package or module for one feature
  bundling several layers is not a layer of its own, also when each layer is separate file inside
  it.
- Give each component one job. Put check into component responsible for what it checks.
- Keep business logic out of boundary, e.g. endpoint or command handler. Boundary only passes what
  caller asked for on to code containing the logic.
- Let shell or adapter only package the application, without any logic of the application.
- Let each entity own its state and lifecycle. Never build god object, bag of loose state or
  global mutable state behind lock.
- Prefer asking another entity through its contract over reading its stored state directly.
- Keep state shared between tasks in one task. Let other tasks send that task messages.
- Never let shared component, e.g. web server, database or message bus, wait for or depend on
  setup of services using it.

## Truth, state and decisions

- Make each decision in one place, record it once, let all other code read the record.
- A check that derives same decision a second time shows decision is not recorded. Record decision,
  delete second derivation.
- Define once a value on which two programs or languages must agree. Never as copy in each.
- Keep truth in durable state, e.g. database. Event only signals that stored data changed.
  Receiver reads current data from store. Recovery from crash reads stored data.
- Let signal contain ids and flags, never content. Receiver fetches what it needs by id.
- Act in handler on source identified in event, never on ambient "current" instance.
- Derive state. Never store it beside data from which it follows. This rule comes before preference
  for asking through contract: read stored state of another entity directly before storing data
  derived from it.
- Never treat cache, shortcut or any other optimization as truth. Everything works without it,
  only slower.
- Make derived form, e.g. source data formatted for one consumer or form for display, rebuildable
  from data from which it was derived. Never read it back as data.
- Make optimizations, caches and buffers smoothing jitter pluggable, so each can be removed and
  system tested without it.
- Compute expensive derived value, e.g. layout or measurements made on text, once per change of
  inputs from which it is computed. Never on every read during a frame. Computed form is never the
  truth.
  Events, observers, subscriptions or another push mechanism may report the change.
- Keep state deterministic and reloadable. Correctness never depends on short-lived state in
  client.
- Let mutation return only success or failure.
- Read data again when notification reports it changed. Let side effects react to that
  notification, never run inside the mutation.
- Use subscription, e.g. websockets, long polling or event stream, wherever one can be used.
- Prefer reactive, event-driven and data-driven designs over chains of calls where each step
  starts the next.
- Make work demand-driven with backpressure. Fetch, read or compute something only when next stage
  can take it.
- Add queue, buffer or cache only where design includes it together with its purpose.
- Make work idempotent at stated granularity, checked against durable state.
- Derive ids sent to another system from durable positions, e.g. id of stored row or offset in log
  from which the work came.
- Record first, then act. Before performing action, durably write what it acts on, so action
  refers to that stored record and recovery after crash replays from it.
- Never compute first and insert later. Never predict future id.

## No hacks

- Fix hazard through architecture, never by bolting on hack, band-aid, workaround or protective
  check.
- When change needs bolt-on, change architecture so the work slots in.
- Redesign shape to which such checks get added again and again.

## Limits

- Never set limit yourself. Resources of machine and refusal from external system = only limits.
- Never set limit yourself on how work runs either. Never order, queue or hold back approved work
  behind other work on which it does not depend, a lock, a time of day or a core count set by
  yourself.
- Never add fixed or configurable cap, or shape capping count or rate below what hardware can
  handle, e.g. single point through which every request passes one at a time, scan growing with
  count or table that cannot grow.

## Settled work and invariants

- Never roll back settled migration, bring back retired pattern or reopen settled, approved work.
- Never force in requirement that does not fit architecture. Say why. Refactor structure until
  requirement slots in.
- Never relax invariant for one change. Change that seems to need it = design problem.

## Scope and size

- Build only what task needs. Remove what is unused, unasked for or overbuilt, in code, files,
  assets and documents alike.
- Make what you build fit people using it. Kit, report or set of files made for people contains only
  what a person can look through and choose from.
- Choose clean, sophisticated option at smallest size at which it's still clean. One-line filter
  beats separate system adding nothing.
- Never abstract prematurely.
- Ship change through every layer affected by it in same pass.
- Leave part not defined yet as empty stub until it is.
- In finished unit, never ship stub, placeholder text, skeleton page or link to destination that
  does not exist yet.
- Never let later planned item put requirement on current work. At most it shows what current
  architecture can leave room for.

## How the work is done

- Look for patterns, prior art and documentation before proposing architecture.
- Let work depending on open point wait for experiment resolving it.
- Make every architectural decision deliberately. Write it down with checkable acceptance criteria,
  in commit message or pull request for the change.
- Build in layers, scaffolding first, then one piece at a time.

## Rules in other skills

- Follow `workflow-skills:implement` for how change goes from user's words to user's review.
