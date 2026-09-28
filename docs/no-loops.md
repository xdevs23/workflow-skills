# No loops in the workflow skills

The workflow skills give a session no way to repeat a run, a review, a check pass or a spec rewrite
until something comes back clean. Five skills that worked that way are deleted, the items a
finished run leaves are recorded in the todo record, and every rule on writing a unit spec lives in
one skill, spec-writing.

## Five skills are deleted

The immaculate-spec-writing, find-gaps, audit-loop, research-loop and verify-loop skills are
deleted with every file they held. immaculate-spec-writing chained research-loop, find-gaps and
verify-loop and repeated the last two until one pass came back clean on both, with a rough count of
outer passes as its only brake. audit-loop was built to run under a repeating command with no
interval between rounds.

The README, the plugin manifest and the marketplace entry no longer list, name or describe these
skills or their loops. They list spec-writing among the skills, and the README's slash command
examples name spec-writing and implement-review-verify. The README keeps offering the audit-lens
subagents for direct use in one's own workflows. No agent template is deleted.

## spec-writing holds every rule on writing a spec

The description of spec-writing says only that it applies whenever a unit spec or its private
directive record is written or amended. Like the other skills, it opens by requiring the
writing-style skill. It holds the rules on writing a spec that used to stand in
immaculate-spec-writing and in implement-review-verify:

- settling the design first, authority living only in the items, inherited work listed before it is
  built on, the five answers about what the tree already says about the work, and a premise change
  rewriting the entire spec;
- the private directive record: what it holds, its YAML format, approved text counting as the
  user's words, never omitting evidence, and a missing or incomplete record blocking the launch;
- the unit spec: where it lives, its `record` key, the item kinds and the four sources with their
  fields, asserted conditions, hazards and mandating derivations, the width rule, and mandatory
  acceptance criteria with their ordinals;
- validation with the spec tool, where the plugin root is, and the base list.

Where both skills stated the same rule, such as the record format, the authority rule, the
premise-change rule and the criterion ordinals, spec-writing states it once, with the facts only one
of the two carried joined in. Otherwise the moved text keeps its wording. The exceptions are the
pointers to the deleted skills and their loops, which are dropped, the references to the laws of
implement-review-verify, which now name that skill, the sentence on a record changing during a
review cycle, which the section on specs during a run below replaces, and the sentence on what the
technical decision record holds, which names the tracked design document where it said committed
spec, since the YAML spec stays private and untracked.

Two rules in spec-writing say what the root may do to a spec on its own. An edit the root makes on
its own is an ordinary derivation from an existing decision, never a new product, architecture,
persistence, security or operational choice. Those choices, and any point where the spec would
contradict a recorded directive of the user, go to the user instead of being written around. This
is the directive veto immaculate-spec-writing carried in its principles and its gap step, without
the loop around it. A spec is also never reworded so that it gets past its reviewers: a spec that
needs rewrite after rewrite is a sign that something is wrong, and the root takes the conflict to
the user instead of rewriting the spec again.

implement-review-verify keeps what it says about the spec tool as part of its runs. Its section
before phase 1 opens with one sentence: the root writes and validates the unit spec as spec-writing
says before either run starts. The section then states that the commands of the skill use the tool
under the plugin root spec-writing names and that an older installed plugin fails the launch check,
the rule on the tracked design document, when the root and each run's first stage run the tool, and
the counts the root reads for the launch values. The design document rule stands only there.

## A finished run is recorded and never repeated

When a run ends, the root records every remaining item in the todo record, each as its own unit,
and moves on to the next work. The run and its unit are finished: the root never starts a run on
the same spec again, never edits a finished run's spec, and never hands a new run the previous
run's findings as its next round.

A new run starts only for a recorded item that is supposed to be fixed: a confirmed must-fix or
CRITICAL defect in code the unit wrote, an unfixed approval, a failed proof, or an open decision
once the user has decided it. A finding whose fix needs no decision of the user may go to a fix run,
whose fix list names findings of the parent run. Every other such item goes to a new unit with its
own spec. A new run takes as its work the items it was started for, and the findings of its own
review are recorded in the todo record like any other remaining item. Every other item stays in the
todo record as a separate unit, done later. The cleanup entries the rule reader and the finding
verifier hand over are recorded the same way, as separate units.

