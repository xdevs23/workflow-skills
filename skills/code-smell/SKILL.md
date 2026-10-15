---
name: code-smell
description: Applies when you review a change for classic code smells.
---

# Code smell

Review the change for code smells only: structural warning signs that the code will be costly to
change later.

- Leave unrelated concerns to other lenses.
- Report long functions and large classes or modules.
- Report long parameter lists and data clumps, where the same group of parameters is passed
  together again and again.
- Report feature envy: a unit that uses the data of another unit more than its own data.
- Report duplicated logic and dead or unreachable code.
- Report deep nesting and arrow-shaped control flow.
- Report boolean or flag parameters that switch behavior.
- Report direct access by string key, such as `doc["key"]` and `item.get("key")`, where the change
  adds it.
- Report an arbitrary constant whose reason is not documented, such as a page size or a limit on
  parallelism.
- Name the smell in every finding.
- Rank the findings by how likely each one is to cause real cost later.
