---
name: code-cleanliness
description: Review code cleanliness, readability, hygiene
---

Review change for code cleanliness only: readability and hygiene.

- Report name that fails naming test: with docstring hidden, name and a line using it do not show
  what value contains or what code does. Report in particular:
  - type named with generic noun, e.g. `Entry` or `Item`, where module containing it has more
    specific word for its contents;
  - metaphor, e.g. `Weather` for state of a supplier's catalogue (`CatalogueStatus`);
  - name whose word contradicts contents, e.g. `ShopData` for type containing services and
    registries (`ShopServices`);
  - function named after role or noun instead of what it does, e.g. `owners` for function that
    finds carts still referencing a product (`findCartsReferencingProduct`).
  - name on its own not describing in natural way, as appears from outside
- Report library call whose flags decide shape of its result, e.g. serializer called with several
  flags, written at place that uses the result, where a function or method named for that result
  belongs, in module that owns the type.
- Report comments that are false, restate code or are stale, and commented-out code left in.
- Report magic numbers or strings that need a name, in lines added or edited by change. Key of a
  structure is not such a string.
- Report every tunable, as defined in `workflow-skills:writing-code`, written into code or handed
  in by caller, also when a named constant or parameter contains it. Name what it derives from at
  runtime and how it adjusts while code runs.
- Report text that explains a product, as defined in `workflow-skills:building-screens`. Name part
  of interface that has to change so text can be removed.
- Report inconsistent style within file or module, and noisy or accidental debug logging.
- Report orphaned TODO and FIXME comments, dead imports, unused variables.
- Report formatting that hides intent of code, e.g. giant expressions or misleading indentation.
- Report every comment in change. Comment belongs only where code alone cannot make its meaning
  clear, e.g. at external limitation, or where comment describes behavior of something not
  controlled by project.
- Suggest one or more of these steps for every reported comment:
  - remove comment;
  - shorten it;
  - write code in cleaner, more readable, more obvious way so it does not need a comment;
  - remove code described by the comment;
  - report content of comment, or code described by it, as rule violation.
- Look for rule violation behind a comment that explains something not allowed by architecture in
  first place. Where tree contains that rule, say in finding which rule comment breaks.
- Give every reported name a replacement that passes naming test. Say where renaming is cheap.
