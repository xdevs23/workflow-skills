# Fix-only follow-up runs

A run of the implement-review-verify workflow can end with findings that were not fixed. Until
now the only way to fix them was a new unit with a spec, and a spec must quote the user. Nobody
asked for those particular fixes in words, so the orchestrating session had to cite something
only loosely related, and a finding the user never agreed with could pass for an instruction.

A fix-only follow-up run is a separate workflow shape with no spec of its own and no quotation of
its own. It fixes what a named earlier run returned to be fixed, reading the parent unit's spec for
the user's words, and a check from the inside maps every change it makes to an entry.

## Requirements

**fix-shape-subject**: Follow-up work that only fixes review findings gets a workflow shape of its own.

**fix-not-authorized-by-words**: A fix of a recorded finding is not authorized by the user's words, and a general
instruction to fix findings does not authorize a particular one, because the user may not
agree with the finding.

**corrective-without-words**: Every run that returned something to fix gets a fix run, without the user's words for
any particular fix. The orchestrating session sorts nothing out of it, and the fix run's fixer
settles each entry by the user's words in the parent spec and the rules.

**nothing-unasked**: A fix run implements nothing the user did not ask for: no new user interface element, no
new database table, no library swap, and no other addition of that kind.

**agents-verify-the-kind**: The fixer treats each entry as a claim and verifies it against the tree, and the diff
check reports a change of scope or of what the user sees that neither the user's words nor a rule
calls for, whatever its entry asks. No wish of the orchestrating session reaches the list.

**build-agreed**: The proposed shape is written as a spec and built.

**fix-list-format**: A fix run takes a fix list instead of a spec: a YAML file in the project's
ignored private directory with exactly three keys, `result`, the saved result of the parent run,
`spec`, the spec the parent run checked, and `entries`. Each entry holds its `source` and one item
the parent run returned to be fixed, as that result holds it: a spec finding of its implementer,
`impl:<index>`, a finding of its roaster, `roaster:<index>`, of its diff check, `diff:<index>`, or
of one of its reviewers, `review:<seat>:<index>`, under `finding`; a decision of its finding
verifier, `verify:<index>`, under `decision`; an unresolved issue of the verifier, `issue:<index>`,
under `issue`; an entry of a fix run's own list that its fixer left open, `entry:<index>`, under
`entry`; a failed proof of the run, `proof:<index>`, under `proof`; or a measured size breach of
the unit, `size`, under `size`. The list holds no word of the orchestrating session, no correction
and no pointer.

**written-from-scratch**: The spec tool writes a fix list with `--make-fix-list <saved result>`, the
output file the workflow tool saved the parent run's result in, which the orchestrating session
copies into the project cache unchanged. The list names that file by its absolute path, the spec the
run's check passed on, or null when it checked none, as a review pass does, and holds the run's
`toFix` list. Each script builds that list from the results it accepted: every spec finding of its
implementer, every decision and unresolved issue of its verify stage apart from an approved
correction its fixer fixed or rejected that decides neither an inverse-spec finding nor a
kind-bearing one, in a run without a verify stage every finding of its reviewers, in a fix run every
entry of its own list its fixer left open, every finding of its roast stage and diff check, and
every `failed-proof` item of its remaining list with the writer's label and quoted checks. A failed
proof stays open whatever the fixer answered: its fixes and rejections close their entries, and the
failing check goes to the next fix run, so a run whose fixer closed every entry, or a main run that
approved nothing, still hands its failed check on instead of giving the generator nothing to fix. A
decision on a kind-bearing finding, a project-benefit decision, carries those findings in
`projectBenefit`, because the decision alone names its sources only by their IDs and the fix run
needs to know its kind. A fix run's fixer closes an entry by rejecting it, by raising it as a
question or by a fix its diff check mapped a change to; a blocked entry and one the fixer never
answered stay open. A fix closes no project-benefit entry, which holds a finding with a kind, a
decision with `projectBenefit`, or an earlier entry that holds either: a patch that keeps the
flagged mechanism resolves nothing, so the entry goes to the next fix run, whose fixer checks the
tree again and rejects the entry once the mechanism is gone. A result the run refused or that
carries a hard flag closes nothing. A run in which a stage failed gets no fix list, whatever exit it
ended with: the exit names only the first cause that ended the run, so a roaster that failed after
the fixer blocked an entry shows only as the `stage-failure` item it left in `remaining`, and the
tool refuses any result that holds one. Such a run is incomplete, and it ended on its own, so the
orchestrating session shows its stage failures to the user instead of resuming it. A run in which a
stage raised a hard flag gets no fix list either, whatever exit it ended with: every hard flag
leaves an `abort` item in `remaining`, the tool refuses any result that holds one, and the unit
continues only on the user's answer, added to a copy of the spec for a new run. A run whose finding
verifier found a writer commit outside its scope gets no fix list either: the main script ends such
a run before its fixer, because no correction may build on that commit, and a fix run would apply
the approvals it left open on the same snapshot. The tool refuses any result that holds a
`writer-scope` item, and the orchestrating session shows each one to the user. The tool also refuses
a result without a list of the implementer's artifacts, each a path and what it holds, a result
whose final snapshots are neither null nor one `{ path, sha }` per repository, a result that holds
one source twice in `toFix`, or whose `spec` carries a sha256 other than 64 lowercase hexadecimal
digits or a line count that is no positive integer, since a spec that passed its check counts at
least one line. `--size <json>` adds a size breach the orchestrating session measured, with the
implementation lines added and the commits measured, beside the spec lines the parent run's spec
check counted. The orchestrating session saves the list unchanged and adds, deletes and edits
nothing. A fix list is never made from a spec, a spec is never made from a fix list, and neither is
used for the other kind of run.

