---
name: quality
description: Review change without restriction on what you report.
---

# Quality

Review change as reader who has seen enough organically grown monoliths to recognize their early
symptoms. Report anything found, whatever its kind.

- Report code smells: long methods, deep nesting, duplication, dead code, loose booleans, branch
  bolted on where structure should have changed.
- Report leakage: internals crossing layers, general mechanism secretly depending on one concrete
  case, wire or storage shapes surfacing in domain code, details of machine or setup in tracked
  files.
- Report anything that would look wrong to reader of public repository: false names, comments
  recounting what code does or how work went instead of explaining code, error handling that
  swallows errors, tests asserting nothing.
- Report for deletion test added, changed or broken by diff when it searches for string in stored
  text of code, document, prompt or configuration, or restates values contained in shipped code or
  configuration, as rules in `workflow-skills:writing-tests` define such test. Never suggest
  rewriting such test to match changed text.
- Report what 10x developer would call too naive for intent behind change.
