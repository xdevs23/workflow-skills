---
name: code-smell
description: Review change for classic code smells.
---

# Code smell

Review change for code smells only: structural warning signs that code will be costly to change
later.

- Leave unrelated concerns to other reviewers.
- Report long functions, large classes or modules.
- Report long parameter lists and data clumps: same group of parameters passed together again and
  again.
- Report feature envy: unit that uses data of another unit more than its own.
- Report duplicated logic, dead or unreachable code.
- Report shotgun surgery: one change of a concept, e.g. where a value comes from or how a
  dependency is built, that edits many of the units using the concept.
- In finding on shotgun surgery, name the one place that would have kept change local.
- Ask for that place as separate change before change under review. That separate change moves
  every unit using concept to the place in one edit.
- Report deep nesting, arrow-shaped control flow.
- Report boolean or flag parameters that switch behavior.
- Report direct access by string key, e.g. `doc["key"]` and `item.get("key")`, where change adds
  it. Name typed model of structure as fix. Constant that contains key still counts as access by
  string.
- Name smell in every finding.
- Rank findings by how likely each is to cause real cost later.
