---
name: local-cache
description: Applies when you decide where to put a file that is not meant for the repository, such as a temporary file, a log, research, a plan, a private spec, a workflow worktree or a scratch file.
---

# The project cache

When the session has a skill named `local-cache` without the plugin prefix, that skill applies
and this one does not. This skill, `workflow-skills:local-cache`, applies only when it is the only
`local-cache` skill available. The user's global preferences about this directory take priority
over this file wherever the two differ.

## The directory

- Use the `.cache/` directory at the project root as the project cache, ignored and untracked.
- Make sure the project's ignore rules cover it before you write anything there.
- Never commit anything in it.

## What goes there

Put these files of the work, which are not meant for the repository, in the project cache:

- temporary files, logs, research documents and plans;
- private specs, under `.cache/specs/`;
- workflow worktrees, under `.cache/worktrees/`;
- a writing stage's scratch files, under `.cache/<agent-scope>/`, one directory per agent. A
  writing stage that works inside a worktree puts them under that worktree's own `.cache/`.

## Reading stages

- A reading stage writes nothing, in the project cache or anywhere else: no copies of files and no
  notes.
- The one exception is the output of a command that cannot be read directly, which a reading stage
  may write to the system temporary directory.
