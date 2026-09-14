# Structured output for every implement-review-verify stage

## Required result

Every stage of the implement-review-verify workflow returns one structured object and nothing
else. The object carries everything the stage owes: verdicts, findings with receipts, coverage,
limitations, checks with their quoted output, Git evidence, decisions, dispositions. No stage
schema declares a free-prose field and every stage schema is closed. The script accepts a stage
on the completeness of its object, never on the length of a text. This builds on
[finding verification](workflow-finding-verification.md) and
[coder sense check](coder-sense-check-and-project-benefit.md).

## Decisions

1. **Shared leaf shapes.** Small shapes used by more than one stage (the five below, a finding,
   coverage, commits, files, a string list) are declared once as constants and reused inside the
   stage schemas; they are field shapes, not a stage schema:
   * `abort`: `{ trigger, reason }`, `trigger` an enum of `none`, `directive-conflict` and
     `sense-check`, required on every briefed stage object (implementer, fixer, finding
     verifier, correctness, cleanliness, spec compliance, duplicate checker, inverse-spec,
     project rule reader). A trigger other than `none` is the hard flag of law 10: the script
     stops the run with the whole object in the exception. The cold seats (quality, cold
     alternatives, roaster, the two pre-phase seats) carry no `abort` field, because its member
     names would brief them; `hasHardFlag` treats an absent field as no abort. The marker string
     and the substring scan over the JSON are removed.
   * `receipt`: `{ file, line, quote }`, a repo-relative path, a 1-based integer line and the
     quoted text at that line. A receipt for an absence (a missing decision, a gap) cites the
     line that makes the promise or the line where the missing thing belongs.
   * `limitation`: `{ what, effect }`, `effect` an enum of `blocks` and `narrows`.
   * `check`: `{ command, passed, output, truncated }`, `output` the quoted output of the bare
     run with a schema `maxLength` of 6000 characters, holding the last 6000 characters when
     the run printed more, in which case `truncated` is true.
   * `git`: `{ head, status }`, the quoted output of `git rev-parse --verify HEAD^{commit}` and
     of `git status --porcelain=v1 --untracked-files=all`; `status` is the empty string on a
     clean tree.
   A finding is `{ file, claim, severity, lane, kind, receipts }` with `receipts` an array of at
   least one receipt; `severity`, `lane` and `kind` keep today's enums and `kind` stays
   optional. Every stage schema sets `additionalProperties: false` at its root.
2. **Nine review seat schemas, each declared in full under its own name.** No shared review
   base composed by spread. Every one of the nine carries `limitations`, `coverage`
   (`[{ what, checked, how }]`, what the seat inspected and how) and `findings`; the six briefed
   seats also carry `abort`. Beyond that:
   * correctness, cleanliness, spec compliance, duplicate checker: `verdicts`, an array of
     `{ criterion, verdict, receipts }` with `criterion` an integer, `verdict` an enum of
     `PASS`, `AT-RISK` and `FAIL`, and at least one receipt on every verdict;
   * inverse-spec: `authorizations`, an array of `{ choice, receipts, authority, class, saving }`
     with `class` an enum of `authorized`, `derivation`, `excess`, `missing-decision` and
     `directive-conflict`;
   * project rule reader: `ruleSources`, an array of `{ path, read }`, and a required `scope` on
     each finding, an enum of `in-change` and `beside`;
   * cold alternatives: `currentShapeRight` (boolean) and `candidates`, at most two
     `{ shape, collapses, cost, invariants }`;
   * quality: the three common fields only;
   * roaster: `snapshotSha`.
3. **Writer schemas.** The implementer returns `abort`, `limitations`, `startSha`, `snapshotSha`,
   `clean`, `proofPassed`, `premises` (`[{ claim, holds, note }]`, every factual claim the prompt
   made about the tree), `senseCheck` (`{ passed, recordSilent, note }`), `commits`
   (`[{ sha, subject }]`), `files` (`[{ path, bytes, change }]`, one entry per path a commit of
   this stage touched, `change` an enum of `added`, `modified` and `deleted`, `bytes` the size at
   the snapshot and 0 for a deleted path), `checks` (an array of `check`), `git` and
   `specSuggestions` (an array of strings). The fixer returns the same without `senseCheck`,
   plus `dispositions` (`[{ key, disposition, reason, receipts }]`, the disposition enum
   unchanged) and `touched`; its `premises` array is where a false prompt premise or a
   prompt-versus-spec conflict is recorded, as the shared authority constant requires of every
   briefed seat. The fixer's per-criterion status is retired: fresh review and
   verification attest the criteria, and no stage consumed that self-report. The deliverable
   proof is `files` together with `checks`; the marker line and the marker search in the retry
   helper are removed.
