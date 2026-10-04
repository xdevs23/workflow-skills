# The launch check proves what it checked

Both workflow scripts of implement-review-verify begin with a launch check: one small stage runs the
spec tool on the run's input and returns the proof the tool prints when the check passes. The proof
is the fingerprint of the values the tool checked, and the script continues only when it equals the
fingerprint of the values the script itself launched with.

## The proof

The spec tool prints as `proof` the 32-bit FNV-1a hash of the values it checked, written as JSON
with the keys of every mapping in sorted order. A spec check covers the spec path, the transcript
directory, the base list, whether the base list is partial and the directory the tool runs in, as
the operating system reports it with symbolic links resolved. A fix-list check covers the path of
the fix list, the transcript directory, the spec the list names, its entries, the base list the fix
run starts from, whether that list is partial and the directory the tool runs in. The same values
give the same proof on every run, and a failing check prints none.

The base list is checked against the repositories of the directory the tool runs in, so the spec
check's proof covers that directory. Another checkout that holds the same commits passes the same
list, and its proof differs from the one the main script computes with its worktree, so a launch
check that ran outside the worktree stops the run, in a main run and a fix run alike. The marked
block of each script therefore names the worktree by its absolute path without symbolic links. Every
value of the launch command is one single-quoted shell word, so a path holding a space or an
apostrophe reaches the tool unchanged.

The hash has one definition, the spec tool's fingerprint module, with two helpers, `withSortedKeys`
and `fingerprint`. The spec tool imports it. A workflow script runs without imports and has no hash
library to call, so each script carries the two helpers as the module writes them, and the routing
tests hold both copies to the module's text.

## What the comparison shows

The comparison shows that the values the tool checked are the values the run launched with and hands
its stages: a check of other values, a spec check in another tree, a failed check and a proof the
stage made up all stop the run. It does not show that the tool computed the proof. The algorithm
is part of the plugin, and every value it covers is in the stage's prompt or in the fix list the
prompt names, so a stage could compute the same fingerprint without running the tool.

OPEN: a workflow script sees only the object a stage returns, and every value the tool can print,
the stage that runs the tool can produce as well, so no field of that object can prove that the
tool ran.

## The fix run's launch values

A fix run hands its stages the entries it received at launch, so those entries have to equal the fix
list the tool held to the parent run's journal. The fingerprint carries that comparison: the entries
take part in the script's fingerprint and in the tool's, so a single changed character in any entry,
another spec, a missing entry, an added one, another order or another list gives another proof. The
launch command carries no entry of the list and stays short. The base list it does carry holds one
entry per repository. The fix list's `--json` summary holds the entries only with `--entries`, which
the orchestrating session uses to build the launch values, so the launch check returns a short
summary.

## A failed check

A failed launch check ends the run at once, with the tool's error output in the message. The stage
helper retries only a stage that returned nothing usable. Another attempt at a failed check could
pass only by changing what the check compares, so no second stage sees the failure.

## What it replaces

The tool used to print a random proof, and the scripts continued on exit code zero and any non-empty
proof. The fix script passed the spec and every entry to the tool as one JSON argument of
`--expect`, which the tool compared with the list. A stage that left out `--expect`, or returned a
proof it wrote itself, still passed. On a large fix list the stage retyped an argument of about
100 kilobytes and broke it, and the retry named the entry that differed, which a stage then
"repaired" by editing the fix list. Both defects were reported as issues #9 and #10 of the plugin's
repository.

The design of the first launch check had the script handle the failure case and nothing else. That
decision changed with this one, because a script that compares nothing cannot tell a check of its
own values from any other reported result.

## Rejected alternatives

**The tool's hash passed in at launch.** The orchestrating session would pass the hash the tool
printed for the fix list beside the entries, and `--expect` would take that hash. Reason: the stages
receive the entries from the launch values, and a script that cannot compute a hash cannot check
that those entries are the ones the hash covers.
