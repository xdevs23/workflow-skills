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

**corrective-without-words**: For a finding that needs no decision of the user, such as a mechanical defect, a logic
error or another technical fault, the orchestrating session may launch a focused fix run
without the user's words.

**nothing-unasked**: A fix run implements nothing the user did not ask for: no new user interface element, no
new database table, no library swap, and no other addition of that kind.

**agents-verify-the-kind**: The stages inside the fix run are told to verify that each requested change really is a
corrective change, and not a wish of the orchestrating session presented as a bug fix.

**build-agreed**: The proposed shape is written as a spec and built.

**fix-list-format**: A fix run takes a fix list instead of a spec: a YAML file in the project's
ignored private directory with exactly three keys, `run`, the parent run's id, `spec`, the spec the
parent run checked, and `entries`. Each entry holds its `source` and what the parent run returned to
be fixed, as the journal holds it: a decision of its finding verifier, `verify:<index>` with the
decision under `decision`, or a finding of its roaster, `roaster:<index>`, of its diff check,
`diff:<index>`, or of one of its review seats, `review:<seat>:<index>`, with the finding under
`finding`. The list holds no word of the orchestrating session, no correction and no pointer.

**written-from-scratch**: The spec tool writes a fix list with `--make-fix-list <run>` and the
existing `--transcripts <dir>`: the spec the parent run's launch check printed, every decision of its
last verify stage except a cleanup decision and an approved correction its fixer reported fixed, in
a run without a verify stage every finding of its review seats, and every finding of its last roast
stage and diff check. The orchestrating session saves the list unchanged and adds, deletes and edits
nothing. A fix list is never made from a spec, a spec is never made from a fix list, and neither is
used for the other kind of run.

**fix-list-check**: The spec tool has a mode that takes a fix list in place of the spec argument,
with the existing `--transcripts <dir>` and `--json`. It validates the list's shape strictly, as it
does a spec, and refuses the keys of a spec, as the spec mode refuses the keys of a fix list. It
finds the run's `journal.jsonl` under the transcript directory at
`<session>/subagents/workflows/<run>/journal.jsonl`, in exactly one session, takes the result of
the last agent of each stage an entry names, and requires every entry to equal the element at its
index there, so an edited decision or finding fails. It requires the spec to be the one the parent
run's launch check printed, with the same sha256. A passing list prints its spec, the spec's sha256
and its entries beside the run, the list's `sha256` and the same random proof a passing spec
prints. Every failure is reported as a violation naming the entry's source. The journal is parsed as
JSON lines, never by hand.

**fix-script**: The skill ships a fix script beside the main script, in its shape: a marked block
of unit values on top (main checkout, worktree, fix list path, parent spec, transcript directory,
plugin root, check command, base snapshots, documents directory, the entries, the rule sources and
the model per stage), and a reviewed body below it that is not edited per run. The base is the
parent run's final snapshot, one commit per repository of the tree, and the spec and the entries
are the tool's output for the fix list. Its stages, in order, are the launch check, the fixer
together with the roaster, and the diff check. It reuses the shared preamble, retry helper, writer
checks and remaining-items handoff of the main script. The script itself checks only that the spec
is named and that the entries are a non-empty list of objects, each with a source string and a
decision or a finding object.

**list-launch-check**: The launch check is the same small stage as in the main script. Its command
changes to the worktree and runs the spec tool on the fix list with `--expect`, a JSON argument the
script builds from the spec and the entries it received at launch. The tool fails when the launched
spec or a launched entry differs from the list, when an entry of the list is missing from the launch
values, and when a launched source is repeated or names no entry of the list. The run continues only
when the stage returns a filled proof; otherwise the stage is retried and then the run fails. So
every stage receives what the journal holds, and the script parses nothing.

**fixer-on-every-entry**: The fixer receives every entry, one key per source, as the journal holds
it, and the parent spec. It resolves each entry with the user's words, the rule sources and the
engineering-principles and code-writing skills as its guide, and returns one of four dispositions
per key: fixed, rejected with counterevidence, blocked with evidence, or a question for the user.
It returns a question only for a product decision that no rule, skill or word of the user decides,
after checking that the question is valid; the design of that rule is recorded in the document on
the root making no decisions. The roaster runs alongside it on the same list, as in the main
script.

**diff-check**: After the fixer, one read-only stage, with its own agent template, reads the fix
diff from the parent run's final snapshot to the fixer's snapshot, with the fix list and the parent
spec its prompt names, and maps every change in it to the source of an entry. A change that maps to
no entry, or that changes the product's scope or what the user sees and does where neither the
entry, the user's words nor a rule calls for it, is a CRITICAL finding. Its findings go to the
remaining items and start no further fixer in the run.

**fix-run-exit**: Every entry the fixer reports fixed returns as an unattested fix for the
orchestrating session to attest, as in the main script, and the run then ends `follow-up`, as it
also does when only roast findings remain. A question returns as a user question and ends the run
`root-resolution`, as does an entry that was not fixed, a fix reported as done that has no commit or
maps to no change in the diff check, a failed proof, or a change the diff check maps to no entry.
It ends `clean` only when nothing at all remains. Aborts and stage failures end it as in the main
script.

**fix-document**: A fixer whose correction alters the design extends the design document that
already describes the part it changed, and writes a new one, named after the fix list, only when no
document describes that part.

**when-to-use**: The skill's section on remaining items states that every run that returned a
decision or a finding to fix, a fix run included, gets a fix run, and that the orchestrating session
reads none of what it returned to sort or decide it.

## Boundaries

**files-in-scope**: The unit adds the fix script, the two agent templates for the scope check and the diff
check, and the fix-list mode of the spec tool with its tests and fixtures; it edits the
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
