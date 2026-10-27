---
name: writing-code
description: Write or change code in any language, including its types, comments, names and strings.
---

# Writing code

- Before you write code in a language, read the file for that language in the `languages`
  directory next to this file: `kotlin.md`, `rust.md`, `c-cpp.md`, `go.md`, `nix.md`,
  `typescript.md` or `python.md`.

## Code style

- Write code that reads like the surrounding code, matching its comment density, its naming and its
  idioms.
- When you change code that falls short of a high standard, improve it.
- Never rewrite existing code beyond your change.
- Write code so what it does is visible at a glance, with annotations, decorators, delegates,
  operator overloads, data classes and abstractions where they make it read better.
- Use the idioms of each language, listed in the file for that language in `languages`.
- Write a structure that follows a specification or a hierarchy as a typed DSL, so the code reads
  like the structure and building a structure that breaks the constraints of the specification
  fails.
- Comment only where the logic isn't self-evident, and first try to make such code clearer.
- Let a comment contain a constraint or a reason not visible in the code.
- Never restate the next line in a comment, narrate a change in it ("used to be A, now B") or
  address a reviewer in it.
- Name things with plain words for what they do.
- Start the name of a function that does something with a verb for what it does, such as
  `findCartsReferencingProduct` or `convertToRgb`.
- Never invent a metaphor for a name, and never use `util`, `misc`, `helper` or a similar grab-bag
  name.
- Apply the naming test to each name as you write it: hide the docstring for it and read only the
  name and a line that uses it. Rename it when you then can't say what the value contains or what
  the code does.
- Write a library call whose flags decide the shape of its result, such as a serializer called with
  several flags, once, as a function or method named for that result in the module that owns the
  type, and call that function wherever the result is needed. This applies with one caller too.
- Treat a file past about 500 lines as a candidate for splitting.
- Keep the public surface small. Make implementation types internal or private, and make public
  only what a consumer calls.
- Name the arguments of a call that passes several values of the same type.
- Document in an unsafe or foreign-interface function the contract to be kept by every caller.
- Make code pass the formatter and linter configuration of the tree into which it goes, or of the
  upstream project for which it is written, with warnings treated as errors.
- Never silence a lint check or a warning, such as with a suppression comment, an excluded file or
  folder, a disabled or lowered setting, or a warning left standing in the output.
- Remove every silenced check in the files your change edits, also one from before your change,
  and fix what it hid. Removing it is always part of the change.
- Give a new small file, such as a configuration file, a one-line SPDX license identifier, never a
  full block of license boilerplate.
- Don't access objects by raw string attributes, such as `doc["key"]` or `item.get("key")`, if a
  cleaner way of access is possible. The cleaner way is a typed model of the object. A constant
  that contains the key is the same access by a string.
- Where in scope, refactor an existing untyped structure into the clean structure it should have
  had all along.
- Never change what was passed into a function. Convert an input into a new value, and change data
  passed in by the caller only when changing it is the stated purpose of the function.
- Represent one resource, such as a device, a connection or an open file, by exactly one object that
  can't be copied by accident.
- Give every concurrent task a scope that waits for it to finish or cancels it.
- Never start a fire-and-forget thread, and never read a flag across threads.
- Run code bound to a thread, such as rendering or the user interface, on that thread, and assert at
  its entry point that it runs there.
- Never let an unordered collection determine a result. When several items can match, define which
  one wins or make the ambiguity an error. Never depend on the order in which a map, a directory
  listing or an unsorted query returns items.
- Never drain a queue or a channel in a loop only to discard its values. Process every value in the
  loop, or keep a slot replaced by each new value where only the latest one is needed.
- Let a stream own its resources, and release them when the consumer is dropped.
- Stream files and the bodies of requests and responses, never load them whole.
- Prefer asynchronous code wherever it fits.

## Time

- Never synchronize by time. Wait on the event or the state that signals readiness, never on a
  sleep, a delay or a polling loop.
- Count progress in the unit of the work, such as ticks, frames or samples. Use wall time only when
  the intent is real time, such as waiting 200 ms, and measure it on a monotonic clock.

## Write once

- Write every part once. Duplication is a defect wherever it is found.
- Reuse the utilities, patterns, dependencies and code paths of the project. Prior art in the
  codebase determines how a new piece behaves.
- Never add a carve-out where the existing path already covers the case.
- Keep branches small and few. Replace a growing conditional with indirection, abstraction or a
  structure that makes the case impossible instead of handled.
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
- Avoid imperative or procedural checks. Make the condition fall out of the design where possible.

