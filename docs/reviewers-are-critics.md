# Review seats are critics, and no stage asks a question

Two stages of implement-review-verify judge review findings: the finding verifier of the main run
and the scope check of a fix run. Both receive the templates of the fifteen review seats as the
reviewers' rules, together with the rule sources. Both templates state that the review seats are
critics without authority whose purpose is to improve code quality, and carry their own rule that a
correction which improves code quality without changing anything the spec specifies needs no words
of the user. A reviewer's rule is quoted as evidence of what such a correction improves and is
never cited as authority. Every sentence and clause of the agent templates and the two scripts that
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
correction that adds or changes behavior stays a new choice.

## Band-aid and longer-route findings

A decision on a finding of kind `band-aid` or `longer-route` stays CRITICAL, has neither `cleanup`
nor `record` available, and reaches the root in `projectBenefitDecisions`. Its `authority` still
quotes the recorded words, or states in plain words that the record says nothing about the
mechanism. `approve-fix` used to be available only for a deletion or rewrite the record describes.
It is now also available for a deletion or rewrite that improves code quality without changing
anything the spec specifies. For that case `authority` also names the verifier's rule on such
corrections, and `evidence` quotes the reviewer's rule or the project rule the correction serves.
Keeping the flagged shape still needs the user's word, and the root still closes a standing
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
- The fixer's template loses the unresolved question of a blocked disposition and the clause that
  its rejected and blocked dispositions never go to the user automatically.
- The spec-provenance template loses the root asking the user about a reading. The scope check's
  template loses the user as a destination of a new choice.
- The main script's comments and error messages lose their wording about the user answering a
  question or being asked.

A needs-decision decision now carries no correction. The finding verifier's template says so, and
the main script's decision check requires a correction for `root-action` and `cleanup` only,
naming it the next action. The schema of the verifier's object is unchanged, so a needs-decision
decision returns `correction` as an empty string.

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
wording, and that a needs-decision decision with an empty correction is accepted while a
root-action decision without one is refused.

The plugin version rises from 0.31.0 to 0.32.0.

## Rejected alternatives

The spec of this change records no rejected alternative.
