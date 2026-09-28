# The implementer checks the spec

A unit of implement-review-verify no longer goes through a separate review of its spec before the
main run. The root writes the spec as the spec-writing skill says, validates it with the spec tool
and launches the main run on it. The implementer's sense check reads the spec before the first edit
and reports what it finds, and the root reads the findings with every other open item after the
run. Every stage that judges the user's words for a spec, the implementer, the
inverse-spec reviewer and the finding verifier, now accepts only words said about the unit at hand.

## What the change removes

The spec review was a short run of its own, started from a shipped pre-phase script before the main
run. It ran the launch check, a gap finder, an unbriefed soundness reader and the provenance reader,
and it ended at its return so the root could amend the spec before launching the main run. The
script is deleted, and so is the section of implement-review-verify that described it, together with
the script's own section, its completeness rules and its place in the list of shipped scripts. The
skill now ships two scripts, the main script and the fix-run script, and both begin with the launch
check.

Every passage that sent the root to that review now says that the root writes the spec, validates
it with the spec tool and launches the main run on it, and that the stages of that run report what
they find in the spec. This holds for the implement-review-verify skill, including its opening
section on the unit spec and law 7, for the spec-writing skill, for the README row of
implement-review-verify and for the routing tests. The passages that named the provenance reader as
the stage judging a spec before code now name the implementer's sense check. The partial base
setting belongs to the main script alone.

The gap-finder and spec-provenance templates stay in the agents directory, and no script starts
them. The skill says so where it lists the templates. The spec-provenance template keeps its checks
and loses the words that tied it to the removed run: the timing before implementation, the two
classes of finding that held the main run until the user answered, and the instruction to put every
unbacked choice to the user as a question before the main run. All of its findings are advisory,
and none of them holds up a run.

## What the sense check now reads

The implementer's sense check keeps its two questions about the mechanism a request changes, its
abort on a failed check and its handling of a silent record. Before the first edit it now also
reads the spec against the code and the private directive record, checking the spec's claims
against the code instead of only reading them, and it looks for the three classes the removed
review looked for:

- `joint-impossibility`: two requirements that each hold alone and cannot both hold;
- `missing-contract`: an artifact the spec assumes without saying how it is made;
- `reality-drift`: a recorded fact the code no longer bears out.

It checks as well that each item rests, directly or through its parents, on the user's words said
about this unit. Words about another unit back no item of this spec, and a short answer that crossed
with a newer message answers the earlier message and never approves what the newer message
proposed. An item that cites such words as its authority, or states a decision no words of the
user back, is of class `unbacked-item`.

The implementer returns each finding in `specFindings`, a field its output schema requires, one
entry per finding with the ids of every spec item it concerns in `items`, a list of at least one
id, the `class`, the `claim` and `receipts` with at least one receipt. A `joint-impossibility`
entry names each item of the conflict. The class is an enum of the four names above. No finding
fails the sense check, sets the abort or asks the user. The design document on the items the
implementer leaves unbuilt describes which findings block the run, and which items the implementer
builds when a finding does not block it.

## How the findings reach the root

The main script adds every entry of `specFindings` to `remaining` as a `spec-finding` item once the
pass has ended, whatever the ending. An entry of class `unbacked-item` is CRITICAL, and every other
entry is must-fix. The items follow the ones the pass itself added and come before the unfixed
approvals and unattested fixes. When the implementer aborts, its findings still reach `remaining`
beside the abort. When the implement stage fails without ever returning a complete object, there
is nothing to hand over.

The script sets no exit and skips no stage because of a spec finding. Because every spec finding is
must-fix or CRITICAL, a pass that reaches its normal end, with no other exit set before it, and
whose only remaining items are spec findings exits `follow-up`. The implementer returns a
`joint-impossibility` or `missing-contract` entry together with a limitation of effect `blocks`,
and the script's handling of every blocking limitation of the implementer ends that run after the
implement stage with exit `root-resolution`, before any review, so the pass never reaches its
normal end. The design document on the items the implementer leaves unbuilt describes this block.
The finding verifier receives
the findings inside the implementer's object, which the script hands it as a writer object, and
the three code-lens readers see them in the same object they receive as claims.

The skill describes all of this in phase 1, lists `specFindings` among what the implementer
returns, names the spec finding among the kinds of remaining items, and adds the class to the
vocabularies law 9 requires the schemas to lock.

## Only words said about this unit count

The spec-writing skill states the rule beside the transcript source of an item. An item cites only
words the user said about the unit the spec describes. Words about another unit, such as a request
to record a todo for later work or a decision given for a different piece of work, never authorize
an item of the spec, even where their subject overlaps. A short answer that crossed with a newer
message is cited for what its content answers, the earlier message, and never as approval of what
the newer message proposed.

The inverse-spec reviewer's template counts a choice as authorized only by words said about this
unit. A choice whose cited authority is words about another unit or a crossed short answer lacks
authority, and the reviewer reports it as a finding with kind `unbacked-choice`. The finding
verifier's template closes an `unbacked-choice` finding by rejection only on a record entry whose
words were said about this unit, read in their surrounding context. Words about another unit and a
crossed short answer never close one. The skill's paragraph on answering such a finding carries
the same limit. The script's decision check on a rejection is unchanged: it still requires the
record entry id and the quoted words in the authority, and whether those words were said about this
unit is the verifier's judgment.

## Decisions and their reasons

The spec review is removed and its useful checks move into the implementer's sense check. A whole
run before any code existed cost time, and much of what it returned came back as questions to
answer before work could start. The three defect classes and the provenance of each item were the
part of its yield that mattered, and the implementer reads the spec and the code anyway before its
first edit.

The agents of the run report problems with the spec. A spec that passed the tool is launched as
written, and what the implementer finds reaches the root in the same handoff as every other open
item, after the run.

A finding of class `unbacked-item` is CRITICAL, because no words of the user back its items, and
every other class is must-fix.

The script branches on the class to set the severity, so the class is locked in the schema as an
enum, like every other vocabulary the scripts branch on.

The gap-finder and spec-provenance templates are kept as files, because each still has a use of its
own outside the removed run.

The rule on words about another unit and on crossed short answers is stated in the skill that
writes specs and in each stage that judges authority, so the root that writes a spec and the stages
that check it read the same rule.

## Tests

The routing tests check that only the main and fix-run scripts ship, that no skill, template, README
passage or test sends the root to a review of the spec before the main run, and that no script
starts the gap-finder or spec-provenance template while both files remain. They check that the
spec-provenance template calls its findings advisory and has none of them hold up a run. They check
the implementer schema's `specFindings` field with its entry shape and class enum, that an
`unbacked-item` or `reality-drift` finding becomes a `spec-finding` item of its severity while
every stage still runs, and that the findings reach the root beside an implementer abort. They check that spec-writing, the implementer, the
inverse-spec reviewer and the finding verifier templates, and the skill state the rules above. The
tests that ran the removed script are deleted, and the others no longer read it.

## Rejected alternatives

The spec of this change records no rejected alternative.
