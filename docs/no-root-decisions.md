# The root makes no decisions

The orchestrating session of the implement-review-verify workflow decides nothing about a unit's
code or product. The user decides what genuinely needs a decision: a product decision, a change of
the product's scope or of what the user sees and does. Every other choice is made by the stage that
writes the code, with the user's words, the rules and the plugin's skills as its guide.

## What the orchestrating session does

The orchestrating session assembles the unit spec from the user's words, launches runs, attests the
fixes a main run's fixer reports, records what a run returns, and passes a run's result to its
follow-up run. It puts no decision of its own into a spec, and it reads no finding, open decision or
roast finding to sort, check or decide it. A problem reaches the user only as a stage stated it: the
implementer's sense-check flag or an entry the follow-up run's implementer returned unresolved. The
session shows it as the stage wrote it, with no option, question or recommendation of its own.

## How findings are handled

What a run returns to be fixed goes, as its result holds it, to one follow-up run. The run returns
it in its `toFix` list: every spec finding of the implementer, every decision of the finding
verifier, cleanup decisions included, apart from an approved correction its fixer rejected, or
reported fixed with a commit, that decides neither an inverse-spec finding nor a kind-bearing one,
every unresolved issue of the verifier, every finding of the reviewers in a run without a verifier,
such as a review pass, every finding of the roaster and every failed proof. The session passes the
`spec`, `toFix`, `artifacts` and `snapshots` fields of the result to the follow-up run unchanged.
Nobody adds, removes or edits an entry, and nothing is attached to one, so no reading of the
orchestrating session steers the fix. The script refuses a field of another shape, a source of an
unknown kind or one named twice, and the spec check of the follow-up run fails when the spec changed
since the parent run checked it.

A size breach of the unit is measured after the run. The orchestrating session passes its
measurement, the implementation lines added and the repositories measured, as `args.size`, and the
script adds it as an entry of its own beside the spec lines the parent run's spec check counted. The
implementer checks the measurement against the tree like every other entry.

The follow-up run's implementer receives every entry and the parent unit's spec. It resolves each
entry with the user's words, the rule sources and the engineering-principles and code-writing skills
as its guide. Before it answers anything but `fixed`, it looks for every applicable rule and skill
that says what to do or authorizes the change. A rule or a skill that calls for ripping code out
authorizes the rewrite, and the rewritten code does the same thing in the same way as the code it
replaces. It answers an entry `unresolved` only when no rule, skill or word of the user resolves it,
and states the problem as it is: what the problem is, why it is a problem, and why nothing the
user's words, the rules and the skills say solves it. Whether to keep a known defect, to break a
rule because the existing code is already bad, to update many places instead of fixing the one place
they should all read from, to tolerate input without a technical reason, to revert an improvement or
to reopen approved work is never such a problem.

A rejection with counterevidence and a fix with a commit behind it close an entry, once the finding
verifier has read the follow-up's change. A rejection stays in the run's dispositions and adds no
remaining item. An entry answered `unresolved` returns as an `unresolved-entry` item with its
problem statement, and every other entry returns as an `unfixed-entry` item. Only a result the
follow-up run accepted answers an entry, so a refused or aborted result leaves every entry it
answered open. No run follows a follow-up run: everything it leaves is recorded for later work.

The reviewers and the finding verifier of the follow-up run judge its change. In a follow-up run
with a spec, the inverse-spec reviewer maps every choice of the change to the spec words that authorize it, so a change of the
product's scope or of what the user sees and does that neither the user's words nor a rule calls
for is a finding, whatever the entry asks.

The implementer and the stages that read the parent spec receive the rules that make a spec
invalid, and each stops with `invalid-spec` on an invalid one, as every stage of the main run that
reads a spec does.

## The implementer

The implementer reads the same two skills as its guide. Before its sense check fails, it looks for
every applicable rule and skill. Where the user's words, a rule or a skill call for rebuilding the
code the request would grow, it rebuilds it to the same behavior. Only a product decision none of
them decide fails the check, and the flag reaches the user as the implementer wrote it.

## Decisions

**The root decides nothing.** A root that read the rules itself and wrote its readings into specs
as decisions put its own interpretation of a rule between the user's words and the implementer, and
the review stopped such runs as specs with assistant decisions in them. The stage that writes the
code is the one that applies the rules, and the review checks what it built.

**Findings go to the follow-up run unread.** A finding is a claim, and the follow-up run's
implementer is the stage that checks a claim against the tree. A root that sorted findings or
attached its own pointers biased the fix toward a solution it could only assume.

**Every decision goes to the follow-up run, unless the fixer settled it.** The `toFix` list carries
cleanup decisions as well, and leaves out only an approved correction the main run's fixer
rejected, or reported fixed with a commit, because the fixer is the stage that knows what it left
undone. A decision on an inverse-spec finding goes on even then, because every inverse-spec
decision goes to the follow-up run like every other decision and no completed run closes it on its
own.

**A main run's rejection closes its approval the same way everywhere.** A rejection from a fixer
result the main run accepted adds no `unfixed-approval` item and does not end the run
`root-resolution`; it stays in the `dispositions` the run returns. A run record that treated a
rejection as open while the `toFix` list left it out would ask for a resolution that no stage
gives, so the run record and the `toFix` list follow the one decision. An unresolved correction
ends the run `root-resolution` and goes on, and every decision the accepted fixer answered carries
that answer in `disposition` within the `toFix` list, so the follow-up run's implementer reads the
problem statement of an unresolved correction, or the reason and receipts that fixed or rejected an
inverse-spec or kind-bearing decision, beside the decision.

**A fix reported without a commit closes nothing.** A main run's fixer that reports a key fixed
and commits nothing leaves the approval open: the key returns as an `unfixed-approval` item with
that answer, and its decision goes to the follow-up run with the answer in `disposition`. A fix
claim with no commit behind it gives the root nothing to attest, and a `toFix` list that left its
decision out would leave the correction undone with no stage to take it up. The follow-up run
treats such a claim the same way, as an unproven fix whose entry stays open.

**A rejection closes an entry.** An implementer that disproves a claim with counterevidence has
resolved it. Carrying the claim further would ask another stage to argue the same point again.

**The invalid-spec rule stays, in every stage that reads a spec.** An assistant entry that decides a
product or architecture question no user entry decides still makes a spec invalid. With the root
deciding nothing, the rule stops exactly the decisions the root must not make, and the follow-up
run's stages apply it because they read the parent spec.

**A product change needs the user's words or a rule.** An entry is a claim. A finding that asks for
a new interface element does not authorize one, so the follow-up run's implementer holds such a
change to the user's words and the rules alone, and its inverse-spec reviewer checks it.

**The root still attests fixes.** Reading a fixer's commits and running the checks verifies a claim
and decides nothing.

## Rejected alternatives

**A choice an applicable rule decides counts as decided in the spec.** Reason: rule-based choices are
implementation details the implementer makes; the agents read the rules themselves, and a root that
writes its reading of a rule into the spec as a decision can misread the rule.

**A stage before the writer sorts the entries into those the rules settle and those that need the
user.** Reason: resolving the findings and checking whether a problem is real is the writer's job,
so the follow-up run's implementer sorts and resolves every entry itself.
