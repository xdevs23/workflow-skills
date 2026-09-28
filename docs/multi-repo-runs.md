# Run across several git repositories

A run of implement-review-verify works in one git repository or in a tree of several, such as the
task tree of a repo-tool client, where each repository sits in its own directory under the tree
root. The run carries one starting commit per repository, every stage reports and reads its
results per repository, and a project without git runs no workflow at all.

## Git is a precondition

The implement-review-verify skill states git as a precondition where it says when the workflow
applies: the project is one git repository or a tree of several git repositories. In a project
without git the root starts no run and may ask the user whether they want a git repository. The
writers' commits are what every reader and the roaster read, so a run has nothing to review
without them.

## The base list

The launch value `base` of all three shipped scripts is a list with one `{ path, sha }` for every
git repository of the tree, changed or not: the path of the
repository relative to the tree root and its full starting commit. A tree that is one repository is
a list of one entry whose path is a single dot, and the worktree in the marked block is the tree
root. Each script refuses at once an empty list, a path named twice, a commit ID that is not a
full one, and a path of another form than a single dot or segments of letters, digits, dots,
underscores and hyphens joined by slashes, with no segment of one or two dots. That path form keeps
quotes out of the list, so the scripts can pass it to the spec tool as JSON inside single quotes.

The run record of the main and fix-run scripts returns `base` and `snapshots`, both lists of
`{ path, sha }` in the order of `base`. A fix run's `base` is the parent run's `snapshots`.

## Writers

The implementer and the fixer start every repository of the list at its commit and may commit in
any of them. Each returns `repositories`, one entry per repository with its path, `startSha`,
`snapshotSha`, `clean` and `git`, the quoted output of `git rev-parse --verify HEAD^{commit}` and
`git status --porcelain=v1 --untracked-files=all` in that repository. Each commit names the path of
its repository, and `files` lists paths relative to the tree root.

The script accepts a writer only when every repository of the list appears exactly once at its
expected start, each quoted head equals that repository's snapshot, each `clean` agrees with an
empty status, a repository whose snapshot moved has commits in it and an unchanged one none, and a
new snapshot anywhere lists files with a check whose `passed` equals `proofPassed`. A repository a
writer left unchanged keeps its start as its snapshot. The shipped main script has one implementer
stage, and the skill allows parallel implementers only across genuinely disjoint repositories.

## Readers, the verifier and the roaster

Every reader receives one diff range per repository whose snapshot moved from its base, each with
the repository's path, and reads with `git -C` at the tree root joined with that path. The prompt
also names the snapshot of every repository, each of which must stay clean where it is. A
repository no writer moved produces no diff range.

The finding verifier runs head and status in every repository of the list and returns
`repositories`, one entry per repository, and the script refuses drift, a dirty tree or a head that
differs from the snapshot in any of them. Each `writerScope` entry names the repository of its
commit, and a commit's paths are compared with the writer's files list under the repository's path.

The roaster runs beside the fixer. It receives the base and snapshot commit of every
repository, reads only Git objects of each repository at those commits, and returns `snapshots`,
the commit it read per repository, which must equal the ones it was given.

## The spec tool's --base

The spec tool's `--base` takes the same list as one JSON argument and checks it against the tree
it runs in. Every path must be the top level of a git repository, as `git rev-parse
--show-toplevel` reports it, and must hold its commit. A walk from the tree root, which descends
until it meets a directory holding `.git` and goes no deeper there, must find no repository the
list leaves out, so no repository of a tree goes unread. The walk follows no symbolic link.

A cited rule file is read at the commit of the entry whose path is the longest one containing the
file, with `git show` in that repository. It is read from disk only when no entry contains it or
when `git ls-tree` shows that the file is not tracked at that commit. Any other git failure fails
the check, so a failed lookup can never pass off the working copy as the committed text. The fix
run's launch check keeps the fix-list mode, which takes no `--base` and reads no rule file.

## Design documents in a tree of several repositories

The marked block of the main and fix-run scripts names `documents`, the directory for design
documents relative to the tree root, inside one repository of the list: `docs` for a tree that is
one repository. A unit's design document is that directory joined with the spec's file name, and
the writers commit it in the repository that holds the directory. The root of a repo-tool tree is
no repository, so a document placed there could be committed nowhere.

## The pre-phase

The pre-phase script takes the same `base` list, passes it to the spec tool's launch check and
names every base commit to the provenance reader, which reports an observation older than the
newest of those commits.

## Decisions and their reasons

- One list covers every repository of the tree, changed or not, because a repository left out
  would never be read by a reviewer, and the spec tool's walk makes a left-out repository fail
  the launch check.
- A tree that is one repository uses the same list with one entry. Keeping the single commit ID
  for that case beside the list would give every stage two paths for the same job.
- The size report records the merge-base and candidate commit of every repository and sums its
  code counts over them, and integration and its evidence go per repository, with the route still
  the project's choice.
- How a project creates its tree is the project's own. The plugin requires only that the tree
  holds every repository of the list.

## Rejected alternative

Supporting projects without git was rejected, whether by a copy of the project that reviewers read
as it changes or any other way. Git, or a tree of git repositories, is a precondition of the
workflow.
