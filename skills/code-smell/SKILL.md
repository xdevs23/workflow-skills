---
name: code-smell
description: Review a change for classic code smells.
---

# Code smell

Review the change for code smells only: structural warning signs that the code will be costly to
change later.

- Leave unrelated concerns to other reviewers.
- Report long functions and large classes or modules.
- Report long parameter lists and data clumps, where the same group of parameters is passed
  together again and again.
- Report feature envy: a unit that uses the data of another unit more than its own data.
- Report duplicated logic and dead or unreachable code.
- Report shotgun surgery: one change of a concept, such as where a value comes from or how a
  dependency is built, that edits many of the units using the concept.
- Name in a finding on shotgun surgery the one place that would have kept the change local.
- Ask for that place as a separate change before the change under review. That separate change
  moves every unit using the concept to the place in one edit.
- Report deep nesting and arrow-shaped control flow.
- Report boolean or flag parameters that switch behavior.
- Report direct access by string key, such as `doc["key"]` and `item.get("key")`, where the change
  adds it. Name a typed model of the structure as the fix. A constant that contains the key is
  still access by a string.
- Name the smell in every finding.
- Rank the findings by how likely each one is to cause real cost later.
