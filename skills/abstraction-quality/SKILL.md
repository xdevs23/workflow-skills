---
name: abstraction-quality
description: Review whether the abstractions in a change are justified.
---

# Abstraction quality

Review the change for one thing only: whether every abstraction in it is justified by how the code
uses it.

- Follow every rule by what it is for. Getting a result forbidden by a rule through another route,
  such as a cast hidden in a helper, a type widened until a value fits or a term redefined until
  the work passes, breaks the rule just as the forbidden form does. When a rule stands in the way
  of your work, name it where you report your work, and never go around it.
- Report a leaky abstraction: an interface that requires the caller to know how it works inside.
  Calling a function, using an object, importing a module or instantiating a class never requires
  knowing how that part of the code works.
- Report a premature or speculative abstraction: indirection, generics, plugin points or
  configuration knobs with a single caller while a second use is not in sight. Accept an
  abstraction with at most one caller only where the notes describing the change require it, never
  on an assumption. Accept also a function that names a library call whose flags decide the shape
  of its result.
- Report a wrong boundary: a boundary drawn where it creates friction instead of where the domain
  actually divides.
- Report a missing abstraction: repeated shapes that need a name.
- State in every finding whether the fix is to add, remove or move the abstraction.