**fix-list-check**: The spec tool has a mode that takes a fix list in place of the spec argument,
with the existing `--json`. It validates the list's shape strictly, as it does a spec, and refuses
the keys of a spec, as the spec mode refuses the keys of a fix list. It reads the saved result the
list names, lists what the run returned to be fixed the way the generator does, and compares the
whole fix list with that list, in the generator's order with a size breach last, so an edited, a
missing, an added and a misplaced entry fail alike. A size entry is held to the spec lines the
parent run's spec check counted. It requires the spec to be the one the parent run's check printed,
with the same sha256, or null when that run checked none. With `--base`, and `--partial-base` beside
it, it checks a base list against the tree it runs in as the spec mode does, and requires it to name
exactly the final snapshot of each repository the saved result holds, so an earlier commit the tree
also holds fails as well. A review pass returns null as its snapshots, since it reviews the tree as
it is, and the fix run of one starts from the commit each repository is at, which only the check
against the tree covers. A passing list prints its spec, the spec's sha256 and spec lines beside the
saved result where it names a spec, the base list it checked, the list's `sha256`, the implementer's
artifacts the saved result holds, and as its proof the fingerprint of the list path, the spec, the
entries, the artifacts, the base list, whether it is partial and the directory the tool runs in, as
the record of the spec check describes, so the output of a fix run's own check carries the spec, the
list and the base list on to the next fix list. With `--entries` it prints the entries as well.
Every failure is reported as a violation naming the entry's source. The result is parsed as JSON,
never by hand.

**fix-script**: The skill ships a fix script beside the main script, in its shape: a marked block of
unit values on top (main checkout, worktree, fix list path, parent spec, transcript directory,
plugin root, check command, base snapshots and whether that list is partial, documents directory,
the entries, the artifacts, the rule sources and the model per stage), and a reviewed body below it
that is not edited per run. The base is the parent run's final snapshot, one commit per repository
of the tree, and the spec, the entries and the artifacts are the tool's output for the fix list. Its
stages, in order, are the fixer together with the roaster, and the diff check. It reuses the shared
preamble, retry helper, writer checks and remaining-items handoff of the main script. The script
itself checks only that the spec is named or null, that the entries are a non-empty list of objects,
each with a source string and the one object it holds, and that the artifacts are a list of objects,
each with a path and what it holds. It hands a non-empty list of artifacts to the fixer and the diff
check in the block the main script uses, and returns the list in its result, so the next fix run of
the unit receives the same files.

**list-check**: The fixer runs the spec tool on the fix list and the base list before anything else,
as the implementer of the main script runs the spec check. Its command changes to the worktree,
carries no entry of the list, and quotes every value as one shell word. The tool fails when the list
differs from what the parent run returned or the base list does not match the tree. The script
computes the fingerprint of the list path, the spec, the entries, the artifacts, the base list,
whether it is partial and the worktree it received at launch, and the run continues only when the
proof the tool printed equals it. A launched spec or entry that differs from the list, launched
artifacts that differ from the parent run's result, a missing or an added entry, and a check that
failed all end the run as failed, without asking the fixer again. So every stage receives what the
parent run returned.

