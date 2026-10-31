---
name: writing-code
description: Write or change code in any language, including types, comments, names and strings
---

# Writing code

- Before writing code in a language, read file for that language in `languages` dir next to this
  file: `kotlin.md`, `rust.md`, `c-cpp.md`, `go.md`, `nix.md`, `typescript.md` or `python.md`.

## Code style

- Write code that reads like surrounding code. Match its comment density, naming, idioms.
- When changing code below high standard, improve it.
- Never rewrite existing code beyond your change.
- Make what code does visible at a glance. Use annotations, decorators, delegates, operator
  overloads, data classes and abstractions where they make it read better.
- Use idioms of each language, listed in file for that language in `languages`.
- Write structure following specification or hierarchy as typed DSL. Code reads like the structure.
  Building structure that breaks constraints of specification fails.
- Comment only where logic is not self-evident. First try making such code clearer.
- Let comment contain constraint or reason not visible in code.
- Never restate next line in comment, narrate change in it ("used to be A, now B") or address
  reviewer in it.
- Name things with plain words for what they do.
- Start name of function that does something with verb for what it does, e.g.
  `findCartsReferencingProduct` or `convertToRgb`.
- Never invent metaphor for name. Never use `util`, `misc`, `helper` or similar grab-bag name.
- Apply naming test to each name as you write it: hide its docstring, read only name and one line
  using it. Rename when you then cannot say what value contains or what code does.
- Library call whose flags decide shape of its result, e.g. serializer called with several flags:
  write it once, as function or method named for that result, in module that owns the type. Call
  that function wherever result needed. Applies with one caller too.
- Treat file past about 500 lines as candidate for splitting.
- Keep public surface small. Make implementation types internal or private. Make public only what
  consumer calls.
- Name arguments of call that passes several values of same type.
- Document in unsafe or foreign-interface function the contract to be kept by every caller.
- Make code pass formatter and linter configuration of tree into which it goes, or of upstream
  project for which it is written. Warnings treated as errors.
- Never silence lint check or warning, e.g. by suppression comment, excluded file or folder,
  disabled or lowered setting, or warning left standing in output.
- Remove every silenced check in files edited by your change, also one from before your change.
  Fix what it hid. Removing it is always part of change.
- Give new small file, e.g. configuration file, one-line SPDX license identifier. Never full block
  of license boilerplate.
- Do not access objects by raw string attributes, e.g. `doc["key"]` or `item.get("key")`, if cleaner
  access possible. Cleaner way: typed model of object. Constant containing the key = same access by
  string.
- Where in scope, refactor existing untyped structure into clean structure, which it should have had
  all along.
- Never change what was passed into function. Convert input into new value. Change data passed in
  by caller only when changing it is stated purpose of function.
- Represent one resource, e.g. device, connection or open file, by exactly one object that cannot be
  copied by accident.
- Give every concurrent task scope that waits for it to finish or cancels it.
- Never start fire-and-forget thread. Never read flag across threads.
- Run code bound to thread, e.g. rendering or UI, on that thread. Assert at its entry point that it
  runs there.
- Never let unordered collection determine result. When several items can match, define which one
  wins or make ambiguity an error. Never depend on order in which map, directory listing or unsorted
  query returns items.
- Never drain queue or channel in loop only to discard its values. Process every value in loop, or
  keep slot replaced by each new value where only latest one needed.
- Let stream own its resources. Release them when consumer dropped.
- Stream files and bodies of requests and responses. Never load them whole.
- Prefer async code wherever it fits.

## Time

- Never synchronize by time. Wait on event or state signalling readiness, never on sleep, delay or
  polling loop.
- Count progress in unit of the work, e.g. ticks, frames or samples. Use wall time only when intent
  is real time, e.g. waiting 200 ms. Measure it on monotonic clock.

## Write once

- Write every part once. Duplication = defect wherever found.
- Reuse utilities, patterns, dependencies and code paths of project. Prior art in codebase
  determines how new piece behaves.
- Never add carve-out where existing path already covers case.
- Keep branches small and few. Replace growing conditional with indirection, abstraction or
  structure that makes the case impossible instead of handled.
- Never write parser by hand for established format.
- Never parse structured data as text.
- Keep communication structured.
- Build output from typed parts, never by string interpolation.
- Read state already reported by mechanism instead of adding parallel flag, sentinel or magic
  string.
- Represent absence as absence: empty collection, null or optional, or error. Never placeholder of
  same type.
- Never let value to be supplied by caller fall back silently to empty or default one, e.g.
  request body sent empty because none built. Make value required, so call leaving it out fails.
- Avoid imperative or procedural checks. Make condition fall out of design where possible.

## Typed data and requests

- Type data everywhere. Never look up keys in raw JSON, dispatch on strings or send anonymous
  structure on bus.
- Make illegal states unrepresentable.
- Build request to another system, and read response to it, as typed model, converted to wire form
  in adapter for that system. Outside that conversion, never build request body or part of one,
  e.g. filter, sort order or paging, as dictionary literal.
- Define models for requests to one system, and fixed values built from them, e.g. standard sort
  order, once, in module shared by all code calling that system.
- Give function that sends request one typed parameter per part of request, e.g. filter, sort
  order, paging. Never merge parts of request by combining untyped maps.
- Never give untyped structure a name that makes it look typed, e.g. alias for mapping of strings
  to objects. Alias is only second name for the untyped structure.
