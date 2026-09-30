# Review seats are critics, and no stage asks a question

Two stages of implement-review-verify judge review findings: the finding verifier of the main run
and the scope check of a fix run. Both receive the templates of the fifteen review seats as the
reviewers' rules, together with the rule sources. Both templates state that the review seats are
critics without authority whose purpose is to improve code quality, and carry their own rule that a
correction which improves code quality without changing anything the spec specifies needs no words
of the user. A reviewer's rule is quoted as evidence of what such a correction improves and is
never cited as authority. Both templates also carry a removal rule: code, a parameter or a
mechanism that nothing uses, that nobody asked for, or that is built beyond what was asked is a rule
violation, so removing it is corrective and needs no words of the user, while code the user's words
asked for still needs the user's word to go. Every sentence and clause of the agent templates and the two scripts that
had a stage pose, name or recommend a question, ask the user, or send its output to the user as a
question is deleted, so a stage flags issues as facts.

## What the judging stages receive

The main script holds the map of its fifteen review seats, each label with the template it loads.
A prompt block built from that map names the template of every seat under the plugin root of the
marked block. The block says that these templates are the reviewers' rules, what each review seat
looks for, and that the review seats are critics without authority. The finding verifier's prompt
carries that block beside the rule sources it already received.

The fix run's marked block gains a `ruleSources` value like the main script's, filled by the root
at launch. The fix run copies the seat map and the reviewer block from the main script, as it
copies its other helpers, and the scope check's prompt carries the rule sources and the reviewer
block ahead of the fix list. The fixer, the roaster and the diff check of the fix run receive
neither block.

## Corrections that improve code quality

The finding verifier's template states that a correction which improves code quality without
changing anything the spec specifies needs no words of the user. On that rule the verifier decides
such a correction `approve-fix`: the `authority` field names the rule of the verifier's template,
and the `evidence` field quotes the reviewer's rule or the project rule the correction serves. The
reviewer's rule never stands in `authority`. Merging duplicated code into one shared function is
such a correction. A correction that adds or changes behavior still needs the user's words.

The scope check's template states the same rule for a fix run, and the scope check classes such a
correction corrective. A classification has no authority field, so its reason names the rule of the
scope check's template and its receipts quote the reviewer's rule or the project rule the
correction serves, beside the code it improves. A function that only holds merged code is not a
new interface in the scope check's sense, so a deduplication is no longer a new choice. A
correction that adds or changes behavior stays a new choice. The fixer's prompt and the diff check
of the fix run follow the same rule: the fixer's prompt counts a quality correction that keeps the
parent spec as corrective, and neither counts a function that only holds merged code as a new
interface, so a correction the scope check admits is not refused by the next stage.

## Removing code nothing uses or nobody asked for

The finding verifier's template states, beside the quality rule, that code, a parameter or a
mechanism that nothing uses, that nobody asked for, or that is built beyond what was asked is a rule
violation, and that a correction removing it is corrective and needs no words of the user. The
verifier decides such a removal `approve-fix`, even where the removal takes away what the code did.
The `authority` field names the removal rule of the verifier's template, and the `evidence` field
shows that nothing uses the code or that no words of the user asked for it.

The scope check's template states the same rule for a fix run. The scope check classes such a
removal corrective, its reason names the removal rule of the scope check's template, and its
receipts show the code it removes together with the evidence that nothing uses it or that no words
of the user asked for it. The corrective class of the template lists the removal beside the
restoring correction and the quality correction, and the opening of the template names it among
the three things a fix run may do.

In both templates the rule holds also where an item of the spec, or of a fix run's parent spec,
names the code, as long as no words of the user back that item. An item that neither the user's
recorded words, whether a transcript item, approved text or a rule item quoting them, nor an
applicable project rule backs is no authority for keeping the code. Code that the user's words asked
for still needs the user's word to be removed, so the scope check classes its removal a new choice.

