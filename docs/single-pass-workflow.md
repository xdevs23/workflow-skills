# One pass, then a follow-up workflow

## Required result

A run of the implement-review-verify workflow is one pass: implement, review, verify, one fix
pass with its roast, and then the run ends. Whatever the pass leaves open is returned as a
structured list of remaining items, the run's single handoff. The root records that list in
the project's work record and fixes what must be fixed in a follow-up implement-review-verify
workflow whose spec the root writes from that list and whose prompts are new. The skeleton has
no loop. This builds on [finding verification](workflow-finding-verification.md) and
[structured stage output](structured-stage-output.md).

## Decisions

1. **One pass.** The stages run once, in order: implement; the eight review seats in parallel;
   the finding verifier; the fix pass and the roaster concurrently. A stage that aborts, raises
   a `blocks` limitation or fails its checks ends the run after itself. Since version 0.16.0 a
   review seat's or the verifier's `blocks` limitation is recorded instead and the run ends
   after the fix pass, so approved fixes are applied; since version 0.20.0 a review seat's
   limitation reaches the root only through the verifier. Every ending, including every
   implement-stage ending, returns the structured run record; no stage ends
   the run as a rejected promise. The fix pass and the roaster are joined with settlement
   (`Promise.allSettled`): a valid result from either is kept when the other fails or aborts,
   both are represented in `remaining`, and when both end the run the fixer's cause names the
   `detail` and the roaster's cause is an item.
2. **Source identity and labels.** The script assigns source IDs by seat and finding index,
   `<seat>:<index>`, with `roaster` as the roaster's seat name. Stage labels carry no round:
   `review:<seat>`, `verify`, `fix`, `roast`.
3. **The run record.** The return value carries `exit`, an enum of exactly `clean` (the pass
   completed and `remaining` holds no entry of severity `must-fix` or `CRITICAL` and no
   unattested fix), `follow-up` (the pass completed and `remaining` holds such an entry),
   `root-resolution` (the run ended before completing: a verifier issue, an open decision, a
   writer-scope violation, a blocking limitation, a fixer disagreement or a failed proof),
   `aborted` (a hard flag) and `failed` (a protocol or stage failure); `detail`, one sentence
   naming the cause; `remaining`, decision 4; `decisions`, `inverseSpecDecisions`,
   `projectBenefitDecisions`, `cleanup` and `counts` as today, built from the one
   verification; `proof` (the fixer's checks and files when a fix pass ran, else the
   implementer's), `baseSha`, `snapshotSha` and `acceptance` as today. A pass has completed
   when the verifier returned, the fix pass and the roaster both settled without ending the
   run, and the proof passed. When several causes end the run, the first one processed sets
   `exit` and `detail`, and every cause is an item in `remaining`. `proof` and `snapshotSha`
   follow a fixer object only when it passed the writer checks; a fixer object that failed them
   is the item of its `stage-failure` entry, an aborting one the item of its `abort` entry, and
   `proof` is then the implementer's. The keys an aborting fixer reported `fixed` were committed,
   so they return as unattested fixes carrying that fixer's commits. The fields `complete`, `exceptions`, `unverified`,
   `treeUnreviewed`, `unverifiedRoasts`, `roastComplete` and `rounds` are removed.
4. **Remaining items.** `remaining` is an array of `{ kind, severity, item }`, one entry per
   item, where `kind` is an enum of:
   * `open-decision`: a `needs-decision` or `root-action` decision; severity `CRITICAL`;
   * `verifier-issue`: a report-level issue of the verifier; severity `CRITICAL`;
   * `writer-scope`: a `writerScope` entry with `ok` or `filesMatch` false; `CRITICAL`;
   * `blocking-limitation`: a `blocks` limitation with its stage label; `CRITICAL`;
   * `unfixed-approval`: an approved correction the fixer rejected or blocked, or that no fix
     pass reached because the run ended first; `CRITICAL`;
   * `failed-proof`: a writer's `checks` when its `proofPassed` is false, the implementer's or
     the fixer's, with the writer's label; `CRITICAL`;
   * `roast-finding`: every roaster finding, with the roast's snapshot SHA; the finding's own
     severity;
   * `roast-limitation`: every roaster limitation of effect `narrows` and every roaster
     coverage entry with `checked` false, since no verifier of this run reads the roast;
     severity `should-fix`; a roaster limitation of effect `blocks` is a
     `blocking-limitation` only;
   * `unattested-fix`: every key the fixer reported `fixed`, with the disposition, the fix
     pass's `snapshotSha` and its `commits`; the approved correction's severity;
   * `abort`: the aborting stage's whole object with its label; `CRITICAL`;
   * `stage-failure`: a protocol or stage failure with its message; `CRITICAL`.
   `item` is the object the entry came from, with the label where one is named.
5. **Removed machinery.** The skeleton loses the round loop, the fix budget, the multi-round
   history, the read cache, the pending-fix list, the closure verdicts, the roast bookkeeping
   (`pendingRoasts`, `verifiedRoasts`, `roastRuns`, `roastComplete`), the `treeUnreviewed`
   state and the `exceptions` list. The `VERIFY` schema loses `closures`; the verifier's
   completeness check loses the closure checks; the verifier prompt loses the prior decisions,
   the pending fixes, the roast-receipt sentences and the pending-fix attestation sentence.
   Exactly one verifier runs per run. The roaster's object is not handed to any verifier of
   this run; its findings and limitations return in `remaining`.
6. **After the run.** The skill's root section states: the root records every remaining item
   in the project's work record (an untracked `TODO.md` in this repository's convention; a
   project without one records the items wherever it tracks work). Remaining items are claims
   until the root has read them: the root checks each `roast-finding` and `roast-limitation`
   against the tree, and attests each `unattested-fix` by reading its commits against the
   approved correction and running the checks itself. A confirmed item of severity `must-fix`
   or `CRITICAL`, an unfixed approval, a failed proof, and an open decision once the user has
   decided it, are fixed in a follow-up implement-review-verify workflow. The root writes the
   follow-up's spec as it writes any unit spec: one numbered acceptance criterion per item with
   its receipts, the settled decision for a decided item, the previous run's snapshot as the
   base, and the count of those criteria as `criteriaCount`; the follow-up's cold spec review
   and every other stage apply to it unchanged. A follow-up never reuses the previous run's
   prompts or run ID. A disproved item is recorded with its counterevidence; a `nit` or a
   `record` stays recorded. A follow-up's review may raise new items, which are new entries;
   each follow-up's list is the previous pass's list. The root never reports a fix as verified
   on the fixer's claim.
