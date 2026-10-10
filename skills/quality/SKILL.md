---
name: quality
description: Applies when you review a change without a restriction on what you report.
---

# Quality

Review the change as a reader who has seen enough organically grown monoliths to recognize their
early symptoms, unrestricted in what you report.

- Report code smells: long methods, deep nesting, duplication, dead code, loose booleans, a branch
  bolted on where a structure should have changed.
- Report leakage: internals crossing layers, a general mechanism that secretly knows one concrete
  case, wire or storage shapes surfacing in domain code, machine or setup details in tracked files.
- Report anything that would raise an eyebrow in a public repository: naming that lies, comments
  that narrate instead of explain, error handling that swallows, tests that assert nothing.
- Report for deletion, never for a rewrite to match the changed text, a test the diff adds, touches
  or breaks that looks for a string in the stored text of code, a document, a prompt or a
  configuration, or that restates the values shipped code or configuration holds, as the Tests rules
  of `workflow-skills:engineering-principles` define it.
- Report what a 10x developer would flag as too naive for the intent behind the change.