Each decision of the finding verifier carries a boolean `removal`. The verifier sets it to true on
an `approve-fix` whose correction removes code on the removal rule, and to false on every other
decision. The main script's decision check refuses `removal` true on any action other than
`approve-fix`. The field is what lets a removal reach the fixer from a finding of kind
`unbacked-choice`: such a finding names a choice that no words of the user back, so removing the
chosen code is exactly the correction the removal rule allows. A decision whose sources include
such a finding may be `needs-decision`, `reject` with a record entry citation, or an `approve-fix`
with `removal` true. The check refuses an `approve-fix` without the mark, which keeps an addition,
a change of the choice or any other approval out, and it still refuses `root-action`, `cleanup`
and `record`. The rule applies to every source of a consolidated decision, so a group that joins
an unbacked choice with a band-aid finding and an ordinary finding reaches the fixer on the same
mark. The script cannot tell from the mark whether the removed code was asked for by the user's
words. The verifier's template and prompt require the verifier's own check of the record before it
sets the mark, and the fixer checks the approval again.

The fixer's template applies approved corrections against the spec as written, apart from an
approved removal of code that no words of the user asked for. It carries out such a removal also
where a spec item without the user's words names the code, because such an item is no authority
for keeping the code, so the removal is no conflict between the prompt and the spec. It returns
the removal of code the user's words asked for rejected with receipts. The authority block both
scripts give their briefed stages states the same exception beside the rule to implement the spec
as written. The main script's fixer prompt tells the fixer to carry out a correction marked
`removal` also against such a spec item and to return a removal of requested code rejected. The fix
run's fixer prompt lists the removal among the corrections the scope check classes corrective,
repeats the exception for code the user's words asked for, and says that a removal on the rule is
not a change of behavior the fixer returns to the root, while a removal of requested code is.

The diff check's template and its prompt map a change that carries out such a removal to the entry
that names it, even where the change takes away what the removed code did. Both also state that a
change removing code the user's words asked for never maps to an entry as such a removal.
implement-review-verify states the rule where it describes the finding verifier's decisions and the
fix run's scope check, states the three answers to an `unbacked-choice` finding, and its rule that
has the root remove such code without asking says that the finding verifier and the scope check
apply the same rule. In the templates and the skill each rule of the removal passages stands in a
bullet of its own.

## Band-aid and longer-route findings

A decision on a finding of kind `band-aid` or `longer-route` stays CRITICAL, has neither `cleanup`
nor `record` available, and reaches the root in `projectBenefitDecisions`. Its `authority` still
quotes the recorded words, or states in plain words that the record says nothing about the
mechanism. `approve-fix` used to be available only for a deletion or rewrite the record describes.
It is now also available for a deletion or rewrite that improves code quality without changing
anything the spec specifies. For that case `authority` also names the verifier's rule on such
corrections, and `evidence` quotes the reviewer's rule or the project rule the correction serves.
`approve-fix` is available as well for a removal on the removal rule, and `authority` then also
names that rule. Keeping the flagged shape still needs the user's word, and the root still closes a standing
decision only by deletion, a rewrite, or the user's word.

## Deleted question wording

- The five briefed reviewer templates, correctness, spec compliance, duplicates, inverse spec and
  project rules, lose the clause that an unbacked choice reaches the user as a question. The
  correctness and spec-compliance templates lose the clause that a choice a removal cannot close
  reaches the user, and the inverse-spec template loses the clause about relaying a choice to the
  user.
- The finding verifier's template loses the exact question and the recommendation of a
  needs-decision decision, the root asking the user about an unsettled inverse-spec choice, the
  open question listed with an approval and a rejection of an inverse-spec finding, the question
  named in `correction` for an unbacked choice and for an item left unbuilt, and the root putting
  that question to the user.
- The fixer's template loses the unresolved question of a blocked disposition. It keeps the
  clause that its rejected and blocked dispositions go to the root and never to the user
  automatically, because that clause forbids asking the user.
- The spec-provenance template loses the root asking the user about a reading. The scope check's
  template loses the user as a destination of a new choice.
