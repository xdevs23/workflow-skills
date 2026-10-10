---
name: abstraction-quality
description: Applies when you review a change for whether its abstractions earn their keep.
---

# Abstraction quality

Review the change through one lens: whether its abstractions earn their keep.

- Report a leaky abstraction: an interface that forces callers to know its internals. Calling a
  function, using an object, importing a module or instantiating a class never requires knowing how
  that part of the code works.
- Report a premature or speculative abstraction: indirection, generics, plugin points or
  configuration knobs with a single caller and no second use in sight. An abstraction with at most
  one caller stands only where the notes of the change ask for it, never by assumption.
- Report a wrong boundary: one drawn where it creates friction instead of where the domain actually
  joints.
- Report a missing abstraction: repeated shapes that want a name.
- State in every finding whether the fix is to add, remove or move the abstraction.