A run interrupted mid-flight is resumed through resume-interrupted-run. A run that ended any other
way, before or after its review, has its items recorded like every run, and the root never starts a
run on the same spec again.

Law 5 of implement-review-verify, its rationale line on attesting fixes and its resume corollaries
say the same. The rule that a defect moved twice gets its cause fixed stays in the remaining items
section: it counts relocations of one defect, and no skill sets a number of runs after which work
counts as broken. The run record's exit value `follow-up` keeps its name.

## A spec does not change under a run

The root does not edit a spec or its record while a run on it is in flight. The spec review before
the main run is the one run after which the root amends the spec, once, before it launches the main
run on it. A change after the main run started is work for a new unit and never repeats the
finished run's reviews. Law 9 and law 15 of implement-review-verify and the evidence paragraph of
spec-writing say so, in place of the earlier instructions to invalidate and repeat reviews,
approvals and verification after an edit.

An inverse-spec decision is resolved by recording in the todo record that the user's recorded words
back the code's choice, or by asking the user. A code change it needs is a new run under the
remaining items rules. The finding verification phase, the root's question-premise check and law 15
say this, and so do the finding verifier template, which adds that the root never corrects the spec
of the run, and the main workflow script, in its comment on `inverseSpecDecisions` and in the error
it raises when an inverse-spec finding is dispositioned as cleanup. A new run that changes the
code is measured against the 20:1 size check on its own candidate, and excess code or missing spec
detail found by that check is work for a new run or a new unit.

## Agent templates and the other skills

The finding verifier, fixer, project rule reader and roaster templates change only in the lines
that had the root schedule cleanup promptly, that spoke of a follow-up as the next pass of the same
work, or that had the root correct the spec for an inverse-spec finding. Cleanup is recorded as
separate units, the fixer's claims are attested by the root, and the roaster's findings are checked
against the resulting tree and recorded in the todo record.

resume-interrupted-run no longer describes a re-verification round after a fix pass.
visual-verification tells the session to run a curated scene and look at every image it writes,
counting the scene only when it passes for the right reasons, and says that adopting a harness is
never made part of a product change. No workflow script changes apart from that comment and that
error message, and no reviewer of the main script changes.

## Tests and version

The routing tests read spec-writing for the rules that moved there. They check that the five skill
directories are gone, that no file of the skills, agents, tools or plugin manifest directories and
not the README names a deleted skill, and that spec-writing holds the moved rules, the directive
veto and the rule against rewording a spec past its reviewers. They also check that
implement-review-verify states the remaining items rule and none of the sentences it replaced, that
no agent template schedules cleanup promptly or speaks of a follow-up, that no skill runs anything
until it passes or folds work into other work, and that the README and both manifests list
spec-writing and describe no loop.

The plugin version stays 0.27.0.

## Decisions and their reasons

- The five skills are deleted. immaculate-spec-writing repeated find-gaps and verify-loop until one
  pass came back clean on both, and audit-loop is not in use. research-loop and verify-loop are
  deleted with them.
- Every spec rule lives in spec-writing, because rules split across a workflow skill and a loop
  skill were stated twice and loaded only with a skill that did more than write a spec.
- The description of spec-writing names only when it applies, because a description explains when
  to load a skill and the body explains what is inside.
- A finished run's items are recorded and the root moves on, because a run repeated on the same
  spec, or a new run fed the previous run's findings, turns one unit into an open-ended cycle. Each
  new run has its own reason in the todo record.
- A spec stays fixed while a run on it is in flight, because an edit during a run is what made
  reviews and approvals stale and asked for them to be repeated.
- No number of runs is set as a limit, because the relocation rule already points to an untouched
  cause by counting how often one defect moved.
- The word fold, for merging one piece of work into another, is replaced by plain words, because it
  was compressed jargon that hid what happened.

## Rejected alternatives

- Keeping research-loop and verify-loop, started only when the user invokes them through a setting
  in each skill, was rejected. Both skills are deleted instead.
- Moving the spec format of immaculate-spec-writing into implement-review-verify, next to its unit
  spec section, was rejected. Every rule on writing a spec belongs in one skill of its own,
  spec-writing.
- Keeping audit-loop, started only when the user invokes it and running one round per invocation,
  was rejected. audit-loop is deleted, since it is not in use.
