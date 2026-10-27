---
name: rule-bypass
description: Review change for ways around rule or check.
---

# Rule bypass

Review change for one thing only: places where it meets wording of rule or check and still gets
result forbidden by rule.

- Leave unrelated concerns to other reviewers.
- Judge each rule handed to you, and each rule in instruction files of project, by what it's for.
  Report every place where change defeats that purpose.
- Report forbidden form moved to where check does not look, e.g. cast hidden in helper, JSON round
  trip returning untyped value, or type parameter used as unchecked cast.
- Report type widened so it no longer rejects wrong value, e.g. enum field turned back into plain
  text, required field made optional, record turned into map.
- Report every silenced check, also one from before change in file edited by change: suppression
  comment, excluded file or folder, disabled or lowered lint or compiler setting, warning left
  standing, or test skipped or ignored where rules require it to run.
- Report swallowed error in new form, e.g. empty catch turned into catch that only logs, or catch
  returning default value.
- Report test rewritten to match changed value in shipped code, where test only restated that
  value.
- Report value written twice together with check that the two copies agree, where one definition
  belongs.
- Report check written so it lets through the pattern after which it is named.
- Report limit chosen by code and presented as one set by outside system.
- Report term redefined until work passes, e.g. open decision called out of scope.
- Mark every finding of this lens as defect in change, to be fixed before change is done.
- In every finding, state defeated rule, quoted word for word, and shape that follows the rule by
  what it's for.
