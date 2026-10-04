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
ignored private directory with exactly three keys, `run`, the parent run's id, `spec`, the spec the
parent run checked, and `entries`. Each entry holds its `source` and one item the parent run returned
to be fixed, as the journal holds it: a spec finding of its implementer, `impl:<index>`, a finding
of its roaster, `roaster:<index>`, of its diff check, `diff:<index>`, or of one of its review seats,
`review:<seat>:<index>`, under `finding`; a decision of its finding verifier, `verify:<index>`,
under `decision`; an unresolved issue of the verifier, `issue:<index>`, under `issue`; an entry of
a fix run's own list that its fixer left open, `entry:<index>`, under `entry`; or a measured size
breach of the unit, `size`, under `size`. The list holds no word of the orchestrating session, no
correction and no pointer.

**written-from-scratch**: The spec tool writes a fix list with `--make-fix-list <run>` and the
existing `--transcripts <dir>`: the spec the parent run's launch check printed and everything the run
returned to be fixed. That is every spec finding of its implementer, every decision and unresolved
issue of its last verify stage, in a run without a verify stage every finding of its review seats,
in a fix run every entry of its own list its fixer left open, and every finding of its last roast
stage and diff check. A fix run's fixer closes an entry by rejecting it, by raising it as a question
or by a fix its diff check mapped a change to; a blocked entry and one the fixer never answered stay
open. `--size <json>` adds a size breach the orchestrating session measured, with the implementation
lines added and the commits measured, beside the spec lines the parent run's launch check counted.
The orchestrating session saves the list unchanged and adds, deletes and edits nothing. A fix list
is never made from a spec, a spec is never made from a fix list, and neither is used for the other
kind of run.

**fix-list-check**: The spec tool has a mode that takes a fix list in place of the spec argument,
with the existing `--transcripts <dir>` and `--json`. It validates the list's shape strictly, as it
does a spec, and refuses the keys of a spec, as the spec mode refuses the keys of a fix list. It
finds the run's journal in exactly one session of the transcript directory, lists what the run
returned to be fixed the way the generator does, and compares the whole fix list with that list, so
an edited, a missing and an added entry fail alike. A size entry is held to the spec lines the
parent run's launch check counted. It requires the spec to be the one the parent run's launch check
printed, with the same sha256. A passing list prints its spec, the spec's sha256 and spec lines and
its entries beside the run, the list's `sha256` and the same random proof a passing spec prints, so
a fix run's own launch output carries the spec and the list on to the next fix list. Every failure
is reported as a violation naming the entry's source. The journal is parsed as JSON lines, never by
hand.

**fix-script**: The skill ships a fix script beside the main script, in its shape: a marked block
of unit values on top (main checkout, worktree, fix list path, parent spec, transcript directory,
plugin root, check command, base snapshots, documents directory, the entries, the rule sources and
the model per stage), and a reviewed body below it that is not edited per run. The base is the
parent run's final snapshot, one commit per repository of the tree, and the spec and the entries
are the tool's output for the fix list. Its stages, in order, are the launch check, the fixer
together with the roaster, and the diff check. It reuses the shared preamble, retry helper, writer
checks and remaining-items handoff of the main script. The script itself checks only that the spec
is named and that the entries are a non-empty list of objects, each with a source string and the
one object it holds.

**list-launch-check**: The launch check is the same small stage as in the main script. Its command
changes to the worktree and runs the spec tool on the fix list with `--expect`, a JSON argument the
script builds from the spec and the entries it received at launch. The tool fails when the list
differs from what the parent run returned, when the launched spec or a launched entry differs from
the list, when an entry of the list is missing from the launch values, and when a launched source is
repeated or names no entry of the list. The run continues only
when the stage returns a filled proof; otherwise the stage is retried and then the run fails. So
every stage receives what the journal holds, and the script parses nothing.

**fixer-on-every-entry**: The fixer receives every entry, one key per source, as the journal holds
it, and the parent spec. It resolves each entry with the user's words, the rule sources and the
engineering-principles and code-writing skills as its guide, and returns one of four dispositions
per key: fixed, rejected with counterevidence, blocked with evidence, or a question for the user.
A rejection closes its entry, and a blocked entry stays open for the next fix list. It returns a
question only for a product decision that no rule, skill or word of the user decides, after
checking that the question is valid; the design of that rule is recorded in the document on the
root making no decisions. The policy of these dispositions lives in the fixer's template, and the
script's prompt carries only the inputs it needs. The fixer checks the parent spec and sets
`invalid-spec` on an invalid one before its first write. The roaster runs alongside it on the same
list, as in the main script.

**diff-check**: After the fixer, one read-only stage, with its own agent template, reads the fix
diff from the parent run's final snapshot to the fixer's snapshot, with the fix list and the parent
spec its prompt names, and maps every change in it to the source of an entry. A change that maps to
no entry, or that changes the product's scope or what the user sees and does where neither the
user's words nor a rule calls for it, whatever the entry asks, is a CRITICAL finding. It checks the
parent spec first and sets `invalid-spec` on an invalid one, which ends the run as an abort. Its
findings go to the remaining items and start no further fixer in the run.

**fix-run-exit**: Every entry the fixer reports fixed returns as an unattested fix for the
orchestrating session to attest, as in the main script, and the run then ends `follow-up`, as it
also does when only roast findings remain. A rejected entry stays in the run's dispositions and adds
no remaining item. A question returns as a user question and ends the run `root-resolution`, as
does a blocked entry, a fix reported as done that has no commit or maps to no change in the diff
check, a failed proof, or a change the diff check maps to no entry. It ends `clean` only when
nothing at all remains. Aborts and stage failures end it as in the main script.

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