## Typed data and requests

- Type data everywhere. Never look up keys in raw JSON, dispatch on strings or send an anonymous
  structure on a bus.
- Make illegal states unrepresentable.
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

## Closed sets

- Define a closed set of domain values, such as the outcomes of a decision or the states of a job,
  once, as an enum in the form given in the file for the language in `languages`.
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

## Reading input and conversions

- Read a value defined by the data, such as a currency, a unit, a locale or a timezone, from that
  data, never hardcoded, defaulted or inferred, and fail when it is missing. Where only one value
  is allowed, validate the input against it and use the validated value.
- Read input resiliently. Read a malformed field as unknown, and keep the rest usable.
- Accept one form per input, and refuse tolerance without a technical reason.
- Make a conversion exact or fail. Never apply automatically a conversion that could lose or
  reinterpret a value, such as narrowing a number, a number to text or a negative to unsigned.
- Make a configuration that can't work fail the build or the start, never the first use of it, by
  checking conflicting or impossible settings where they are defined.
- Reserve memory as data arrives, never up front from a length claimed by the other side.

## Tunables and constants

- Treat as a tunable every value whose right setting depends on the hardware, the load, the data
  or the environment, such as a size, a count, an interval or a threshold.
- Make every tunable dynamic: derive it at runtime from what it depends on, such as the image count
  required by a graphics surface, and adjust it to what the code observes while it runs. Never
  hardcode, guess or choose it.
- Count a tunable moved somewhere else as still chosen: a name given to it, a parameter filled in
  by a caller with a value of its own choosing, a value computed from another chosen value, and a
  default of a framework or a tool, such as the time limit put on each test by a test runner, all
  leave it hardcoded.
- Replace a timeout with the event or the state it waits for.
- Write a value as a constant only when it is a product choice, a truth that nothing can change,
  such as a constant of mathematics, or a limit of an external system accepted as
  `workflow-skills:working-with-outside-systems` describes. Name beside the constant the decision
  or the definition behind it.
- Read a fact defined by an outside specification, such as the status codes of a protocol, from
  the authoritative source, such as a data file published with the specification or a library
  generated from it. Where that is not possible, copy the fact together with a link to the section
  from which it comes and the date that section was checked.
- Let a measurement on one machine inform an experiment, never set a constant, a default, a
  threshold or the choice of which design is built. Derive such a value from the design, such as
  from what the data structure or the algorithm requires, find it at runtime on the machine where
  the software runs, or remove the mechanism that needs it.

## Results, verdicts and messages

- Where judgment is needed, never keep a hand-curated list. Keep the mechanical check strict and
  give the caller an explicit override.
- Let a check distinguish "the value is wrong" from "I couldn't tell". Its result contains an
  explicit status that takes precedence over the exit code.
- Use, handle or pass on every value returned by a call, errors included. When a part of it is
  never needed, change the call so it no longer returns that part. For a call that you can't
  change, bind that part to a name saying why it is not needed.
- Return a boolean only for a yes-or-no question. Return a value that may not arrive as an optional
  or an error, and an outcome with several causes as an enum whose variants identify each cause.
- Return each verdict together with the facts it was based on. Let each place
  that shows the outcome, such as a command line, a user interface or an API response, write a
  separate message from those facts, so that every message describes the same moment as the
  decision.
- Hand the code that writes a message the facts it needs, such as the operation and the ids it acts
  on, and let that code write the whole sentence. Never define, return or pass a fragment of a
  sentence, such as "for item 42", to be glued into a message.

## How the work is done

- Keep what works through a change. Carrying a working view or contract across is part of the
  change.
- Check every consumer of shared code.
- Read the code first, in full around every search hit, and trace the flow in every direction.
- Check code carried over from another version against the target. Every name used in it must exist
  there with the same signature and meaning.
- Undo only your own edit, by applying its inverse. Never reset, restore or stash a file that may
  contain other uncommitted work.
- Change the documentation that describes an interface used by others, such as an API, a command or
  a screen, in the same change as that interface.
- Never copy code that breaks the rules. If the existing code already violates the rules, never use
  it as prior art to excuse writing the same kind of code. Bad code is debt.
- Where scope allows, rewrite the existing code cleanly. Otherwise integrate your part well and
  leave the rest as it is.

## Strings in code

- Address a string meant for a model to the model.
- Keep repository paths out of a string meant for a model.
- Where an i18n key is referenced, add a comment there that describes the intent of the string.

## Rules in other skills

- Follow `workflow-skills:hygiene` for what may leave the machine.