7. **Resuming.** Law 5 applies to an interrupted run only: a run stopped mid-flight is
   resumed through the resume-interrupted-run skill with its unfinished stages re-run; a
   completed run is never resumed to run more stages. The law and the resume corollaries
   section are rewritten to say that, and the cache-busting rules for re-running a review
   round are removed with the round.
8. **Prose and templates.** The section on the review-verify-fix loop is replaced by a section
   on the one pass and the follow-up; the paragraph on post-write exits retaining unverified
   state is replaced by the remaining-items paragraph; the phase 4 sentences that send the
   roast to the next verification say the findings return in `remaining`; every other
   sentence of the skill that names a round, a budget, a closure or pending fixes is
   rewritten to the one pass. The finding-verifier template loses its pending-fix and
   closure bullet and its prior-dispositions rule; the roaster template says its findings
   and limitations return to the root as remaining items; the fixer template's sentence on an
   earlier round names the follow-up instead.
9. **Sibling designs.** The sentences of `docs/workflow-finding-verification.md`,
   `docs/structured-stage-output.md`, `docs/coder-sense-check-and-project-benefit.md` and
   `docs/directive-authority.md` that described repeated review, the fix budget, closure
   verdicts, persisted history, the exceptions list or unverified state are retracted in place
   by the root on this unit's branch.

## Rejected alternatives

* **A targeted verification round after a fix pass.** A loop in another costume: the same
  cached-prompt problems and the same open-ended run length.
* **A fix budget counting rounds.** It hides the convergence decision in a number; the root
  sees the number was spent, not why. A visible list of remaining items is the decision.
* **Verifying the roast inside the run.** A second verification is the loop's first step. The
  root reads the roast against the tree, and the follow-up's review judges the fixed tree.
* **Roast findings as acceptance criteria of the follow-up without the root's check.** The
  follow-up's implementer would build against an unverified claim before any verifier saw it.
* **Resuming a completed run with bumped prompts.** A poisoned result is cached with its
  prompt, and every stage after a bumped one re-runs anyway; a new run with new prompts costs
  the same and carries no stale state.
* **Keeping `exceptions` beside `remaining`.** Two overlapping handoffs for one run; the abort
  and failure kinds make `remaining` the single one.

## Boundaries

The unit changes the implement-review-verify skill, the finding-verifier, roaster and fixer
templates, the routing tests, this document, the four sibling designs of decision 9 and the
plugin version. The shared authority constant is named `AUTHORITY` wherever this unit rewrites
a line that uses it, every sentence that names the constant uses that name, and the two lines of
the resume-interrupted-run skill that build prompts from it follow; every other sentence keeps
its wording, and the wording sweep of the words pin, pins and pinned stays with a later unit.
The unit is a net deletion: the loop, its prose, the resume corollaries, the closure contract
and the multi-round tests go.

## Acceptance criteria

1. The skeleton declares no round loop, budget, history, read cache, pending list, closure
   verdict, roast bookkeeping or exceptions list; the `VERIFY` schema has no `closures`; the
   verifier prompt carries no prior decisions or pending fixes; the verifier is called once.
2. Every stage ending returns the run record with `exit` from the enum of decision 3 and a
   `detail`; an implementer with failing checks returns the record with exit
   `root-resolution` and a `failed-proof` item, and one with a blocking limitation returns it
   with a `blocking-limitation` item.
3. `remaining` is built as decision 4 states, one entry per item, with the kinds and
   severities named there, including the fix pass and roaster settlement of decision 1.
4. Source IDs are `<seat>:<index>` and stage labels carry no round.
5. The skill prose satisfies decisions 6, 7 and 8; the root section frames the work record
   generally and names the root's check of remaining items and the follow-up rule.
6. The three templates satisfy decision 8.
7. `tests/workflow-routing.test.js`: the multi-round tests are removed; the single-round tests
   are converted, their assertions on removed fields replaced by assertions on `exit` and
   `remaining`, and keep passing; new tests cover each `exit` value, the composition of
   `remaining` for each kind, roast findings and limitations returning in `remaining` without
   reaching a verifier, an implementer's failed proof returning the record, exactly one
   verifier call per run, a fixer failure with a settled roast and a roaster failure with a
   settled fixer each preserving the peer. `bun test tests/` passes.
8. The plugin version is 0.8.6, and `docs/workflow-finding-verification.md` carries no
   sentence on rounds, a fix budget, closure verdicts or unverified state. Existing behavior
   is preserved: seat input boundaries, source coverage, the verifier's guards, the roaster's
   Git-object rule, writer commit rules, the structured stage output contracts, the pre-phase
   as its own run and the size gate.