4. **Finding verifier schema** (`agents/finding-verifier.md`; the verify-loop's `verifier`
   template is not part of this unit). It returns `abort`, `limitations`, `snapshotSha`, `clean`,
   `git`, `checks` (reproductions it ran), `writerScope` (`[{ sha, ok, filesMatch, note }]`, one
   entry per writer commit of the round: the commit inspected against its start, and
   `filesMatch` true when the writer's `files` list equals the paths that commit touched),
   `decisions` (today's fields plus `receipts`), `issues` and `closures` as today, and
   `specSuggestions`.
5. **Pre-phase schemas.** The gap-finder returns `limitations`, `gaps`
   (`[{ category, what, where, why, severity, receipts }]`, severity the enum `must-fix`,
   `should-fix`, `nit`) and `categories` (`[{ name, gaps }]`, every category swept with its
   count). The soundness seat returns `limitations`, `satisfiable` (boolean), `conflicts`
   (`[{ requirements, why }]`) and `criteria` (`[{ criterion, checkable, why }]`). The pre-run
   skeleton passes these schemas and the same `args.criteriaCount`. A schema names field shapes,
   not the spec's content, so both seats stay unbriefed. The gap-finder template names no field:
   it says the caller's schema defines the object, which keeps the find-gaps skill's own schema
   working.
6. **Acceptance in the script.** One helper, `stage(prompt, opts, complete)`, replaces the two
   retry helpers: it calls the agent, returns at once an object whose `abort.trigger` is not
   `none` and whose `reason` is non-empty, retries up to three times on a null result or a
   failed completeness check, and throws after the third attempt with the last failure named.
   `args.criteriaCount` is a required integer of at least 1; the root counts the numbered items
   under the spec's acceptance-criteria heading at the revision it launches, and law 9 keeps
   that revision fixed for the run. The completeness checks:
   * every briefed stage: `abort.reason` non-empty when the trigger is not `none`;
   * verdict seats: exactly one verdict per criterion from 1 to `args.criteriaCount`, every
     verdict with a receipt; a mismatch throws with a message naming the count and the
     criteria returned, so a stale count is visible as the cause; every finding has a receipt
     and a lane;
   * the other readers: every finding has a receipt; `coverage` non-empty; every coverage entry
     with `checked` false is matched by a limitation; the inverse seat has a non-empty
     `authorizations` list; the alternatives seat has a candidate, a finding, or
     `currentShapeRight` true;
   * writers: when `snapshotSha` differs from `startSha`, `commits` and `files` are non-empty
     and some check has `passed` equal to `proofPassed`; when they are equal, `commits` and
     `files` are empty; `git.head` equal to `snapshotSha` and `clean` equal to `git.status`
     being empty; the fixer answers every key once;
   * finding verifier: today's checks, plus `git.head` equal to its `snapshotSha` and one
     `writerScope` entry per writer commit of the round;
   * pre-phase seats: `categories` non-empty and every gap with a receipt; `criteria` with
     exactly one entry per criterion from 1 to `args.criteriaCount`.
   A `blocks` limitation on any accepted stage ends the run after that stage: the script
   appends it to `exceptions` and exits with the reason `stage limitation needs root
   resolution`, in the same way a verifier exception ends a round today.
7. **Templates.** In each of the thirteen templates every sentence that tells the seat to put
   something in its report names the field instead, and each template names every top-level
   field of its schema (the gap-finder excepted, decision 5); the hard-flag sentences of the
   briefed templates say to set `abort.trigger` and `abort.reason`; the writers' proof sentences
   name `files` and `checks`. Each template gains one sentence immediately before its closing
   task-context paragraph: the returned object is the deliverable and carries everything the
   seat owes. The templates say nothing about narration.
8. **Skill prose.** The section on accepting a stage result, the decomposable-deliverables
   section, the schema-versus-plain-text section, law 4, the marker sentences of law 10, the
   vocabulary list of law 11, the hard-flag lines of the shared authority constant and its
   prose section, the phase 1 abort paragraph, the phase 4 fixer paragraph, the phase 2 and
   phase 3 sentences on reports, and the finding verifier's rule to read every report in full
   are rewritten to the fields and the completeness checks. The rule that a finding is a defect
   keeps its meaning: verdicts and coverage go in their own fields.
9. **Handoff between stages.** The three briefed code-lens readers receive the implementer's
   object serialized under the untrusted-claims label, where they receive its report today. The
   finding verifier receives every seat object serialized, the round's writer objects (the
   implementer's in round one, the fixer's after a fix pass) and, as today, the prior decisions
   and pending fixes. The fixer receives the approved list; the roaster receives the approved
   list as today.
10. **Sibling design document.** Every sentence of
    `docs/coder-sense-check-and-project-benefit.md` that describes the hard flag by the marker
    string, and its sentence naming a plugin version number, are retracted in place by the root
    to the abort field and to an unnumbered version bump.

## Rejected alternatives

* **A capped summary string beside the fields.** Any free-text field becomes the place the
  content drifts back into, and the length floor would return with it.
* **Booleans instead of quoted output.** The observed-output rule (law 12) would lose its
  evidence trail; the verifier would have to re-run every command to know what a writer saw.
* **One reader schema with every seat block optional.** Validation would no longer say which
  seat omitted what; each seat's contract validates on its own.
* **One abort field per trigger.** Two fields give one event two dispositions; one enum keeps
  law 10's single disposition.
* **An abort field on the cold seats with only `none` allowed.** A field that can hold one value
  carries nothing, and its enum's member names are the briefing the seats must not receive.
* **A per-criterion status field on the fixer.** Nobody consumed the prose version; the fresh
  review round is the attestation.

## Boundaries

The unit changes the implement-review-verify skill, the thirteen templates it spawns
(implementer, fixer, finding-verifier, roaster, gap-finder, quality, cold-alternatives,
reviewer-correctness, reviewer-cleanliness, reviewer-spec-compliance, duplicate-checker,
reviewer-inverse-spec, project-rule-reader), the routing tests, this document, the two
retracted sentences of the sibling design document (decision 10) and the plugin version. The
find-gaps skill keeps passing its own gap schema and is not edited. The implementation outside
docs is about 800 added lines: nine full seat schemas, the writer, verifier and pre-phase
schemas, the helper and its checks, the prose rewrites, the template sentences and the test
conversion.

## Acceptance criteria

1. No stage schema in the skeleton declares a `report` property; every stage schema root sets
   `additionalProperties: false`; every briefed stage schema requires `abort` and no cold seat
   schema declares it; the enums and required fields match decisions 1 to 5, and the nine
   review seat schemas are nine separate declarations.
2. `hasHardFlag` tests `abort.trigger` and treats an absent field as no abort; the marker string
   appears nowhere in the skeleton, the templates or the skill prose; the exception carries the
   whole aborting object.
3. The deliverable-proof marker and its search are gone; the single `stage` helper implements
   decision 6 in full, including the `args.criteriaCount` requirement, the mismatch message and
   the `blocks` exit.
4. Each of the thirteen templates names every top-level field of its schema (gap-finder
   excepted), carries the added sentence before its closing task-context paragraph, and the
   briefed ones say to set `abort.trigger` and `abort.reason`.
5. The skill prose named in decision 8 describes the fields and the completeness checks.
6. `tests/workflow-routing.test.js`: the existing tests keep passing with their fixtures
   converted to stage objects without a prose field; new tests cover one case per completeness
   check of decision 6 (a missing verdict, a verdict without a receipt, a finding without a
   receipt, a coverage entry unchecked without a limitation, a writer with a commit but no
   files, a writer whose `clean` disagrees with its status output, a `blocks` limitation ending
   the run, a missing `criteriaCount` throwing before any agent runs, a count mismatch naming
   the cause); an abort object returned with its reason preserved in the exception; an abort
   with an empty reason retried and then thrown; a test that no stage schema declares a prose
   field and every root is closed; whitespace-tolerant wording checks for the templates' field
   names and added sentence. `bun test tests/` passes.
7. The plugin version is 0.8.5, and the sibling design document no longer names the marker or a
   version number.
8. Existing behavior is preserved: seat input boundaries, the round loop, source IDs, verifier
   actions and guards, the roaster's Git-object rule, writer commit rules, the pre-phase as its
   own run, the size gate, and the find-gaps skill's use of the gap-finder.
