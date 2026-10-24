---
name: missing-gaps
description: Review a change for omissions in its code.
---

# Missing gaps

Review the change for one thing only: code that should be present for the change to be complete and
trustworthy but is missing.

- Leave code that is present but wrong to other reviewers.
- Report an error or exception path that nothing handles.
- Report edge cases left uncovered, such as an empty, null or zero value, an overflow, concurrent
  use or a boundary.
- Report input that crosses a trust boundary without validation.
- Report risky or branchy logic that does not run in any test. Ask for a test that runs the code on
  input built by the test and checks the result against the rule followed by the code.
- Report a missing cleanup, teardown, release of a resource or cancellation.
- Report silent failures, such as swallowed errors and ignored return values, that should surface.
- Report a documented case left unimplemented.
- Report a fact copied from an outside specification, such as the status codes of a protocol,
  where a data file published with the specification or a library generated from it can supply
  the fact. Name that source in the finding.
- Report a fact copied from an outside specification that cannot be read from such a source, where
  the link to the section from which it comes or the date that section was checked is missing.
- Name in every finding the specific missing case and what should happen instead.
