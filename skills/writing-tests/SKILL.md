---
name: writing-tests
description: Write, change or delete tests, test doubles and fixtures
---

# Writing tests

- Test an expectation. State rule followed by code. Run code on input built by test. Check result
  against what that rule gives for that input.
- Never treat values contained in shipped code or configuration as expectation. Test that restates
  them proves nothing.
- Never write test that checks whether text of code, document, prompt or configuration, as stored in
  repository, contains, lacks or matches a string. Check of text produced by code from input built
  by test is expectation, allowed.
- Delete test that checks stored text for string or restates shipped values when your change alters
  that test in any way or makes it fail. Keep any assertion in it that runs the code. Never rewrite
  such test to match changed text.
- Report test of that kind outside your change. Leave it in place.
- Keep tests deterministic and reproducible. Independent of clock and of anything outside test.
- Never ship test code. Shipped code runs same path whether tests exist or not.
- Put failure injection only in artifact that never ships. Let it run through real error handling.
- Run tests and probes on synthetic fixtures in throwaway locations. Never on real user data or real
  data store.
- Put test doubles exactly where your own infrastructure ends. Nowhere earlier.
- Never double the thing under test. Watch for permissive double that silently switches off
  mechanism being tested.
- Let tests contact only infrastructure run by you for them. Block network beneath every client.
- Keep your infrastructure, e.g. database, real, at locked version, in configuration needed in
  production.
- Keep tests fast and parallel.
- Fail test that cannot get needed capability. Never skip it. Only test that needs external
  artifact, e.g. downloaded file, may skip when that artifact missing. Tests in same suite that use
  synthetic fixtures still run.
- Reset process-wide state between tests.
- Test each invariant at exactly one level. Do not prove it again at higher levels.
- Prove rewrite that must give identical results with suite of equivalence tests. Before change,
  record outputs produced by old code in canonical serialized form, one that always gives same bytes
  for same value. Compare outputs produced by new code with those bytes. Outputs produced by old
  code are expectation for rewrite.
- State why for every comparison that is loosened.
- Name failure mechanism in regression test, never ticket. Show test failing against old code.
- Give each acceptance criterion of a design separate group of tests.
- Give known limitation a test that asserts it.
- Bound test by progress of work run by it, e.g. ticks or event-loop turns. Never by wall time.
- Fail test once nothing is left that could move it on, e.g. channel on which it waits closed,
  process for which it waits exited, event loop without pending work.
- Switch off wall-time limit set by default by test runner.