- Judge string in code by its purpose. String standing for something that can be typed in the
  language: turn into enum or class. String whose purpose is text, e.g. message or name fixed by
  outside format: keep as string, defined in one place.

## Closed sets

- Define closed set of domain values, e.g. outcomes of decision or states of job, once, as enum in
  form given in file for the language in `languages`.
- Treat set extended by modules, e.g. message types or providers, as not closed. Put it into
  registry.
- Put definition of closed set in module for concept it belongs to, e.g. user roles in access
  model. Never define set in another module or another form, whether as strings, collection of
  strings or separate enum, also not in module that uses the concept.
- Let adapter at edge that maps outside spellings, and test, refer to values through definition.
  Neither of them defines a set.
- State order among values of closed set in definition of set, as rank or comparison written out
  with values. Never read order from position, in list or in declaration, e.g. last entry as
  highest role or comparison of ordinals.
- Write text of value of closed set only in definition of set. Name value through definition
  everywhere else, also where a type lists allowed strings.
- Map outside spelling of value of closed set, e.g. spelling on wire or in database, in adapter at
  that edge, never in definition.
- Keep behavior belonging to value of closed set with definition of set, never in conditions over
  text of value spread across callers.
- Convert text into value of closed set once, where text arrives, e.g. from JSON field or stored
  value. Use check that reads text matching none of the values as unknown, never cast or default
  value.
- Turn value of closed set back into text only where it leaves program.
- Store value as stable identifier: enum by stable name or value, never by position in
  declaration. Never store any value as text shown to user.

## Reading input and conversions

- Read value defined by data, e.g. currency, unit, locale or timezone, from that data. Never
  hardcoded, defaulted or inferred. Fail when missing. Where only one value allowed, validate input
  against it and use validated value.
- Read input resiliently. Read malformed field as unknown, keep rest usable.
- Accept one form per input. Refuse tolerance without technical reason.
- Make conversion exact or fail. Never apply automatically conversion that could lose or
  reinterpret value, e.g. narrowing number, number to text or negative to unsigned.
- Make configuration that cannot work fail build or start, never first use of it. Check conflicting
  or impossible settings where they are defined.
- Reserve memory as data arrives, never up front from length claimed by other side.

## Tunables and constants

- Treat as tunable every value whose right setting depends on hardware, load, data or environment,
  e.g. size, count, interval or threshold.
- Make every tunable dynamic: derive it at runtime from what it depends on, e.g. image count
  required by graphics surface, and adjust it to what code observes while running. Never hardcode,
  guess or choose it.
- Count tunable moved somewhere else as still chosen: name given to it, parameter filled in by
  caller with value of its own choosing, value computed from another chosen value, and default of
  framework or tool, e.g. time limit put on each test by test runner. All leave it hardcoded.
- Replace timeout with event or state it waits for.
- Write value as constant only when it is product choice, truth nothing can change, e.g. constant
  of mathematics, or limit of external system accepted as
  `workflow-skills:working-with-outside-systems` describes. Beside constant, name decision or
  definition behind it.
- Read fact defined by outside specification, e.g. status codes of protocol, from authoritative
  source, e.g. data file published with specification or library generated from it. Where not
  possible, copy fact together with link to section from which it comes and date on which that
  section was checked.
- Let measurement on one machine inform experiment. Never let it set constant, default, threshold
  or choice of which design is built. Derive such value from design, e.g. from what data structure
  or algorithm requires, find it at runtime on machine where software runs, or remove mechanism
  that needs it.

## Results, verdicts and messages

- Where judgment needed, never keep hand-curated list. Keep mechanical check strict. Give caller
  explicit override.
- Let check distinguish "the value is wrong" from "I couldn't tell". Its result contains explicit
  status that overrides exit code.
- Use, handle or pass on every value returned by call, errors included. When part of it never
  needed, change call so it no longer returns that part. For call whose code you cannot change, bind
  that part to name saying why it is not needed.
- Return boolean only for yes-or-no question. Return value that may not arrive as optional or
  error, and outcome with several causes as enum whose variants identify each cause.
- Return each verdict together with facts on which it was based. Let each place showing outcome,
  e.g. command line, UI or API response, write separate message from those facts, so every message
  describes same moment as decision.
- Hand code that writes message the facts needed by it, e.g. operation and ids on which it acts. Let
  that code write whole sentence. Never define, return or pass sentence fragment, e.g. "for item
  42", to be glued into message.

## How the work is done

- Keep what works through a change. Carrying working view or contract across = part of change.
- Check every consumer of shared code.
- Read code first, in full around every search hit. Trace flow in every direction.
- Check code carried over from another version against target. Every name used in it must exist
  there with same signature and meaning.
- Undo only your own edit, by applying its inverse. Never reset, restore or stash file that may
  contain other uncommitted work.
- Change documentation describing interface used by others, e.g. API, command or screen, in same
  change as that interface.
- Never copy code that breaks rules. If existing code already violates rules, never use it as prior
  art to excuse writing same kind of code. Bad code = debt.
- Where scope allows, rewrite existing code cleanly. Otherwise integrate your part well, leave rest
  as is.

## Strings in code

- Address string meant for model to the model.
- Keep repository paths out of string meant for model.
- Where i18n key referenced, add comment there describing intent of string.

## Rules in other skills

- Follow `workflow-skills:hygiene` for what may leave the machine.
