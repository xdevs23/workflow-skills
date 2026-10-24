---
name: code-writing
description: Write or change code in any language, including its comments, names and strings.
---

# Code writing

- Load `workflow-skills:writing-style` first.
- Before you write code in a language, read the file for that language in the `languages`
  directory next to this file: `kotlin.md`, `rust.md`, `c-cpp.md`, `go.md`, `nix.md`,
  `typescript.md` or `python.md`.
- Follow every rule by what it is for. Getting a result forbidden by a rule through another route,
  such as a cast hidden in a helper, a type widened until a value fits or a term redefined until
  the work passes, breaks the rule just as the forbidden form does. When a rule stands in the way
  of your work, name it where you report your work, and never go around it.

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

## Tests

- Bound a test by the progress of the work it runs, such as ticks or event-loop turns, never by
  wall time.
- Fail a test once nothing is left that could move it on, such as when the channel it waits on is
  closed, the process it waits for has exited or the event loop has no pending work.
- Switch off the wall-time limit set by default by the test runner.

## Strings in code

- Address a string meant for a model to the model.
- Keep repository paths out of a string meant for a model.
- Where an i18n key is referenced, add a comment there that describes the intent of the string.
- Write a string shown on a product screen as a label, an action or a state on which the reader
  acts.
- Keep text that explains the product, as defined in `workflow-skills:engineering-principles`, out
  of a string shown on a product screen.

## Rules in other skills

- Follow `workflow-skills:engineering-principles` for the shape of the system to which the code
  belongs and the way the work is done.
- Follow `workflow-skills:writing-style` for the words of comments and strings.
- Follow `workflow-skills:hygiene` for what may go into a tracked file or leave the machine at all.
