---
name: logical-units
description: Squashing or creating logical units as commits
---

- One logical unit can be one unit of work, one feature, one bugfix, one topic, one story
- Create new commit message body, squash commits belonging to logical unit into that message
- Do not squash commits from different authors unless explicitly authorized
- If commit not make sense to squash, leave alone
- Reorder commit order fine when no conflict
- When main worktree dirty or in use, can use internal git commands (merge-tree, index, ...) without touching checkout. This means running workflow or build is not excuse for wait