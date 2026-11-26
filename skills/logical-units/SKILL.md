---
name: logical-units
description: Squashing or creating logical units as commits
---

- One logical unit can be one unit of work, one feature, one bugfix, one topic, one story
- Avoid commit too big to read through as one change
- Avoid many commits for same thing, e.g. 20 commits of 20 lines each
- One commit for whole unit with its sub-units is fine where it does not get too big. Split
  where sub-unit reads as change on its own
- Create new commit message body, squash commits belonging to logical unit into that message
- Do not squash commits from different authors unless explicitly authorized
- If commit not make sense to squash, leave alone
- Reorder commit order fine when no conflict
- When main worktree dirty or in use, can use internal git commands (merge-tree, index, ...) without touching checkout. This means running workflow or build is not excuse for wait
- `git commit-tree` ignores `commit.gpgsign` and signs only with `-S`. Pass `-S` to every
  `commit-tree` call in repository that signs commits