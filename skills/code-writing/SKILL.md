---
name: code-writing
description: Applies whenever you write or change code in any language, including its comments, names and strings.
---

# Code writing

**Load the `workflow-skills:writing-style` skill first.** It binds every comment, document, commit
message and reply this skill produces, and it is not optional when working with this plugin.

These rules bind how the code you write reads. `workflow-skills:engineering-principles` holds the
shape of the system the code belongs to.

- Before you write code in a language, read its file in the `languages` directory beside this file:
  `kotlin.md`, `rust.md`, `c-cpp.md`, `go.md`, `nix.md`, `typescript.md` or `python.md`.

## Code style

- Write code that reads like the surrounding code: match its comment density, naming and idiom.
  Where code you change falls short of a high standard, improve that code as part of your change,
  and don't rewrite existing code beyond what you change.
- Write code to be read again and again, so that what it does is visible at a glance. Use
  annotations, decorators, delegates, operator overloads, data classes and abstractions where they
  make it read better.
- Use each language's own idioms. Kotlin: scope functions, collection operators, coroutines,
  channels, flows, extension functions, sealed classes and exhaustive `when` over them, delegated
  properties, reified type parameters, infix and inline functions, DSLs with `@DslMarker` scopes,
  default arguments and secondary constructors in place of overload sets. Python: comprehensions,
  context managers, dataclasses, generators, the walrus operator. Rust: iterators, pattern matching,
  `Result` and `Option` combinators, trait implementations. TypeScript: discriminated unions, const
  assertions, template literal types. Nix: `pkgs.formats`, flakes, input overrides, `--show-trace`.
- Where a structure follows a specification or a hierarchy, write the structure as a typed DSL, so
  the code reads like the structure, and building a structure that breaks the specification's
  constraints fails.
- Comment only where the logic isn't self-evident. A line that needs a comment is first a reason to
  make the code clearer. A comment states a constraint or reason the code can't show, and never
  restates the next line, narrates a change ("used to be A, now B") or talks to a reviewer.
- Name things with plain words for what they do, and invent no metaphors. Use no `util`, `misc`,
  `helper` or similar grab-bag: find the name of what the code does.
- Treat a file past about 500 lines as a candidate for splitting.
- Keep the public surface small: implementation types are internal or private, and only what a
  consumer calls is public.
- Put a general extension function, one reusable anywhere, in a file under the package path of the
  type it extends, such as `extensions/androidx/compose/ui/graphics/Color.kt`.
- Name the arguments of a call that passes several values of the same type.
- Document in an unsafe or foreign-interface function the contract its caller must keep.
- Make code pass the formatter and linter configuration of the tree it goes into, or of the upstream
  project it is written for, with warnings treated as errors.
- Give a new small file, such as a configuration file, a one-line SPDX license identifier, never a
  full license boilerplate block.

## Strings in code

- Address a string meant for a model to the model, and put no repository paths in it.
- Give an i18n key a comment at its reference site stating the intent of the string.

## Rules other skills hold

- Follow `workflow-skills:engineering-principles` for the shape of the system and the way the work
  is done.
- Follow `workflow-skills:writing-style` for the words of comments and strings.
- Follow `workflow-skills:hygiene` for what may reach a tracked file or leave the machine at all.
