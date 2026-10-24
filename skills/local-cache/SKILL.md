---
name: local-cache
description: Decide where to put a file that is not meant for the repository, such as a temporary file, a log, research, a plan, a private spec, a workflow worktree or a scratch file.
---

# The project cache

- Follow every rule by what it is for. Getting a result forbidden by a rule through another route,
  such as a cast hidden in a helper, a type widened until a value fits or a term redefined until
  the work passes, breaks the rule just as the forbidden form does. When a rule stands in the way
  of your work, name it where you report your work, and never go around it.
- Follow the user's global preferences about this directory wherever they differ from this file.

## The directory

- Use the `.cache/` directory at the project root as the project cache. It is ignored and
  untracked.
- Make sure the ignore rules of the project cover it before you write anything there.
- Never commit anything in it.

## What goes there

Put these files, which are not meant for the repository, in the project cache:

- temporary files, logs, research documents and plans;
- private specs, under `.cache/specs/`;
- workflow worktrees, under `.cache/worktrees/`;
- the scratch files written by a writing stage, under `.cache/<agent-scope>/`, one directory per
  agent. A writing stage that works inside a worktree puts them under the `.cache/` inside that
  worktree.

## Reading stages

- Write nothing in a reading stage, in the project cache or anywhere else: neither copies of files
  nor notes.
- As the only exception, a reading stage may write the output of a command that cannot be read
  directly to the system temporary directory.
