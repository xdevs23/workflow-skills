---
name: rule-bypass
description: Applies when you review a change for ways around a rule or a check.
---

# Rule bypass

Review the change for one thing only: places where it meets the wording of a rule or a check and
still gets a result forbidden by the rule.

- Follow every rule by what it is for. Getting a result forbidden by a rule through another route,
  such as a cast hidden in a helper, a type widened until a value fits or a term redefined until
  the work passes, breaks the rule just as the forbidden form does. When a rule stands in the way
  of your work, name it where you report your work, and never go around it.
- Leave unrelated concerns to other lenses.
- Judge each rule handed to you, and each rule in the instruction files of the project, by what it
  is for, and report every place where the change defeats that purpose.
- Report a forbidden form moved to where the check does not look, such as a cast hidden in a
  helper, a JSON round trip that returns an untyped value, or a type parameter used as an unchecked
  cast.
- Report a type widened so that it no longer refuses a wrong value, such as an enum field turned
  back into plain text, a required field made optional or a record turned into a map.
- Report every silenced check, also one from before the change in a file the change edits: a
  suppression comment, an excluded file or folder, a disabled or lowered lint or compiler setting,
  a warning left standing, or a test that is skipped or ignored where the rules require it to
  run. An allowance of unsafe code on the smallest item that needs it, with its `SAFETY` comment,
  as a language file of `workflow-skills:code-writing` describes, is not a silenced check.
- Report a swallowed error in a new form, such as an empty catch turned into a catch that only
  logs, or a catch that returns a default value.
- Report a test rewritten to match a changed value in the shipped code, where the test only
  restated that value.
- Report a value written twice together with a check that the two copies agree, where one
  definition belongs.
- Report a check written so it lets through the pattern it is named after.
- Report a limit chosen by the code and presented as one set by an outside system.
- Report a term redefined until the work passes, such as an open decision called out of scope.
- Mark every finding of this lens as a defect in the change, to be fixed before the change is
  done.
- State in every finding the defeated rule, quoted word for word, and the shape that
  follows the rule by what it is for.
