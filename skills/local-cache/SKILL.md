---
name: local-cache
description: Defines the project cache, the ignored and untracked directory for files that are not meant for the repository, such as temporary files, logs, research, plans, private specs, directive records, workflow worktrees and scratch files. Load it when deciding where to put a file that is not meant for the repository.
---

# The project cache

When the session has a skill named `local-cache` without the plugin prefix, that skill applies
and this one does not. This skill, `workflow-skills:local-cache`, applies only when it is the only
`local-cache` skill available. The user's global preferences about this directory take priority
over this file wherever the two differ.

## The directory

The project cache is the `.cache/` directory at the project root. It is ignored and untracked, and
the project's ignore rules must cover it before anything is written there. Nothing in it is ever
committed.

## What goes there

The project cache holds every file of the work that is not meant for the repository:

- temporary files, logs, research documents and plans;
- private specs, under `.cache/specs/`;
- private directive records, under `.cache/directives/`;
- workflow worktrees, under `.cache/worktrees/`;
- a writing stage's scratch files, under `.cache/<agent-scope>/`, one directory per agent. A
  writing stage that works inside a worktree puts them under that worktree's own `.cache/`.

## Reading stages

A reading stage writes nothing there and nothing anywhere else: no copies of files and no notes.
The one exception is the output of a command that cannot be read directly, which a reading stage
may write to the system temporary directory.
