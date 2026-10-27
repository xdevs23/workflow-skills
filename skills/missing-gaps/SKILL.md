---
name: missing-gaps
description: Review change for omissions in its code.
---

# Missing gaps

Review change for one thing only: code that should be present for change to be complete and
trustworthy, but is missing.

- Leave code that's present but wrong to other reviewers.
- Report error or exception path not handled by anything.
- Report edge cases left uncovered, e.g. empty, null or zero value, overflow, concurrent use,
  boundary.
- Report input crossing trust boundary without validation.
- Report risky or branchy logic that does not run in any test. Ask for test that runs the code on
  input built by the test and checks result against rule followed by the code.
- Report missing cleanup, teardown, release of resource or cancellation.
- Report silent failures that should surface, e.g. swallowed errors and ignored return values.
- Report documented case left unimplemented.
- Report fact copied from outside specification, e.g. status codes of protocol, where data file
  published with the specification, or library generated from it, can supply the fact. Name that
  source in finding.
- Report fact copied from outside specification that cannot be read from such source, where link to
  section from which it comes, or date on which that section was checked, is missing.
- In every finding, name specific missing case and what should happen instead.
