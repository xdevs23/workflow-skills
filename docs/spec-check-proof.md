# The writer's spec check proves what it checked

The writer of each workflow script of implement-review-verify runs the spec tool before anything
else: the implementer on the unit spec in a main run, the fixer on the fix list in a fix run. It
returns what the tool printed, and the script continues only when the proof printed there equals
the fingerprint of the values the script itself launched with. A review pass reviews a change made
without a spec, so it runs no writer and no check.

## The proof

The spec tool prints as `proof` the 32-bit FNV-1a hash of the values it checked, written as JSON
with the keys of every mapping in sorted order. A spec check covers the spec path, the transcript
directory, the base list, whether the base list is partial and the directory the tool runs in, as
the operating system reports it with symbolic links resolved. A fix-list check covers the path of
the fix list, the transcript directory, the spec the list names, null for a list that names none,
its entries, the base list the fix run starts from, whether that list is partial and the directory
the tool runs in. The same values give the same proof on every run, and a failing check prints
none.

The base list is checked against the repositories of the directory the tool runs in, so the spec
check's proof covers that directory. Another checkout that holds the same commits passes the same
list, and its proof differs from the one the script computes with its worktree, so a check that
ran outside the worktree stops the run, in a main run and a fix run alike. The marked block of each
script therefore names the worktree by its absolute path without symbolic links. Every value of the
check's command is one single-quoted shell word, so a path holding a space or an apostrophe reaches
the tool unchanged.

The hash has one definition, the spec tool's fingerprint module, with two helpers, `withSortedKeys`
and `fingerprint`. The spec tool imports it. A workflow script runs without imports and has no hash
library to call, so each script carries the two helpers as the module writes them, and the routing
tests hold both copies to the module's text.

## Who runs the check

The check is the first block of the writer's prompt: one command, run once exactly as written,
whose exit code, stdout and stderr the writer returns unchanged in `specCheck`, a field its schema
requires. On a failed check the writer edits nothing. The script parses the printed JSON, reads its
`proof` field and compares it with its own fingerprint, so output that is no JSON ends the run like
a wrong proof.

The fix-list generator of the spec tool reads what a run checked from the same place: the
`specCheck` of the implementer in a main run and of the fixer in a fix run, and the output of the
launch check in a run of an earlier version. A run with none of them, a review pass, checked no
spec, and its fix list names none.

## What the comparison shows

The comparison shows that the values the tool checked are the values the run launched with and hands
its stages: a check of other values, a spec check in another tree, a failed check and a proof that
is made up all stop the run. It does not show that the tool computed the proof. The algorithm is
part of the plugin, and every value it covers is in the writer's prompt or in the fix list the
prompt names, so a writer could compute the same fingerprint without running the tool.

OPEN: a workflow script sees only the object a stage returns, and every value the tool can print,
the stage that runs the tool can produce as well, so no field of that object can prove that the
tool ran.

## The fix run's launch values

A fix run hands its stages the entries it received at launch, so those entries have to equal the fix
list the tool held to the parent run's journal. The fingerprint carries that comparison: the entries
take part in the script's fingerprint and in the tool's, so a single changed character in any entry,
another spec, a missing entry, an added one, another order or another list gives another proof. The
check's command carries no entry of the list and stays short. The base list it does carry holds one
entry per repository. The fix list's `--json` summary holds the entries only with `--entries`, which
the orchestrating session uses to build the launch values, so the fixer returns a short summary.

## A failed check

A failed check ends the run as `failed`, with the tool's error output in the message, before any
later stage. The script accepts the writer's result as it is when the check failed, without the
other completeness checks, so the stage helper never asks the writer again: another attempt could
pass only by changing what the check compares. In a fix run the roaster runs beside the fixer, and
its findings end with the rest of the run.

## What it replaces

The check used to be a stage of its own at the start of each script, the launch check: a small
stage on a model of its own whose prompt was one command line, and which returned the tool's output
together with the proof copied into a field of its own. The script compared only that copied field,
so printed output that was no JSON at all still passed. Every value the stage worked with sits in
the writer's prompt as well, and the writer runs commands anyway, so the writer now runs the check,
the script reads the proof from what the tool printed, and the run starts one agent fewer.

Before the fingerprint, the tool printed a random proof, and the scripts continued on exit code
zero and any non-empty proof. The fix script passed the spec and every entry to the tool as one
JSON argument of `--expect`, which the tool compared with the list. A stage that left out
`--expect`, or returned a proof it wrote itself, still passed. On a large fix list the stage retyped
an argument of about 100 kilobytes and broke it, and the retry named the entry that differed, which
a stage then "repaired" by editing the fix list. Both defects were reported as issues #9 and #10 of
the plugin's repository.

## Rejected alternatives

**The tool's hash passed in at launch.** The orchestrating session would pass the hash the tool
printed for the fix list beside the entries, and `--expect` would take that hash. Reason: the stages
receive the entries from the launch values, and a script that cannot compute a hash cannot check
that those entries are the ones the hash covers.

**The launch check kept, with the script reading the proof from its printed output.** Reason: the
stage did nothing the writer cannot do as its first step, so the stage itself went.

**A reviewer of a review pass running the spec check.** Reason: a review pass reviews a change made
without a spec, so there is no spec to check.
