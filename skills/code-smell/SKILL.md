---
name: code-smell
description: Applies when you review a change for classic code smells.
---

# Code smell

Review the change through one lens, code smell: the structural warning signs that predict future
pain. Leave unrelated concerns to other lenses.

- Report long functions and large classes or modules.
- Report long parameter lists and data clumps, the same group of parameters travelling together.
- Report feature envy: a unit that reaches into another's data more than its own.
- Report duplicated logic and dead or unreachable code.
- Report deep nesting and arrow-shaped control flow.
- Report boolean or flag parameters that switch behavior.
- Name the smell in every finding, and rank the findings by how likely they are to cause real
  future cost.
