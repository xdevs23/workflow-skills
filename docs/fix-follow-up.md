# Fix-only follow-up runs

A run of the implement-review-verify workflow can end with findings that were not fixed. Until
now the only way to fix them was a new unit with a spec, and a spec must quote the user. Nobody
asked for those particular fixes in words, so the orchestrating session had to cite something
only loosely related, and a finding the user never agreed with could pass for an instruction.

A fix-only follow-up run is a separate workflow shape with no spec and no quotation. It fixes
findings of a named earlier run that are purely corrective, and it checks from the inside that
each requested change really is corrective and not a new choice presented as a bug fix.

This document is generated from a private spec by the spec tool and is never edited by hand.

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

**fix-list-format**: A fix run takes a fix list instead of a spec: a YAML file under the main checkout's
ignored cache directory with the mapping keys `parentSpec` (the path of the unit spec the
parent run was built against), `run` (the parent run's id) and `entries`. Each entry is a
mapping with exactly the keys `id` (unique, kebab-case), `source` (the finding's source id in
the parent run, `<seat>:<index>` or `roaster:<index>`), `finding` (a verbatim part of that
finding's claim) and `correction` (the change to make, in plain words). The list holds no
user words and no field for them. The simpler alternative this rules out is a unit spec
that cites loosely related words.

**fix-list-check**: The spec tool gains a mode, `--fix-list <file>` in place of the spec argument, with the
existing `--transcripts <dir>` and `--json`. It validates the list's shape strictly, as it
does a spec, and resolves every entry against the parent run: the run's `journal.jsonl` is
found under the transcript directory at `<session>/subagents/workflows/<run>/journal.jsonl`;
the entry's source seat names the stage whose `started` record carries the label
`review:<seat>`, or `roast` for the roaster; the result record of that stage's agent (the
last one, when it was retried) holds a `findings` list with an element at the index; and
`finding` occurs in that element's `claim` after collapsing whitespace. `parentSpec` must
name an existing file. Every failure is reported as a violation naming the entry id, and a
passing list prints the same random proof a passing spec prints. The journal is parsed as
JSON lines, never by hand. The simpler alternative this rules out is trusting the
orchestrating session to copy findings faithfully.

**fix-script**: The skill ships a third script, `skills/implement-review-verify/scripts/fix-follow-up.js`,
in the shape of the other two: a marked block of unit values on top (main checkout,
worktree, fix list path, transcript directory, plugin root, check command, base commit,
and the model per stage), and a reviewed body below it that is not edited per run. The
base commit is the parent run's final snapshot. Its stages, in order, are the launch check,
the scope check, the fixer together with the roaster, and the diff check. It reuses the
shared preamble, retry helper, writer checks and remaining-items handoff of the main
script.

**fix-gate**: The launch check is the same small stage as in the other scripts. Its command changes to
the worktree and runs the spec tool on the fix list, and the run continues only when the
stage returns a filled proof; otherwise the stage is retried and then the run fails.

**scope-check**: The scope check is one read-only stage, with its own agent template, that runs before any
edit. It reads the fix list, the parent spec, the parent run's finding and the tree, and
puts every entry into exactly one of two classes. Corrective: code the parent unit wrote
fails the parent spec or a project rule, for example a logic error, a crash, a race, a rule
violation or a mechanical defect, and the correction restores the intended behavior without
adding any. New choice: the correction adds or changes behavior, a user interface element, a
data shape or table, a dependency or library, an interface, or a product decision, whatever
the entry calls itself. Its prompt states that the fix list is written by the orchestrating
session, that calling something a bug is a claim to check, and that an entry it cannot
place with confidence is a new choice. Each classification carries a reason and at least one
receipt, and the script requires exactly one classification per entry id.

**refused-entries**: An entry classed as a new choice is not fixed. It goes to the run's remaining items with
its reason, for the orchestrating session to bring to the user or to a full unit. When no
entry is corrective the run ends there with exit `root-resolution` and no fixer runs.

**fixer-on-corrective**: The fixer receives only the corrective entries as its approved list, one key per entry id,
each with the entry's correction, the scope check's reason and its receipts, and it
applies them with its existing bounded sense check and commit rules. The roaster runs
alongside it on the same list, as in the main script.

**diff-check**: After the fixer, one read-only stage, with its own agent template, reads the fix diff from
the base commit to the fixer's snapshot and maps every change in it to a corrective entry.
A change that maps to no entry, or that adds behavior, a user interface element, a data
shape, a dependency or an interface, is a CRITICAL finding. Its findings go to the
remaining items and start no further fixer in the run.

**fix-run-exit**: The fix run ends `clean` when every entry was corrective, the fixer fixed every one with
passing proof, and the diff check and the roaster left nothing of must-fix or CRITICAL
severity. It ends `root-resolution` when an entry was refused, a fix was not applied, the
proof failed, or the diff check found a change without an entry. Aborts and stage failures
end it as in the main script.

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
document, and the plugin version, which becomes 0.17.0. The main and pre-phase scripts do
not change. The words seat and lane stay where they name existing review roles.

## Rejected alternatives

**rejected-general-words**: Citing a general instruction such as "fix all findings" as a unit spec's authority for a fix.
Reason: The user may disagree with a particular finding.

## Acceptance criteria

1. **criterion-fix-list**: Tool tests show a valid fix list passing with a proof, and each of these failing with a
   violation naming the entry: an unknown run, an unknown seat, an index out of range, a
   `finding` not in the claim, a missing `parentSpec` file, and an unknown key.
2. **criterion-scope**: Routing tests of the fix script show a new-choice entry reaching remaining and never the
   fixer, a list with no corrective entry ending before the fixer, and a missing or duplicate
   classification retried and then failed.
3. **criterion-fix-and-diff**: Routing tests show the fixer receiving exactly the corrective entries while the roaster
   runs, the diff check receiving the fix diff, a diff-check finding reaching remaining as
   CRITICAL without a second fixer, and each exit of `fix-run-exit`.
4. **criterion-texts**: The two agent templates state what `scope-check` and `diff-check` require, including the
   untrusted framing of the fix list, and the skill states `when-to-use`.
5. **criterion-done**: `bun test tests/` passes, the generated design document equals the tool's render of this
   spec, and the version is 0.17.0.
