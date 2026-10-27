---
name: writing-tests
description: Write, change or delete tests, test doubles and fixtures.
---

# Writing tests

- Test an expectation. State the rule followed by the code, run the code on input built by the
  test, and check the result against what that rule gives for that input.
- Never treat the values contained in the shipped code or configuration as an expectation. A test
  that restates them proves nothing.
- Never write a test that checks whether the text of code, a document, a prompt or a configuration,
  as stored in the repository, contains, lacks or matches a string. A check of text produced by the
  code from input built by the test is an expectation and is allowed.
- Delete a test that checks stored text for a string or restates shipped values when your change
  alters it in any way or makes it fail, and keep any assertion in it that runs the code. Never
  rewrite such a test to match the changed text.
- Report a test of that kind outside your change, and leave it in place.
- Keep tests deterministic and reproducible, independent of the clock and of anything outside the
  test.
- Never ship test code. Shipped code takes the same path whether tests exist or not.
- Put failure injection only in an artifact that never ships, and let it run through the real error
  handling.
- Run tests and probes on synthetic fixtures in throwaway locations, never on real user data or a
  real data store.
- Put test doubles exactly where your own infrastructure ends and nowhere earlier.
- Never double the thing under test, and watch for a permissive double that silently switches off
  the mechanism being tested.
- Let tests contact only the infrastructure you run for them, and block the network beneath every
  client.
- Keep your infrastructure, such as the database, real, at a locked version and in the
  configuration needed in production.
- Keep tests fast and parallel.
- Fail a test that can't get a needed capability, and never skip it. Only a test that needs an
  external artifact, such as a downloaded file, may skip when that artifact is missing. The tests
  in the same suite that use synthetic fixtures still run.
- Reset process-wide state between tests.
- Test each invariant at exactly one level, and don't prove it again at higher levels.
- Prove a rewrite that must give identical results with a suite of equivalence tests. Before the
  change, record the outputs produced by the old code in a canonical serialized form, one that
  always gives the same bytes for the same value, and compare the outputs produced by the new code
  with those bytes. The outputs produced by the old code are the expectation for the rewrite.
- State why for every comparison that is loosened.
- Name the failure mechanism in a regression test, never a ticket, and show the test failing
  against the old code.
- Give each acceptance criterion of a design a separate group of tests.
- Give a known limitation a test that asserts it.
- Bound a test by the progress of the work it runs, such as ticks or event-loop turns, never by
  wall time.
- Fail a test once nothing is left that could move it on, such as when the channel it waits on is
  closed, the process it waits for has exited or the event loop has no pending work.
- Switch off the wall-time limit set by default by the test runner.
