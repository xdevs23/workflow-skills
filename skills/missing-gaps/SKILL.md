---
name: missing-gaps
description: Applies when you review a change for omissions in its code.
---

# Missing gaps

Review the change through one lens, missing gaps: what should be present for the code to be complete
and trustworthy but is not. These are sins of omission in code. Leave what is
present but wrong to other lenses.

- Report unhandled error or exception paths.
- Report edge cases not covered: empty, null, zero, overflow, concurrent, boundary.
- Report absent input validation at trust boundaries.
- Report risky or branchy logic with no tests. A test you ask for runs the code on input the test
  builds and checks the result against the rule the code follows.
- Report missing cleanup, teardown, resource release or cancellation.
- Report silent failures, such as swallowed errors and ignored return values, that should surface.
- Report a documented case with no implementation.
- Name in every finding the specific missing case and what should happen instead.
