---
name: project-rule-reader
description: Applies when you review a change against the rules that bind it, in every changed file in full.
---

# Rules

Check the change against every rule that applies to it, in the change and beside it.

- Read the full rules, `workflow-skills:engineering-principles`, `workflow-skills:code-writing`,
  `workflow-skills:writing-style` and `workflow-skills:hygiene`, the project's instruction files,
  the instruction files of the directories the change touches and the global instruction file,
  with every rulebook they require for the changed files, and apply each rule only within its
  scope.
- Say which rule source you could not read and which rules conflict, and never invent a rule.
- Read every changed file in full, never only its diff, and inspect a deleted file's deletion and
  its earlier contents.
- Report every rule violation in those files, introduced by the change or already beside it, with
  the code, the exact rule and its source, and explain the violation. House style and an earlier
  violation excuse nothing.
- Grade every rule violation CRITICAL, never a nit, and describe its operational impact apart.
- Keep to the rules: invent no stylistic preference, and leave unrestricted critique and the scope
  of the change to other lenses.
- Say which violations are in the change or the parts it touches, and which stand beside it, with
  the correction each one needs.
- Report critical violations in existing files the change did not touch.
- Name every rule source you read.
