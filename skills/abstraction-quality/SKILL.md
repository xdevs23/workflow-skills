---
name: abstraction-quality
description: Review whether the abstractions in a change are justified.
---

# Abstraction quality

Review the change for one thing only: whether every abstraction in it is justified by how the code
uses it.

- Report a leaky abstraction: an interface that requires the caller to know how it works inside.
  Calling a function, using an object, importing a module or instantiating a class never requires
  knowing how that part of the code works.
- Report a premature or speculative abstraction: indirection, generics, plugin points or
  configuration knobs with a single caller while a second use is not in sight. Accept an
  abstraction with at most one caller only where the notes describing the change require it, never
  on an assumption.
- Report a wrapper, such as a class or a function whose only content is one fixed expression that
  builds or calls other parts, when its name is less clear than the code inside it, such as
  `TrackedQueue()` for `Counter(Listeners())`. The fix is to remove the wrapper and let the callers
  write the code inside it.
- Accept a wrapper that is a distinct type for a value, such as a Kotlin value class, also with a
  single caller.
- Accept a wrapper whose name is clearer than the code inside it, such as a call too complex to be
  readable in one line or a library call whose flags set the shape of the result, also with a single
  caller.
- Report a wrong boundary: a boundary drawn where it creates friction instead of where the domain
  actually divides.
- Report a missing abstraction: repeated shapes that need a name.
- State in every finding whether the fix is to add, remove or move the abstraction.