**fixer-on-every-entry**: The fixer receives every entry, one key per source, as the parent run
returned it, and the parent spec. It resolves each entry with the user's words, the rule sources and
the engineering-principles and code-writing skills as its guide, and returns one of four
dispositions per key: fixed, rejected with counterevidence, blocked with evidence, or a question for
the user. A rejection closes its entry, and a blocked entry stays open for the next fix list. It
returns a question only for a product decision that no rule, skill or word of the user decides,
after checking that the question is valid; the design of that rule is recorded in the document on
the root making no decisions. A project-benefit entry is resolved by deleting or rewriting the
flagged mechanism, and the fixer rejects it once the tree no longer holds that mechanism, when the
user's words in the spec keep its shape, or when the finding is false. The policy of these
dispositions lives in the fixer's template, and the script's prompt carries only the inputs it
needs. Where the list names a parent spec, the fixer checks it and sets `invalid-spec` on an invalid
one before its first write. A list that names no spec gives the fixer and the diff check none to
read, and their `abort` offers neither `no-words` nor `invalid-spec`. The roaster runs alongside it
on the same list, as in the main script.

**diff-check**: After the fixer, one read-only stage, with its own agent template, reads the fix
diff from the parent run's final snapshot to the fixer's snapshot, with the fix list, the parent
spec, the implementer's artifacts and the rule sources its prompt names, and maps every change in it
to the key of an entry, with one mapping for each entry a change carries out. A change that maps to
no entry, or that changes the product's scope or what the user sees and does where neither the
user's words nor a rule calls for it, whatever the entry asks, is a CRITICAL finding. It checks the
parent spec first and sets `invalid-spec` on an invalid one, which ends the run as an abort. Its
findings go to the remaining items and start no further fixer in the run.

**fix-run-exit**: Every entry the fixer reports fixed returns as an unattested fix for the
orchestrating session to attest, as in the main script, and the run then ends `follow-up`, as it
also does when only roast findings remain. A rejected entry stays in the run's dispositions and adds
no remaining item. Only a fixer result the run accepted answers an entry: after an abort, every
entry stays open with the fixer's response beside it. A question returns as a user question and ends
the run `root-resolution`, as does a blocked entry, a fix reported as done that has no commit or
maps to no change in the diff check, a failed proof, or a change the diff check maps to no entry. It
ends `clean` only when nothing at all remains. Aborts and stage failures end it as in the main
script.

**fix-document**: A fixer whose correction alters the design extends the design document that
already describes the part it changed, and writes a new one, named after the fix list, only when no
document describes that part.

**when-to-use**: The skill's section on remaining items states that every run that returned a
decision or a finding to fix, a fix run included, gets a fix run, and that the orchestrating session
reads none of what it returned to sort or decide it.

## Boundaries

**files-in-scope**: The unit adds the fix script, the agent template of the diff check beside one of a scope check
that a later change removed, and the fix-list mode of the spec tool with its tests and fixtures; it edits the
skill's section on remaining items and follow-up work, the routing tests for the new
script, the README's lists of agents and of scripts where they exist, the generated design
document, the skill's inventories of scripts, templates and launch checks and the README's
description of the spec tool, and the plugin version, which becomes 0.17.0. The main and pre-phase scripts do
not change. The words seat and lane stay where they name existing review roles.

## Rejected alternatives

**rejected-general-words**: Citing a general instruction to fix every finding as a unit spec's authority for a fix.
Reason: The user may disagree with a particular finding.

**rejected-written-corrections**: Corrections written by the orchestrating session in a fix list.
Reason: The fix run passes on what the reviewer said.

**rejected-spec-copy**: A fix list made from a copy of the spec.
Reason: The fix run takes its own YAML shape, written from scratch, and a spec and a fix list never
mix.

**rejected-journal**: A fix list could be read from the journal the workflow tool keeps for the run.
Reason: the journal serves resuming and diagnosing a run, and what a run hands on is the result its
script returns, so the script returns everything its fix list needs.
