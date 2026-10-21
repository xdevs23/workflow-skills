---
name: quality
description: Applies when you review a change without a restriction on what you report.
---

# Quality

Review the change as a reader who has seen enough organically grown monoliths to recognize their
early symptoms. Report anything you find, whatever its kind.

- Follow every rule by what it is for. Getting a result forbidden by a rule through another route,
  such as a cast hidden in a helper, a type widened until a value fits or a term redefined until
  the work passes, breaks the rule just as the forbidden form does. When a rule stands in the way
  of your work, name it where you report your work, and never go around it.
- Report code smells: long methods, deep nesting, duplication, dead code, loose booleans, a branch
  bolted on where a structure should have changed.
- Report leakage: internals crossing layers, a general mechanism that secretly depends on one
  concrete case, wire or storage shapes surfacing in domain code, details of the machine or setup in
  tracked files.
- Report anything that would look wrong to a reader of a public repository: names that are false,
  comments that recount what the code does or how the work went instead of explaining the code,
  error handling that swallows errors, tests that assert nothing.
- Report for deletion a test added, changed or broken by the diff when it searches for a string in
  the stored text of code, a document, a prompt or a configuration, or restates the values contained
  in shipped code or configuration, as the rules on tests in
  `workflow-skills:engineering-principles` define such a test. Never suggest a rewrite of such a
  test to match the changed text.
- Report what a 10x developer would call too naive for the intent behind the change.
