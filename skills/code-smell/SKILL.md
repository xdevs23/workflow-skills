---
name: code-smell
description: Review a change for classic code smells.
---

# Code smell

Review the change for code smells only: structural warning signs that the code will be costly to
change later.

- Follow every rule by what it is for. Getting a result forbidden by a rule through another route,
  such as a cast hidden in a helper, a type widened until a value fits or a term redefined until
  the work passes, breaks the rule just as the forbidden form does. When a rule stands in the way
  of your work, name it where you report your work, and never go around it.
- Leave unrelated concerns to other lenses.
- Report long functions and large classes or modules.
- Report long parameter lists and data clumps, where the same group of parameters is passed
  together again and again.
- Report feature envy: a unit that uses the data of another unit more than its own data.
- Report duplicated logic and dead or unreachable code.
- Report deep nesting and arrow-shaped control flow.
- Report boolean or flag parameters that switch behavior.
- Report direct access by string key, such as `doc["key"]` and `item.get("key")`, where the change
  adds it. Name a typed model of the structure as the fix. A constant that contains the key is
  still access by a string.
- Name the smell in every finding.
- Rank the findings by how likely each one is to cause real cost later.
