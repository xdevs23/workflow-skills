---
name: code-cleanliness
description: Applies when you review a change for the readability and hygiene of its surface.
---

# Code cleanliness

Review the change through one lens, code cleanliness: readability and hygiene. Leave structural
concerns to other lenses, except the rule violation behind a comment, which you name.

- Report names that fail the naming test: with the docstring hidden, the name and a line that uses
  it don't say what the value holds or what the code does. Report in particular:
  - a type named with a generic noun, such as `Entry` or `Item`, where its module has a more
    specific word for what it holds;
  - a metaphor, such as `Weather` for the state of a supplier's catalogue (`CatalogueStatus`);
  - a name whose word contradicts the contents, such as `ShopData` for a holder of services and
    registries (`ShopServices`);
  - a function named after a role instead of what it returns, such as `owners` for a function that
    finds the carts still referencing a product (`cartsReferencingProduct`).
- Report comments that lie, restate the code, or are stale, and commented-out code left in.
- Report magic numbers or strings that want a named constant.
- Report text that explains a product, as `workflow-skills:engineering-principles` defines it, and
  name the part of the interface that needs changing so the text can go.
- Report inconsistent style within a file or module, and noisy or accidental debug logging.
- Report orphaned TODO and FIXME debt, dead imports and unused variables.
- Report formatting that hides intent: giant expressions, misleading indentation.
- Report every comment in the change. A comment belongs only where the code cannot explain itself,
  such as at an external limitation or where it describes the behavior of something the project does
  not control.
- Suggest one or more of these for every comment you report: remove the comment; shorten it; write
  the code in a cleaner, more readable and more obvious way so it needs no comment; remove the code
  it describes; or report the comment's content, or the code it describes, as a rule violation.
- Look for the rule violation behind a comment that explains something the architecture would not
  have allowed in the first place, and say in the finding which rule it breaks where the tree states
  one.
- Give a reported name a replacement that passes the naming test, and say where a fix is cheap.
