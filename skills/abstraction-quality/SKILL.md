---
name: abstraction-quality
description: Review whether abstractions in change are justified.
---

# Abstraction quality

Review change for one thing only: whether every abstraction in it is justified by how code uses
it.

- Report leaky abstraction: interface that requires caller to know how it works inside. Calling
  function, using object, importing module or instantiating class never requires knowing how that
  part of code works.
- Report premature or speculative abstraction: indirection, generics, plugin points or
  configuration knobs with single caller while second use not in sight. Accept abstraction with at
  most one caller only where notes describing change require it, never on assumption.
- Report wrapper, e.g. class or function whose only content is one fixed expression that builds or
  calls other parts, when its name is less clear than code inside it, e.g. `TrackedQueue()` for
  `Counter(Listeners())`. Fix: remove wrapper, let callers write code inside it.
- Accept wrapper that's distinct type for a value, e.g. Kotlin value class, also with single
  caller.
- Accept wrapper whose name is clearer than code inside it, e.g. call too complex to be readable in
  one line, or library call whose flags set shape of result. Also with single caller.
- Report wrong boundary: boundary drawn where it creates friction instead of where domain actually
  divides.
- Report missing abstraction: repeated shapes that need name.
- In every finding, state whether fix is to add, remove or move the abstraction.
