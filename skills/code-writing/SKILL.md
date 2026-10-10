---
name: code-writing
description: Applies whenever you write or change code in any language, including its comments, names and strings.
---

# Code writing

- Load `workflow-skills:writing-style` first.
- Before you write code in a language, read its file in the `languages` directory beside this file:
  `kotlin.md`, `rust.md`, `c-cpp.md`, `go.md`, `nix.md`, `typescript.md` or `python.md`.

## Code style

- Write code that reads like the surrounding code, matching its comment density, naming and idiom.
- Improve code you change where it falls short of a high standard, and rewrite no existing code
  beyond what you change.
- Write code so what it does is visible at a glance, with annotations, decorators, delegates,
  operator overloads, data classes and abstractions where they make it read better.
- Use each language's own idioms, which its file in `languages` lists.
- Write a structure that follows a specification or a hierarchy as a typed DSL, so the code reads
  like the structure and building a structure that breaks the specification's constraints fails.
- Comment only where the logic isn't self-evident, and first try to make such code clearer.
- Let a comment state a constraint or reason the code can't show. A comment never restates the next
  line, narrates a change ("used to be A, now B") or talks to a reviewer.
- Name things with plain words for what they do, and invent no metaphors. Use no `util`, `misc`,
  `helper` or similar grab-bag name.
- Apply the naming test to every name you write: hide its docstring and read only the name and a
  line that uses it. Rename it when you can't then say what the value holds or what the code does.
- Treat a file past about 500 lines as a candidate for splitting.
- Keep the public surface small: implementation types are internal or private, and only what a
  consumer calls is public.
- Name the arguments of a call that passes several values of the same type.
- Document in an unsafe or foreign-interface function the contract its caller must keep.
- Make code pass the formatter and linter configuration of the tree it goes into, or of the upstream
  project it is written for, with warnings treated as errors.
- Give a new small file, such as a configuration file, a one-line SPDX license identifier, never a
  full license boilerplate block.

## Strings in code

- Address a string meant for a model to the model, and put no repository paths in it.
- Give an i18n key a comment at its reference site stating the intent of the string.
- Write a string shown on a product screen as a label, an action or a state the reader acts on,
  and keep text that explains the product out of it, as `workflow-skills:engineering-principles`
  defines that text.

## Rules other skills hold

- Follow `workflow-skills:engineering-principles` for the shape of the system the code belongs to
  and the way the work is done.
- Follow `workflow-skills:writing-style` for the words of comments and strings.
- Follow `workflow-skills:hygiene` for what may reach a tracked file or leave the machine at all.
