---
name: local-cache
description: Decide where to put a file that is not meant for the repository, such as a temporary file, a draft, a plan, a private spec, a workflow worktree, a scratch file, evidence, a log or a report.
---

# The project cache and the local storage

- Follow the user's global preferences about these directories wherever they differ from this
  file.

## The directories

- Use two ignored, untracked directories at the project root for files not meant for the
  repository:
  - `.cache/`, the project cache, for ephemeral files. Anything in it may be deleted at any time.
  - `.local/`, the local storage, for the few files kept on this machine for the long term.
- Use the local storage of the main checkout also while you work in a worktree, by its absolute
  path. A `.local/` inside a worktree is inside the project cache and is deleted with it.
- Make sure the ignore rules of the project cover a directory before you write anything there.
- Never commit anything in either directory.

## What goes into the project cache

- Put every file in the project cache that is fine to lose at any time:
  - temporary files, research documents and plans;
  - drafts, such as the pages drawn by `workflow-skills:visual-decisions`;
  - private specs, under `.cache/specs/`;
  - workflow scripts, and workflow worktrees under `.cache/worktrees/`;
  - the scratch files written by a writing stage, under `.cache/<agent-scope>/`, one directory per
    agent. A writing stage that works inside a worktree puts them under the `.cache/` inside that
    worktree;
  - build outputs, and files that tools write and can write again, such as caches and exports.

## What goes into the local storage

- Put a file into the local storage only when it is needed later and exists nowhere else, such as
  evidence, an image pasted by the user, a log or a report.
- Keep everything else out of the local storage: a file that can be written again, a build output,
  a cache and a copy of a file that the repository or another long-term place already contains.
- Delete a file from the local storage as soon as nothing needs it anymore.
- Look through the local storage at the end of every unit, and delete every file that is no longer
  needed.

## Reading stages

- Write nothing in a reading stage, in the project cache, in the local storage or anywhere else:
  neither copies of files nor notes.
- As the only exception, a reading stage may write the output of a command that cannot be read
  directly to the system temporary directory.