- The main script loses the comment above its check of unbacked-choice decisions, and its other
  comments and error messages lose their wording about the user answering a question or being
  asked.

A needs-decision decision now carries no correction. The finding verifier's template says so. The
schema of the verifier's object is unchanged, so a needs-decision decision returns `correction` as
an empty string, and the main script's decision check refuses one whose `correction` holds
anything else. The check still requires a correction for `root-action` and `cleanup`, naming it
the next action.

The older design documents on items left unbuilt, on the project-benefit review and on the work
execution rules follow the same changes. The first describes a needs-decision decision on an item
left unbuilt with an empty correction. The second lists the quality route beside the deletion or
rewrite the record describes. The third says that the reviewer templates it names state that a
reviewer proposes and never decides and that unapproved behavior is removed, and that only
implement-review-verify says which choice reaches the user.

The passages of implement-review-verify that address the root, which talks to the user, keep their
wording. The skill describes the reviewer templates and rule sources both stages receive, the rule
on corrections that improve code quality with a reviewer's rule as evidence, the changed rule for
band-aid and longer-route findings, and a needs-decision decision without a correction.

## Decisions and their reasons

The judging stages receive the templates because a finding only makes sense against the rule that
produced it. The scope check used to see only the fix list, the parent run and the commits, so a
duplicate reported under a rule it never read looked like a matter of taste and was refused.

The review seats are critics because their findings propose changes and decide none. A change that
leaves everything the spec specifies as it was improves the code within what the user already
asked for, so it needs no new words. The permission comes from a rule of the judging stage's own
template: a reviewer that could cite its own rule as authority would approve its own findings, so
its rule only shows what the correction improves. Behavior is what the user decides, so a
correction that adds or changes behavior still needs the user's words.

Removing code that nothing uses, that nobody asked for or that is overbuilt needs no words of the
user, because that code never had them to be built, and code that should not exist needs none to
go. The root already removed such code without asking. The judging stages used to lack the rule,
so they held such a removal to the words of the user as a change of behavior and returned it to the
root. A spec item that no words of the user back gives no authority for keeping the code, because
writing a spec supplies no decision. Code that the user's words asked for got those words to be
built, so its removal needs the user's word as well.

The question wording is deleted instead of reworded, because a stage reports to the root and never
talks to the user. A reworded invitation to ask would keep the same opening, and a stage that
states the facts gives the root what it needs to decide what reaches the user.

The fix run copies the seat map and the reviewer block instead of reading them from the main
script, because each script runs on its own. The routing tests hold both copies equal to the main
script's.

## Tests

The routing tests check that the finding verifier's prompt and the scope check's prompt name the
template of every review seat after the reviewers' rules line, and carry the rule sources; that the
fix run's marked block holds `ruleSources`; and that the seat map, the reviewer block and the rule
sources block of the fix run equal the main script's. They check that both templates and
implement-review-verify state the rule on corrections that improve code quality, that a reviewer's
rule is evidence and is never cited as authority, and the changed rule for band-aid and
longer-route findings. They check that no agent template and neither script contains the deleted
wording. They check that a needs-decision decision with an empty correction is accepted, that one
with a correction is refused before it reaches the remaining items, and that a root-action
decision without a correction is refused. They check that the finding verifier's, the scope
check's and the diff check's templates, the fix run's fixer and diff prompts and
implement-review-verify state the removal rule, the rule's reach over a spec item without the
user's words, and the exception for code the user's words asked for, and that each rule of those
passages opens a bullet of its own. They check that the fixer's template and both fixer prompts
carry out an approved removal against a spec item without the user's words and return the removal
of requested code. They check that a removal of an unbacked choice marked `removal` reaches the
fixer, alone and in a consolidated group with a band-aid finding and an ordinary finding, that an
`approve-fix` on an unbacked choice without the mark is refused, and that the mark on another
action is refused.

The plugin version rises from 0.31.0 to 0.32.0, and the removal rule raises it to 0.33.0.

## Rejected alternatives

The spec of this change records no rejected alternative.
