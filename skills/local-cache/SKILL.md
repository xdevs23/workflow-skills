---
name: local-cache
description: Decide where to put file not meant for repository, e.g. temporary file, draft, plan, private spec, workflow worktree, scratch file, evidence, log or report, what to remove once tasks are done, and what goes into project memories.
---

# The project cache and the local storage

- Follow user's global preferences about these directories wherever they differ from this file.

## The directories

- Use two ignored, untracked directories at project root for files not meant for the repository:
  - `.cache/`, the project cache, for ephemeral files. Anything in it may be deleted at any time.
  - `.local/`, the local storage, for the few files kept on this machine for the long term.
- Use local storage of main checkout also while working in a worktree, by its absolute path.
  `.local/` inside a worktree is inside project cache. Deleted with it.
- Make sure ignore rules of project cover a directory before writing anything there.
- Never commit anything in either directory.

## What goes into the project cache

- Put in project cache every file that is fine to lose at any time:
  - temporary files, research documents and plans;
  - drafts, e.g. pages drawn by `workflow-skills:visual-decisions`;
  - private specs, under `.cache/specs/`;
  - workflow scripts, and workflow worktrees under `.cache/worktrees/`;
  - scratch files written by a writing stage, under `.cache/<agent-scope>/`, one directory per
    agent. Writing stage that works inside a worktree puts them under the `.cache/` inside that
    worktree;
  - build outputs, and files written by tools, which they can write again, e.g. caches and exports.

## What goes into the local storage

- Put file into local storage only when it is needed later and exists nowhere else, e.g. evidence,
  image pasted by user, log or report.
- Keep everything else out of local storage: file that can be written again, build output, cache,
  copy of a file already contained in repository or another long-term place.
- Delete file from local storage as soon as nothing needs it anymore.
- Look through local storage at end of every unit. Delete every file no longer needed.

## Cleaning up

- Once all tasks done, remove build artifacts not meant for user, e.g. build outputs, `result`
  links, build directories in finished worktrees, test captures.
- Keep everything made for user to see, use or keep, e.g. renders, screenshots, recordings, HTML
  pages, and binaries and images asked for by user.

## Project memories

- Keep in project memories only setup facts, preferences of user for this project and feedback from
  user on this project, which apply to this machine alone.
- Leave out of them: what project already contains, what belongs in its tracked documentation, what
  a global rule or a skill already contains, violations or feedback not needed by next session.
- Never copy global rule into memory. Never link one from memory.
- Put knowledge about project into the project, in fitting place.
- Clean up project memories whenever you change them, so nothing in them is out of date.
- Delete memory that refers to something not understood by you. It was not written properly.

## The system temporary directory

- Never keep large file or anything needed later in system temporary directory. Treat whatever is
  there as lost.
- When something important is lost there, record violation by `workflow-skills:wall-of-shame`.
  Recover what was lost without asking user.

## Reading stages

- Write nothing in reading stage: not in project cache, not in local storage, nowhere else. Neither
  copies of files nor notes.
- Only exception: reading stage may write output of command that cannot be read directly to system
  temporary directory.
