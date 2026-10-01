# Fix-only follow-up runs

A run of the implement-review-verify workflow can end with findings that were not fixed. Until
now the only way to fix them was a new unit with a spec, and a spec must quote the user. Nobody
asked for those particular fixes in words, so the orchestrating session had to cite something
only loosely related, and a finding the user never agreed with could pass for an instruction.

A fix-only follow-up run is a separate workflow shape with no spec of its own and no quotation of
its own. It fixes findings of a named earlier run that are purely corrective, and it checks from
the inside that each requested change really is corrective and not a new choice presented as a bug
fix.

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
ignored private directory with exactly two keys, `run`, the parent run's id, and `entries`. Each
entry holds its `source`, either a decision of the parent run's finding verifier, `verify:<index>`
with the decision under `decision`, or a finding of its roaster, `roaster:<index>` with the finding
under `finding`, as the journal holds it, and `attach`, a list of pointers. A pointer names a
session transcript record or a journal record by `file`, `line` and `key`, the key path inside the
JSON record with one key name per element, or a line of a rule file with an empty key path. The
list holds no word of the orchestrating session and no correction of its own.

**written-from-scratch**: The spec tool writes a fix list with `--make-fix-list <run>` and the
existing `--transcripts <dir>`: every decision of the parent run's last verify stage and every
finding of its last roast stage, in that order, each with an empty `attach` list. The orchestrating
session deletes the entries that do not go to the fix run and attaches pointers to the others, such
as a pointer to the message in which it states a decision of its own. A fix list is never made from
a spec, a spec is never made from a fix list, and neither is used for the other kind of run.

**fix-list-check**: The spec tool has a mode that takes a fix list in place of the spec argument,
with the existing `--transcripts <dir>` and `--json`. It validates the list's shape strictly, as it
does a spec, and refuses the keys of a spec, as the spec mode refuses the keys of a fix list. It
finds the run's `journal.jsonl` under the transcript directory at
`<session>/subagents/workflows/<run>/journal.jsonl`, in exactly one session, takes the result of
the last agent labelled `verify` or `roast`, and requires every entry to equal the element at its
index there, so an edited decision or finding fails. It resolves every pointer: a JSON lines file
by its record and key path, any other file by its line, a relative JSON lines file from the
transcript directory and any other relative file from the tree the tool runs in. A passing list
prints its entries beside the run, the list's `sha256` and the same random proof a passing spec
prints. Every failure is reported as a violation naming the entry's source. The journal is parsed
as JSON lines, never by hand.

**fix-script**: The skill ships a fix script beside the main script, in its shape: a marked block
of unit values on top (main checkout, worktree, fix list path, transcript directory, plugin root,
check command, base snapshots, documents directory, the entries, the rule sources and the model per
stage), and a reviewed body below it that is not edited per run. The base is the parent run's final
snapshot, one commit per repository of the tree, and the entries are the tool's output for the fix
list. Its stages, in order, are the launch check, the scope check, the fixer together with the
roaster, and the diff check. It reuses the shared preamble, retry helper, writer checks and
remaining-items handoff of the main script. The script itself checks only that the entries are a
non-empty list of objects, each with a source string, a decision or a finding object and an
`attach` list, the shape its launch command and its stages are built from. A fix run reads no
spec: each entry points at the records that back it.

**list-launch-check**: The launch check is the same small stage as in the main script. Its command
changes to the worktree and runs the spec tool on the fix list with `--expect`, a JSON argument the
script builds from the entries it received at launch. The tool fails when a launched entry differs
from the list, when an entry of the list is missing from the launch values, and when a launched
source is repeated or names no entry of the list. The run continues only when the stage returns a
filled proof; otherwise the stage is retried and then the run fails. So every stage receives what
the journal holds and the pointers the list attaches, and the script parses nothing.

**scope-check**: The scope check is one read-only stage, with its own agent template, that runs
before any edit. Its prompt names the fix list, the parent run's journal, the rule sources and the
template of every reviewer as the reviewers' rules, and gives each entry as the launch check
compared it with the journal. It reads them, every record the pointers name and the tree at the
parent run's final snapshot, and puts the correction every entry asks for into exactly one of two
classes. Corrective: code the parent unit wrote fails the user's words or a project rule, for
example a logic error, a crash, a race, a rule violation or a mechanical defect, and the correction
restores the intended behavior without adding any; or the correction improves code quality without
changing anything the user's words specify; or it removes code that nothing uses, that nobody
asked for, or that is built beyond what was asked. New choice: the correction adds or changes
behavior, a user interface element, a data shape or table, a dependency or library, an interface,
or a product decision, whatever the entry calls itself. Its prompt frames every entry as a claim to
check, and an entry it cannot place with confidence is a new choice. Each classification carries a
reason and at least one receipt, and the script requires exactly one classification per source.

**refused-entries**: An entry classed as a new choice is not fixed. It goes to the run's remaining
items with its reason, for the orchestrating session to bring to the user or to a full unit. When
no entry is corrective the run ends there with exit `root-resolution` and no fixer runs.

**fixer-on-corrective**: The fixer receives only the corrective entries as its approved list, one
key per source, each with the decision or finding as the journal holds it, its pointers, the scope
check's reason and its receipts. It applies them with its existing bounded sense check and commit
rules. Its prompt carries an authority block for a run without a spec, which ranks the user's words
and the rules the entries point at above the prompt, and it never receives the fix list, so refused
entries never reach it. A blocking limitation from the scope check stops the run before the fixer.
The roaster runs alongside it on the same list, as in the main script.

**diff-check**: After the fixer, one read-only stage, with its own agent template, reads the fix
diff from the parent run's final snapshot to the fixer's snapshot, with the fix list its prompt
names, and maps every change in it to the source of a corrective entry. A change that maps to no
corrective entry, or that adds behavior, a user interface element, a data shape, a dependency or an
interface, is a CRITICAL finding. Its findings go to the remaining items and start no further fixer
in the run.

**fix-run-exit**: Every entry the fixer reports fixed returns as an unattested fix for the
orchestrating session to attest, as in the main script, and the run then ends `follow-up`, as it
also does when only roast findings remain. It ends `root-resolution` when an entry was classed as a
new choice, a fix was not applied, a fix reported as done has no commit or maps to no change in the
diff check, the proof failed, or the diff check found a change that maps to no corrective entry. It
ends `clean` only when nothing at all remains. Aborts and stage failures end it as in the main
script.

**fix-document**: A fixer whose correction alters the design extends the design document that
already describes the part it changed, and writes a new one, named after the fix list, only when no
document describes that part.

**when-to-use**: The skill's section on remaining items states when the orchestrating session uses the fix
run: for findings of a named run of a unit whose spec carries the user's words, where the
fix needs no decision of the user. A finding that needs a decision, an open decision, and
anything the scope check refused go to the user and then to a full unit with a spec. The
session never uses the fix run for work it wants done beyond a finding.

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
