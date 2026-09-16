# Coder sense check and project-benefit review

## Required result

Two additions to the implement-review-verify workflow, its agent templates and its tests.
This document builds on [directive authority](directive-authority.md) and
[finding verification](workflow-finding-verification.md).

1. **Coders check that the request makes sense before writing.** A coder that finds it does
   not make sense hard-flags and says why. The unit continues only on the user's verbatim
   decision, quoted in the private directive record.
2. **Every review seat judges whether the diff helps the project, not only whether it is
   correct.** Band-aids, workarounds and longer routes are CRITICAL findings that reach the
   root, which cannot close them by patching.

## Decisions

1. **Implementer sense check.** Before any edit, the implementer reads the private directive
   record and the spec and asks two questions: does any recorded decision rule out the mechanism
   the request changes, or describe the system in a shape that mechanism contradicts; and does
   growing that mechanism serve the project, or would the request stack new behavior onto a
   mechanism the record has already ruled out. A record that says nothing about the mechanism
   rules nothing out: the check passes and the report notes the silence. Where the record
   permits it, the coder removes the code and rebuilds it to the spec instead of growing it.
2. **A failed check hard-flags.** The stage returns its abort field with the `sense-check`
   trigger and the reason: the mechanism, the recorded decision it contradicts, and why
   extending it is the wrong shape (the field is defined in
   [structured stage output](structured-stage-output.md)). Timing and disposition are those of
   the existing directive-contradiction trigger:
   before any edit the tree stays unmodified; after edits landed, further writes stop and the
   coder reports the edits as they stand, committing nothing and reverting nothing. The unit
   continues only on the user's verbatim decision quoted in the private record; the root
   chooses the continuation from the coder's report and that decision.
3. **Fixer bounded check.** The fixer checks each approved correction before its first write:
   a correction that is itself a band-aid on a mechanism the record does not call for, where
   the record describes deletion or a rewrite, hard-flags with the reason and leaves the
   disputed mechanism untouched. The fixer does not repeat the request-level check; reviewers
   and the verifier have already judged the finished code.
4. **Two triggers, one abort field, one disposition.** Law 10, the phase 1 abort paragraph and
   the shared authority constant in the skeleton state two triggers (directive contradiction,
   coder sense-check failure), the single abort field and the single disposition. The second trigger
   belongs to the writing seats; a reading seat that makes the same observation reports it as a
   kind-bearing finding, never as a flag.
5. **What every seat judges.** The nine review seats (correctness, cleanliness, spec
   compliance, duplicate checker, inverse-spec, project rule reader, quality, cold
   alternatives, roaster) flag two named kinds, each with severity CRITICAL, scoped to choices
   made in this unit's diff: `band-aid`, a repair of a mechanism the recorded words do not call
   for, a compensation layer around an earlier choice, or a workaround that leaves the
   underlying mechanism in place; and `longer-route`, a longer implementation where the recorded
   words already describe a simpler one. Briefed seats quote the recorded words beside the
   finding. Cold seats (quality, cold alternatives, roaster) keep their input boundaries, flag by
   shape and attach no quotes. The rule reader reports a pre-existing band-aid beside the diff
   without a kind, so the cleanup lane stays available for it.
6. **Enum-locked kind.** The `REPORT` and `ROAST` finding schemas gain an optional `kind` enum of
   exactly `band-aid` and `longer-route`. The skeleton sets severity CRITICAL on a kind-bearing
   source finding that arrives with any other severity or none, logging the seat and kind; it
   throws on a decision whose sources carry a kind when the severity is not CRITICAL, the action
   is `cleanup` or `record`, or `authority` is empty; and it returns `projectBenefitDecisions`,
   a flat list of such decisions, each with its kind-bearing source
   findings (id, seat, kind, file, claim), built the way `inverseSpecDecisions` is.
7. **Verification.** A decision on a kind-bearing finding is CRITICAL; `authority` quotes the
   recorded words on every action, supplied by the verifier for a finding of the quality or
   cold-alternatives seat, and where the record holds no words about the mechanism it states
   that silence in plain words instead; a roaster finding of either kind reaches the root as a
   remaining item of the run, and the root checks it against the tree and the recorded words;
   `approve-fix` only for the deletion or rewrite the record describes, so a silent record never
   yields one; `reject` only with counterevidence against the finding itself; every such
   decision reaches the root.
8. **Closure at the root.** The root closes a standing project-benefit decision only by
   deletion, a rewrite, or the user's verbatim word to keep the shape, quoted in the private
   record. A decision the verifier rejected with counterevidence closes at the root once the
   root has checked the counterevidence against the tree and the record and recorded it.

## Rejected alternatives

* **A separate abort field for the sense check.** The script checks consumed results for one
  abort field; a second field needs a second check that erodes, or goes unnoticed.
* **A `blocked` disposition instead of a fixer hard flag.** It returns one key as an ordinary
  disagreement and lets the other approved corrections land on a mechanism the fixer has just
  judged should not exist.
* **Giving cold seats the directive record so they can quote it.** Unbriefedness is what makes
  those seats useful; the verifier supplies the quote for their findings.
* **A prose prefix in the claim instead of an enum field.** Law 11: the script branches only on
  enum-locked vocabulary.

## Boundaries

The unit changes the implement-review-verify skill, the nine seat templates, the implementer,
fixer and finding-verifier templates, this document, one cross-reference line in each of the
two related design documents, the routing tests and the plugin version. The implementation
outside this document is about 350 added lines. How a unit continues after a flag is decided
by the root at the time, from the coder's report and the user's recorded decision.

## Acceptance criteria

1. The implementer template and the skill's phase 1 state decisions 1 and 2, and the three
   existing non-trigger cases stay non-triggers.
2. Law 10, the phase 1 abort paragraph, the shared authority constant and the implementer
   template state decision 4; no text still calls the directive contradiction the only trigger.
3. The fixer template and the skill's phase 4 state decision 3.
4. Each of the nine seat templates and the skill's phase 2 state decision 5.
5. The skill's schemas, skeleton and return value implement decision 6.
6. The finding-verifier template and the skill's phase 3 state decision 7; the skill's root
   section states decision 8.
7. `tests/workflow-routing.test.js` covers: the `kind` enum; the intake coercion and the three
   decision throws through the executable skeleton; `projectBenefitDecisions` with its source
   findings; an implementer abort with a sense-check reason aborting before review with the
   object preserved in the remaining items; a fixer abort in a valid `FIX` object aborting the run
   with the structured result preserved; whitespace-tolerant wording checks for the seat
   bullets, the coder bullets and law 10. `bun test tests/` passes.
8. The plugin version is bumped, and each of the two related design documents carries one
   cross-reference line to this document.
9. Existing behavior is preserved: inverse-spec handling, unbriefed input boundaries, scoped
   writer commits, immutable snapshots, concurrent roasting, source coverage checks, the
   cleanup lane and the root acceptance checks.
