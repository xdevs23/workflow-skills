---
name: code-cleanliness
description: Applies when you review a change for readability and hygiene at the surface of the code.
---

# Code cleanliness

Review the change for code cleanliness only: readability and hygiene.

- Follow every rule by what it is for. Getting a result forbidden by a rule through another route,
  such as a cast hidden in a helper, a type widened until a value fits or a term redefined until
  the work passes, breaks the rule just as the forbidden form does. When a rule stands in the way
  of your work, name it where you report your work, and never go around it.
- Leave structural concerns to other lenses. Still name the rule violation behind a comment.
- Report a name that fails the naming test: with the docstring hidden, the name and a line that uses
  it do not show what the value contains or what the code does. Report in particular:
  - a type named with a generic noun, such as `Entry` or `Item`, where the module containing it has
    a more specific word for its contents;
  - a metaphor, such as `Weather` for the state of a supplier's catalogue (`CatalogueStatus`);
  - a name whose word contradicts the contents, such as `ShopData` for a type that contains
    services and registries (`ShopServices`);
  - a function named after a role instead of what it returns, such as `owners` for a function that
    finds the carts still referencing a product (`cartsReferencingProduct`).
- Report a library call whose flags decide the shape of its result, such as a serializer called
  with several flags, written at the place that uses the result, where a function or method named
  for that result in the module that owns the type belongs.
- Report comments that are false, restate the code or are stale, and commented-out code left in.
- Report magic numbers or strings that need a name.
- Report every tunable, as defined in `workflow-skills:engineering-principles`, that is written
  into the code or handed in by a caller, also when a named constant or a parameter contains it.
  Name what it derives from at runtime and how it adjusts while the code runs.
- Report text that explains a product, as defined in `workflow-skills:engineering-principles`. Name
  the part of the interface that has to change so the text can be removed.
- Report inconsistent style within a file or module, and noisy or accidental debug logging.
- Report orphaned TODO and FIXME comments, dead imports and unused variables.
- Report formatting that hides the intent of the code, such as giant expressions or misleading
  indentation.
- Report every comment in the change. A comment belongs only where the code alone cannot make its
  meaning clear, such as at an external limitation or where the comment describes the behavior of
  something the project does not control.
- Suggest one or more of these steps for every reported comment:
  - remove the comment;
  - shorten it;
  - write the code in a cleaner, more readable and more obvious way so it needs no comment;
  - remove the code described by the comment;
  - report the content of the comment, or the code described by it, as a rule violation.
- Look for the rule violation behind a comment that explains something not allowed by the
  architecture in the first place. Where the tree contains that rule, say in the finding which rule
  the comment breaks.
- Give every reported name a replacement that passes the naming test. Say where renaming is cheap.
