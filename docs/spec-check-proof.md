# The writer's spec check proves what it checked

The implementer of implement-review-verify runs the spec tool before anything else: on the unit
spec in a main run, and in a follow-up run on the spec its parent run checked, or on the base list
alone when the parent run checked no spec. Its command passes the fingerprint of the values the
script launched with, and the tool fails before it prints anything when the values it checked give
another proof, so the implementer edits nothing on a check of other values. The implementer returns
what the tool printed, and the script continues only when the proof printed there equals that
fingerprint. A review pass reviews a change made without a spec, so it runs no writer and no check.

## The proof

The spec tool prints as `proof` the 32-bit FNV-1a hash of the values it checked, written as JSON
with the keys of every mapping in sorted order. A spec check covers the spec path, the transcript
directory, the base list, whether the base list is partial and the directory the tool runs in, as
the operating system reports it with symbolic links resolved, and in a follow-up run the `sha256`
the spec must have. A check of the base list alone covers the base list, whether it is partial and
the directory the tool runs in. The same values give the same proof on every run, and a failing
check prints none. `--proof` names the proof a run expects, and the tool fails with both proofs
named when the values it checked give another.

The base list is checked against the repositories of the directory the tool runs in, so the proof of
every check covers that directory. Another checkout that holds the same commits passes the same
list, and its proof differs from the one the script computes with its worktree, so a check that ran
outside the worktree stops the run, in a main run and a follow-up run alike. The marked block of the
script therefore names the worktree by its absolute path without symbolic links. Every value of the
check's command is one single-quoted shell word, so a path holding a space or an apostrophe reaches
the tool unchanged.

The base list of a follow-up run takes part in the proof, so the script and the tool agree on it,
and that agreement alone would pass a list that consistently names an earlier commit the tree holds.
The script therefore also holds the base list to the final snapshots the parent run returned, one
commit per repository, and stops before its first agent on any other commit. A review pass returns
no snapshots, and the follow-up run of one starts from the commit each repository is at, which only
the check against the tree covers.

The hash has one definition, the spec tool's fingerprint module, with two helpers, `withSortedKeys`
and `fingerprint`. The spec tool imports it. A workflow script runs without imports and has no hash
library to call, so the main script carries the two helpers as the module writes them, and the
routing tests compare the proofs the script computes with the module's.

## Who runs the check

The check is the first block of the implementer's prompt: one command, run once exactly as written,
whose exit code, stdout and stderr the implementer returns unchanged in `specCheck`, a field its
schema requires. The command carries the script's own fingerprint in `--proof`, so the values the
implementer works with agree with the values the tool checked before its first edit. On a failed
check the implementer edits nothing. The script parses the printed JSON, reads its `proof` field and
compares it with its own fingerprint, so output that is no JSON ends the run like a wrong proof.

The script returns in `spec` the spec its implementer's check passed on, taken from what the tool
printed: its path, its sha256 and its spec lines. It is null when no check passed on a spec, as in a
review pass, which checks none, and in the follow-up run of one. The follow-up run receives that
field unchanged in `args.parent`: its implementer's check names its path and its sha256, and a size
breach is measured against its spec lines.

## What the comparison shows

The comparison shows that the values the tool checked are the values the run launched with and hands
its stages. A check of other values, a check in another tree and a failed check stop the run, and so
does printed output with a missing proof or another one. A proof the implementer wrote itself cannot
be told apart from one the tool printed: the command names the proof the run expects, and the
algorithm and every value it covers are part of the plugin or of the implementer's prompt.

OPEN: a workflow script sees only the object a stage returns, and every value the tool can print,
the stage that runs the tool can produce as well, so no field of that object can prove that the
tool ran.

## The follow-up run's spec

A follow-up run hands its implementer the spec its parent run checked, and the spec must not have
changed since. Its check therefore passes `--sha256` with the value in `args.parent.spec`, and the
tool fails before the implementer's first edit when the spec it reads has another `sha256`. The value
takes part in the proof as well, so the script and the tool agree on the spec the run expects.

## A failed check

A failed check ends the run as `failed`, with the tool's error output in the message, before any
later stage, and the stage failure carries the result of the stage that ran the check. The script
accepts the implementer's result as it is when the check failed, without the other completeness
checks, so the stage helper never asks the implementer again: another attempt could pass only by
changing what the check compares.

## Rejected alternatives

**The launch check kept, with the script reading the proof from its printed output.** Reason: the
stage did nothing the writer cannot do as its first step, so the stage itself went.

**A reviewer of a review pass running the spec check.** Reason: a review pass reviews a change made
without a spec, so there is no spec to check.

**A stage of its own that checks the repository list of a review pass against the tree.** Reason:
the session that launches the pass writes that list itself, and the list names what the pass
reviews, so a repository it leaves out is outside the review by that choice. A new agent stage also
needs the user's explicit permission, which this one did not have.
