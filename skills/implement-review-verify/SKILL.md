---
name: implement-review-verify
description: Implements code changes involving shared infrastructure or subtle invariants, or changes requested through a workflow with reviewers.
---

# Implement → Review → Verify → Fix — a workflow for code changes

A reusable, project-agnostic shape for landing a non-trivial CODE change with confidence. It is
the code-implementation counterpart to the document-oriented loops (`verify-loop`, `find-gaps`,
`research-loop`): those prove a spec; this *builds* against a settled design and adversarially
checks the result before it is accepted. Scoped commits provide immutable review snapshots, not approval to merge or push.

The orchestrator runs it as a `Workflow()` (deterministic fan-out/sequence). The phases are
fixed; the breadth inside each scales to the change.

## Execution context — orchestrator versus stage

**The orchestrator owns the process.** Skill selection/loading, workflow construction, stage
launches, barriers, retries and final completion checks are orchestrator responsibilities.
An instruction to use this workflow does not require each stage to launch another copy.

**A stage owns only its assignment.** Implement, review, verify or fix as assigned, then return
its result to the enclosing workflow. Never launch workflows or subagents, invoke another
process indirectly through a skill or shell command, or repeat the pre-phase. The enclosing
workflow owns the remaining stages; their checks are not already passed just because it exists.

Load a matching skill for instructions when required and available, but apply only the
stage-relevant instructions. Orchestration sections address the caller. Before launch, the
orchestrator supplies any required stage instructions that the stage cannot load, respecting
its input boundaries: execution hygiene is appropriate for unbriefed seats, design briefing
is not. Do not grant extra tools or broaden a reader's source access merely to load a skill.
If required stage instructions remain inaccessible, report that specific limitation rather
than pretending they were read.

Missing Workflow, Agent or Skill tools alone are not an authority contradiction or a reason
to stop a fully briefed stage. Missing capabilities needed for the actual assignment, missing
authorization, or genuinely contradictory applicable requirements still block the affected
work and must be reported honestly. This role boundary does not override higher-priority
instructions. Scope inherited project/global workflow mandates to orchestrators at their
source; a child prompt is not a workaround for an explicitly conflicting instruction.

Include the stage boundary in every prompt, including template-less cold spec review and the
Git-object-only roaster. Keep orchestration tools unavailable to stages; loading instructions
is not permission to recursively execute the process they describe.

## When to use it

Reach for this when at least one is true:
- the change touches **shared infrastructure** other code depends on (a queue, an executor, a
  base class, a wire format);
- it carries **subtle invariants** — ordering, idempotency, concurrency, dedup, a "complete only
  after X lands" guarantee — where a plausible-looking implementation can be quietly wrong;
- the user explicitly asked for "a workflow" / "with reviewers" / a thorough pass.

Do NOT use it for one-off mechanical edits, a rename, or pure research — the overhead (multiple
agents reading the codebase) isn't worth it. For those, just do the edit, or use a single agent.

## Before phase 1 — settle the design AND pin acceptance criteria

**Settle the design first.** The implementer builds against a decided design; it does not invent
scope. If the design isn't settled, stop and settle it with the user (or run a design/research
loop) first.

**ACCEPTANCE CRITERIA ARE MANDATORY.** Before you launch, state them explicitly — numbered,
checkable, one per behaviour that must hold — and make sure the spec doc carries them too.
The concern reviewers return verdicts *per criterion*; the additional seats retain their distinct contracts. Without pinned
criteria, "review" degrades to vibes, each seat invents its own bar, and nothing the fixer
receives can be triaged against anything. No criteria, no launch.

### Pre-phase — cold spec review (2 unbriefed seats, BEFORE any implementation)

Since a settled spec is already the precondition for launching, review the SPEC before reviewing
the code. Two seats, from **DIFFERENT model families**, each given only *"review the spec at
`<path>`"* plus repo access and the run's **hygiene floor** (git safety, where scratch goes, run
checks bare, no background waits, and that no seat edits an authority document) — **no briefing, no
framing, no orchestrator summary**, because the
absence of briefing is what makes them see what the author stopped seeing. The hygiene floor is not a
briefing: it says nothing about the spec, the review taxonomy or what the author meant. The main run's
shared `PINS` block is *not* handed to these seats, because its authority tiers and findings contract
are exactly that framing:

- a **gap-finder** (`agentType:'gap-finder'`) — what the spec fails to say: unhandled cases,
  undefined behaviour, assumptions stated nowhere. Its usual scope fence comes from the artifact
  itself here: **the spec's own stated scope is the fence**, taken from the doc rather than handed
  over by you, which is what keeps the seat unbriefed;
- a **soundness reviewer** — a plain unbriefed strong seat on the other family, asked whether the
  spec's requirements are mutually satisfiable and whether each acceptance criterion is actually
  checkable as written. This seat is deliberately **template-less**: any fixed role prompt would be
  a briefing.

**These seats must PROBE, not just read.** Most of the yield comes from rendering, recomputing,
fetching and measuring the spec's claims against reality — a read-only adversarial pass catches
roughly a **third** of what a probing pass catches. Say so in both prompts, and name the artifacts
they may exercise. A duty to probe is **not** a briefing and does not break the rule above: it says
nothing about what the spec contains or what the author meant. Rank the three yield factors honestly,
because the ranking decides what you protect when you trim:
1. **Unbriefedness matters most.** A briefing smuggles in the author's frame; an unbriefed seat reads
   what the spec SAYS — which is exactly what the implementing agents will read.
2. **Empirical duty second.** A seat told to verify against the artifact finds what no amount of
   careful reading finds.
3. **Vendor diversity third** — cheap insurance that mainly widens *minor*-finding coverage, with one
   specific exception that earns it: it catches the orchestrator glossing the same ruling two
   contradictory ways.

Typical yield is around **three blockers per spec**, of exactly the class that is catastrophic to
discover mid-implementation. Name the three classes in the prompts, because naming them makes them
findable:
1. **JOINT IMPOSSIBILITY** — two constraints, each satisfiable alone, unsatisfiable together.
   Authors check constraints pairwise; nobody checks the conjunction. This class is found by
   **COMPUTATION**, not by reading.
2. **MISSING PRODUCTION CONTRACT** — the spec assumes an artifact exists without saying how it is
   produced, sized, or kept in sync.
3. **REALITY DRIFT** — the world moved under a recorded assumption.

Discovered here they cost an edit; discovered in phase 4 they cost the run.

Their output is **advisory to the orchestrator**, who triages it against the recorded rulings and
amends the spec. Amend the SPEC DOC — never patch the finding into a prompt, or the spec and the
prompts immediately disagree.

**Run the pre-phase as its OWN short run, and let it end there.** A running script cannot pause
while a person edits a document, so a pre-phase bolted onto the front of the main script launches
the implementer against the *unamended* spec and the whole yield is advisory to nobody. Two runs:
one that returns the two cold seats, then the triage-and-amend, then the main workflow against the
amended doc — which the seats below read from disk (law 9), so no prompt needs rewriting.

**Spec discipline: trivial work gets no spec, and *having* a spec is exactly what makes the two cold
seats worth it.** Do not manufacture a spec to justify the seats, and do not skip the seats when a
spec exists.

**Anti-re-litigation needs a technical decision record and a PRIVATE source record.**
The committed spec records decisions, constraints and rejected alternatives with their reasons,
never conversational quotations. Treat user messages as confidential: verbatim directives may
be kept only in untracked, ignored artifacts unless committing them is explicitly authorized.
Point authority-aware seats at that private record to verify fidelity without copying it into
tracked docs, tests, code or commit messages. A broad commit instruction does not authorize
including private records. Keep workflow scripts containing private text untracked too.

The root builds that private record from the actual conversation: the directives themselves plus
the qualifications, surrounding context and examples that give them meaning, each with its source
and order so later statements can be told from earlier ones. Label a summary or an applicable
project requirement as such — neither substitutes for available verbatim evidence, and neither is
relabeled as a human quotation. Never selectively omit, truncate or rewrite the original evidence to
make a spec or implementation pass; only a later, actual human decision may supersede an earlier one,
and only with its provenance recorded — an assistant's own spec edit never does. The record is fixed
for the duration of a review cycle; a new directive invalidates the reviews and approvals it affects.
A necessary part of the record being unavailable or incomplete is an explicit limitation that blocks
acceptance — it is never license to fall back on trusting the spec.

## The shape

Four phases: **Implement → Review → Verify → Fix** — after the cold spec review above.
Cold alternatives joins Review. The mandatory roaster overlaps Fix on the pre-fix commit plus approved fix list; its findings join the next Verify pass against the resulting snapshot.

### Phase 1 — Implement (1 agent, sequential — `agentType:'implementer'`)

ONE implementer (`agents/implementer.md`), working sequentially on the real tree. One agent — not a fan-out — because a
coupled change mutates shared files and parallel writers collide. Multi-implementer fan-out on a
coupled change is **explicitly rejected**: it produced file collisions and consistency drift.
Parallel implementers are allowed only across genuinely disjoint trees/repos — and even then the
reviews can be one barrier covering both. Brief it with:
- **what is already on disk** (if part of the work exists), file by file, told to REUSE it; where the
  record permits the rebuild, the sense check below governs instead;
- the **settled design** and its decisions, stated as authoritative, plus the acceptance criteria;
- the **invariants** in plain language (the ordering rule, the idempotency rule, …);
- a **self-check**: run the relevant test subset before reporting done, and FIX what it added that fails.

**Sense check before any edit.** The implementer reads the private directive record and the spec
and asks two questions: does any recorded decision rule out the mechanism the request changes, or
describe the system in a shape that mechanism contradicts; and does growing that mechanism serve
the project, or would the request stack new behavior onto a mechanism the record has already ruled
out? A record that says nothing about the mechanism rules nothing out: the check passes and
`senseCheck.recordSilent` records the silence. Where the record permits it, the implementer removes
the code and rebuilds it to the spec instead of growing it. A failed check sets `abort.trigger` to
`sense-check` with the reason in `abort.reason`: the mechanism, the recorded decision it
contradicts, why extending it is the wrong shape.

**Prompt scrutiny / abort — two triggers, one abort field.** The implementer also checks the prompt
against the spec and the code *before* editing. The abort has exactly two triggers: **a human
verbatim directive directly contradicted by either authority document or by this prompt** —
directive-versus-spec and directive-versus-prompt are the same trigger — and **a failed sense
check** as defined above. The AUTHORITY DOCUMENTS are the human's verbatim directives and the
spec; the prompt is UNTRUSTED relative to the spec (law 8), but that ranking does not exempt the
prompt from the directive ranked above both. Then everything else falls out:
- **prompt vs spec, with no directive on either side** → an ordinary MUST-FIX finding, not an
  abort. The prompt loses, the seat proceeds against the spec, and it reports the conflict rather
  than silently picking a side;
- **the prompt asserts a plainly false premise about the tree** ("module X already exists") →
  **VERIFIED-AND-REPORTED**. Every factual claim the prompt makes about the tree is CHECKED against
  the tree before anything is built on it; a false one is not merely disregarded but *corrected* —
  build to the TRUE state of the tree, and flag the premise as a must-fix. That beats both
  stopping and trusting, and it is what "untrusted" is supposed to buy. It is recorded in
  `premises` (claim, holds, note). It is not a contradiction with a directive, so it must not set
  the abort;
- **a tree that does not yet satisfy the spec** → the NORMAL starting condition. Treating it as a
  contradiction deadlocks the run (law 10).

None of those three sets the abort. Only a contradiction with a human directive on at least one
side (`abort.trigger` `directive-conflict`), or a failed sense check (`sense-check`), sets a trigger
other than `none`, with the reason in `abort.reason`. Caught before any edit, it stops with the tree
UNMODIFIED; caught after some edits already landed, it stops further writes that would extend the
conflict or the flagged mechanism and returns the existing changes as they stand in `files` and
`commits`, committing nothing and without reverting them. Two triggers, one field, one disposition
— an abort class with no trigger of its own is undetectable, and a trigger with more than one
disposition deadlocks. The second trigger belongs to the writing seats: a reading seat reports the
same observation as a `band-aid` or `longer-route` finding (phase 2), never as a flag.
After a sense-check flag the unit continues only on the human's verbatim decision quoted in the
private record; the root chooses the continuation from the coder's object and that decision. Same
rule for scope: touch only what the task needs, and flag anything beyond the ruled scope as an
invention rather than building it.

It commits only its own scoped changes after checks, then returns `files` (every path a commit of
the stage touched, with its byte size at the snapshot), `checks` (each bare run with its quoted
output), `commits`, the full immutable snapshot SHA, `clean` and `git` (the quoted HEAD and
status). A failed check or commit is an incomplete stage, never a fabricated successful snapshot.

#### Writer commits are snapshots, not integration permission

Start each writer in a clean isolated worktree at the supplied full SHA. Before edits, inspect
HEAD, the index and working-tree status; unrelated or pre-existing changes are an anomaly,
not permission to absorb or discard them. Only the implementer and fixer may stage explicit
paths for their own scoped changes, inspect the staged diff, and create NEW commits after
checks. No broad add, amend, reset, rebase, merge, cherry-pick, branch switching, history
rewriting or push. Honor project commit-message rules and normal hooks/signing. If hooks
change content, rerun proof on the final committed contents before claiming success.

Return `startSha`, full `snapshotSha`, `clean`, `git` (the quoted output of
`git rev-parse --verify HEAD^{commit}` and `git status --porcelain=v1 --untracked-files=all`),
`commits`, `files` and `checks`. The script accepts a writer only when the quoted `git.head`
equals `snapshotSha`, `clean` agrees with an empty `git.status`, a new snapshot lists commits and
files with a check whose `passed` equals `proofPassed`, and an unchanged snapshot lists none.
Scratch and local TODO.md remain ignored and untracked; clean status is not permission to commit
them. Genuine no-ops reuse their starting SHA without an empty commit. Readers and the verifier
independently
check snapshots; a writer's own object is not proof by itself.

All other seats remain Git-read-only. The root pins the starting commit as `args.baseSha`;
use full object IDs, not HEAD or moving branch names, as review identity. Immutable commits
avoid an extra checkout, archive or copy. Acceptance and integration still happen separately.

### Phase 2 — Review (N agents, parallel VERDICT seats, split BY CONCERN)

Independent reviewers, run in parallel, each owning a DISTINCT lens, each via its own `agentType`.
This phase is a **genuine barrier** — the finding verifier needs every selected reader before consolidation. The
standing seats:
- **Correctness** (`agents/reviewer-correctness.md`) — bugs, races, broken invariants, the failure
  modes the change introduces. Name the hazards in the prompt: "check the guard semantics around X"
  beats "find bugs". Tell it to say plainly "I found nothing" rather than invent issues. This seat
  also owns **ASSERTION GRANULARITY** (law 16): it READS the assertions and checks that each
  invariant is pinned at the granularity the rule binds at, never aggregated over the artifact —
  a class the gate structurally cannot catch, because the aggregate assertion is green.
  When the work must PRESERVE AN INVENTORY — every fact, row, entry or capability carried from a
  source into a new artifact — this seat also owns **TRUNCATION-WITH-ELLIPSIS**: under content
  pressure the characteristic failure is to COMPRESS, truncating an entry with an ellipsis,
  collapsing a list, or folding content behind a disclosure device, and the result still reads as
  complete and well-formed. The check is an explicit **inventory diff against the source, item by
  item**, treating any collapse or truncation device as a FAILURE rather than a formatting choice.
  It is a seat check for the same reason as the one above: it needs a reader holding both artifacts
  side by side, and nothing a gate can run goes red.
- **Separation of concerns / cleanliness** (`agents/reviewer-cleanliness.md`) — does logic sit in
  the right layer? Did a special-case leak into shared/generic code? Dead code left by the rework?
  Naming — including a **PLAIN-LANGUAGE lens**: identifiers and prose in plain words, no coined
  metaphor vocabulary, because a coined vocabulary makes the work unreadable to the person who owns
  the thing it describes. (NOT bugs — that's the other seat's job.)
- **Spec compliance** (`agents/reviewer-spec-compliance.md`) — checks explicit requirements
  FORWARD into the implementation: missing or incorrect required behaviour. The spec, not the
  orchestrator's description, is its reference. It receives NO implementer object. Inverse-spec
  owns the reverse authorization map, excess scope and decisions missing from the spec.
- **Duplicate checker** (`agents/duplicate-checker.md`) — "one decision path, recorded once": second
  enforcement sites, parallel decision paths, truth re-derived or re-recorded twice, logic copied
  instead of shared. Cheap, narrow, and catches a class nothing else does.

**A seat earns its place by having a DISTINCT FAILURE-DETECTION MODE, not by adding redundancy.**
Three identical reviewers are worth less than three different lenses. Add a fifth lens (security,
performance) only when the change actually has that surface.

**Concern-reviewer output: per-criterion verdicts, never bare lists.** These seats return
`verdicts`, exactly one entry per criterion from 1 to `args.criteriaCount`, each
**PASS / AT-RISK / FAIL** with at least one receipt (file, line, quote), plus `findings` rated
**must-fix / should-fix / nit**. A bare findings list lets a reviewer hedge; a verdict is a claim
someone can refute. Receipts are the only currency that survives triage.

**Only the three code-lens verdict seats receive the implementer's object as UNTRUSTED CLAIMS.**
The code-lens seats (correctness, cleanliness, duplication) get it serialized, explicitly as a
list of CLAIMS TO VERIFY against the actual tree, never as a source they may review by reading:
holding the claim in hand is what lets a seat catch a claim that is false, which it cannot do if
it never saw the claim.
**The SPEC-COMPLIANCE seat does not receive it at all.** The seat that judges the code against the
AUTHORITY DOCUMENT must not be handed the implementer's account of what it did — its whole job is
the spec versus the tree, and an account of the work is precisely the framing that makes a missing
requirement look answered. One briefed verifier plus one cold judge beats both all-briefed and
all-cold. This rule governs WHICH INPUT a seat gets. The cold-every-round rule in phase 4 governs
CROSS-ROUND state and applies to every seat here, including this one.

**And a FINDING IS A DEFECT — nothing else.** Verdict rows go in `verdicts`, what the seat
inspected and how in `coverage`, what it could not check in `limitations`, never in the findings
array, because mixing coverage with defects obscures what actually needs correction. Every source
finding carries a **FILE**, cited **repo-relative**, and a receipt, so verification can trace the
claim to the tree. Concern reviewers suggest **WHO CAN CLOSE IT** using their existing
actionability lanes; the verifier validates those suggestions before dispositioning, and checks
every limitation and unchecked coverage entry.

Every seat object goes to the finding verifier. A lane or severity assigned
by a reviewer does not authorize a fix; only the verifier's checked, consolidated approval does.

### Additional review seats — parallel with the verdict reviewers

- **Quality** (`agents/quality.md`) — a broad, deliberately unbriefed read of the diff and
  touched-file context. No spec, directives, project docs, implementer object, or shared
  authority briefing. Its ignorance is the mechanism; use only the hygiene floor and diff.
- **Inverse-spec** (`agents/reviewer-inverse-spec.md`) — maps the COMPLETE branch diff's
  choices back to exact authorizing words. Owns excess scope, missing spec decisions,
  deletion/simplification proposals and estimated savings. Spec compliance owns the other
  direction: whether explicit requirements are implemented correctly.
- **Project rule reader** (`agents/project-rule-reader.md`) — reads complete changed files
  against applicable project/global rules, including violations beside the diff. Its
  cleanup findings are preserved without expanding this unit's repair scope.
- **Cold alternatives** (`agents/cold-alternatives.md`) — only the diff, surrounding code
  and required invariants, never the implementer's object. Returns `candidates` (at most two
  materially simpler shapes) or `currentShapeRight`.

All selected Review seats are REQUIRED results. Read them against a stable tree and await
ALL of them before verification. The roaster is the explicit exception to this scheduling:
it runs in Fix against immutable Git objects, never against the writer's moving filesystem.
Quality can legitimately return an empty findings list with its coverage. Each seat has its own
schema: the inverse reviewer owes a non-empty `authorizations` map, the rule reader `ruleSources`
and a `scope` on every finding, the alternatives seat a candidate, a finding or
`currentShapeRight` true. Acceptance-criterion verdicts belong to the four concern seats only.

**Every review seat also judges whether the diff HELPS THE PROJECT, not only whether it is
correct.** Two finding kinds, enum-locked as the optional `kind` field of the findings schema, each
CRITICAL, scoped to choices made in this unit's own diff: **`band-aid`** — a repair of a mechanism
the recorded words do not call for, a compensation layer around an earlier choice, or a workaround
that leaves the underlying mechanism in place — and **`longer-route`** — a longer implementation
where the recorded words already describe a simpler one. Briefed seats quote the recorded words
beside the finding. Cold seats (quality, cold alternatives, the roaster) keep their input
boundaries, flag by shape and attach no quotes; the verifier supplies the words. The rule reader
reports a pre-existing band-aid beside the diff without a kind, so the cleanup lane stays available.

### Phase 3 — Verify and consolidate (1 read-only `agentType:'finding-verifier'`)

The verifier receives every seat object of the current cycle serialized, including quality and
cold alternatives, and the round's writer object (the implementer's in round one, the fixer's
after a fix pass). The initial verification precedes roasting; each concurrent roast is
consumed after its fix pass, before completion or another correction is approved. It checks
claims against the code, settled spec, applicable rules and recorded instructions, resolves
conflicts using evidence, and merges duplicate defects into ONE fix list, every decision with
receipts. It preserves every source ID: consolidation is never permission to drop a finding.
It also checks every seat's limitations and unchecked coverage entries, inspects each writer
commit of the round in `writerScope` (`filesMatch` when the writer's `files` equal the paths the
commit touched), returns its own `git` and `checks`, and independently verifies prior fix claims.

This is ordinary workflow work, not a root checkpoint. The root is an exception handler.
A verifier is neither a rubber stamp nor a new source of design authority. Corrections
already authorized by the record can proceed regardless of which seat found them; a new
necessary choice cannot proceed merely because a reviewer or verifier prefers it.

**One explicit decision per consolidated group:**
- **approve-fix** — verified defect and already-authorized correction. Supply evidence,
  authority references with EXACT QUOTES, the correction, constraints and an acceptance check.
- **reject** — false positive or unsupported objection, with concrete counterevidence.
  Duplicates are MERGED with all source IDs, not silently rejected or discarded.
- **needs-decision** — a choice without which the assigned work cannot satisfy the existing
  requirements. Establish the impossibility, name the question and alternatives; return to the root.
- **root-action** — a demonstrated impossibility or required investigation the verifier cannot
  complete. A proposed spec edit alone is not a blocker: implement and review the spec as written,
  retaining non-blocking suggestions in `specSuggestions` or as `record`, not as prerequisites.
- **cleanup** — verified work outside this unit's repair scope, with concrete cleanup
  entries and receipts retained for the root's end-of-run handoff.
- **record** — genuinely non-blocking observations, retained in the ledger. Never use it
  to dispose of a confirmed must-fix or CRITICAL violation.

Every inverse-spec source finding carries CRITICAL severity unconditionally, regardless of the
label it arrived with (law 15): `record` and `cleanup` are never available for one — an inverse-spec
finding is about a choice made IN this unit's own diff, never work outside its repair scope — and
`reject` still needs concrete counterevidence against the finding itself, never against an edited spec.

A decision on a kind-bearing finding (`band-aid` / `longer-route`) is CRITICAL the same way, and
`cleanup` and `record` are never available for it. Its `authority` quotes the recorded words on
EVERY action, not only `approve-fix`, supplied by the verifier for a cold seat's finding. Where
the record holds no words about the mechanism, `authority` states that silence in plain words,
and `approve-fix` is unavailable because the record describes no deletion or rewrite.
`approve-fix` only for the deletion or rewrite the record describes; `reject` only with
counterevidence against the finding itself. Every such decision reaches the root in
`projectBenefitDecisions`.

Reviewer lanes and severity are claims to verify, not queue permissions. Every source ID
must belong to exactly one decision group. The SCRIPT checks coverage, unknown IDs, duplicate
IDs and approval payloads before mutation. A missing seat object or an invalid handoff stops the
run, and a `blocks` limitation on any accepted stage ends it after that stage with the exit
`stage limitation needs root resolution`; missing evidence is never an implicit rejection or a
clean empty queue.

Only approvals enter the fixer list. Unsettled necessary decisions, required root actions
and unresolved `issues` and blocking `limitations` prevent fixing, including otherwise approved work
in that unit. Routine rejections and successful consolidation remain in the workflow record
and final summary; they do not interrupt the root one by one. Every decision on an inverse-spec
source finding, however it resolves, stays visible to the root in that summary: an `approve-fix`
or a well-evidenced `reject` does not need to interrupt the cycle, but the root still owes each one
an explicit resolution — correcting the spec to state an existing decision faithfully, or asking
the human about a genuinely unsettled one — and neither a later spec edit nor a completed run
closes it on its own.

### Phase 4 — Fix and roast concurrently

Launch ONE fixer and ONE mandatory roaster together after the approved list is finalized.
Capture the pre-fix SHA before starting either. The roaster receives the immutable base and
snapshot SHAs plus the approved list, using its Bash-only Git-object prompt. It reads files
with `git show SHA:path`, lists with `git ls-tree`, searches with `git grep` at that SHA,
and compares with `git diff --no-ext-diff --no-textconv BASE_SHA SNAPSHOT_SHA --`.
No source-tree Read/Grep/Glob, filesystem scripts, builds, symlink following or external diff
helpers. It never substitutes HEAD. Receipts include the snapshot SHA and file:line.

The fix list is PLANNED WORK, not proof. The roast should avoid repeating assigned defects,
but may flag inadequate corrections, interactions and uncovered weaknesses. Both tasks
must settle before the next verification or before control returns on failure. The roaster
cannot be dropped, including when the approved list is empty and the fixer runs proof only.
A missing, failed or wrong-snapshot roast leaves the run incomplete.

The fixer receives ONLY the consolidated approved list, with its source IDs, evidence,
authority and boundaries. Raw seat objects are not extra work orders. It:
- independently rechecks each approved correction before acting;
- runs its bounded sense check on every approved correction before its first write: a correction
  that is itself a band-aid on a mechanism the recorded words do not call for, where the record
  describes deletion or a rewrite, sets `abort.trigger` to `sense-check` with the reason in
  `abort.reason` and leaves the disputed mechanism untouched, with the implementer's timing and
  disposition (phase 1). The fixer does not repeat the request-level sense check; reviewers and
  the verifier have judged the finished code;
- returns exactly one **fixed / rejected / blocked** disposition per approved key in
  `dispositions`, each with a reason and receipts; the script rejects a missing, unknown or
  duplicated key;
- applies the approved outcome within its bounds, never broadening scope or editing a
  spec or other authority document to make the correction legal after the fact;
- returns disagreements with counterevidence to the ROOT, not automatically to the human
  and not to another automatic fix attempt. A blocked mechanism stays untouched;
- runs full checks BARE AFTER ITS LAST WRITE, commits completed scoped corrections, then
  returns the clean snapshot SHA, `git`, `commits`, `files`, `checks` with the quoted output and
  `proofPassed`; fresh review and verification attest the criteria. The next independent pass
  must still verify the commit and any claimed closure.

With an EMPTY approved list the fix pass owes PROOF ONLY and may not edit or create an empty
commit. It returns the original SHA. A failing check is reported for independent triage,
not permission to invent a repair. The concurrent roast is still mandatory and must be
processed by Verify; a green proof alone cannot complete the run.

#### The Review → Verify → Fix loop

**Ordinary detection stays cold.** After a new writer commit, Review uses fresh seats with
their original input boundaries and the new SHA. No findings history or fixer explanations
go to those readers. The roaster is deliberately informed by the current approved fix list;
quality stays unbriefed. On an unchanged proof-only snapshot, reuse the already-journaled
ordinary reviews rather than rerunning them; only the new roast needs verification.
The verifier receives persisted prior decisions and pending fixes as UNTRUSTED context,
because it must reconcile repeats and check closure. No agent relies on private memory.

**Source identity is deterministic, consolidation is semantic.** The script assigns IDs
by round, seat and finding index. The verifier groups the same defect across sources using
code evidence; it never groups merely by file or similarity of prose. Every group preserves
its source IDs. The script uses these IDs for exact coverage checks, not a hand-written
normalizer that tries to decide whether two claims mean the same thing.

**A fix claim is not closure.** After a committed fix, run fresh Review → Verify and include
the preceding roast with its ORIGINAL snapshot receipts and IDs. Verify those claims against
the POST-FIX snapshot; a resolved criticism is a rejection with evidence, not another fix.
The verifier checks
each pending key's acceptance condition against the CURRENT tree and returns **closed /
unresolved**, with evidence, exactly once per pending key. An unresolved attempted fix is
bounded non-convergence and returns to the root. Reviewer silence alone never establishes
closure. A corrected defect may involve a caller or shared implementation rather than the
file the reviewer cited; touched-file bookkeeping is a cross-check, not semantic proof.

**The loop exits** when fresh verification has no further approved work and the current
proof passes; when a necessary decision/root action or fixer disagreement needs resolution;
when a required check fails; or when the code-fix budget is spent and verification still
finds approved work. A final independent read/verification is allowed after the last fix
pass so its roast and closures are never silently omitted. New approved findings may start
another fix pass within that budget. Never turn a rejected or blocked correction into
an endless internal argument. Return each exception with the decisions and evidence that
make it actionable; the root decides whether the human must break the tie.

**Every post-write exit retains explicit unverified state.** Until independent closure,
keep pending fixed keys in `unverified` and `treeUnreviewed: true`. A later review that
confirms some fixes but cannot close another records both facts separately. A budget exit
must not turn the fixer's own claim into a verified result. An empty proof-only run cannot
invalidate the reviewed tree by editing it. Any unprocessed roast is separately reported
in `unverifiedRoasts`, even if the concurrent writer failed or disagreed. A successful
result requires all launched roasts to have been processed.

#### Rule violations and local cleanup records

**Bound review and repair separately.** Ordinary verdict seats review the change and what
it touches. The rule reader reads EVERY changed file IN FULL against the applicable project
and global rules, including violations beside the diff. Cite the code, exact rule and source.
A confirmed rule violation is CRITICAL, never a nit; matching house style or pre-existing
status cannot excuse it. CRITICAL expresses rule compliance, not an assumed level of
operational impact, which is reported separately.

The verifier approves authorized corrections in this unit's repair scope. Unrelated existing
violations become concrete cleanup entries: issue, rule citation, code receipts, source
finding IDs and the required correction. Existing entries are updated rather than duplicated.
The root records this consolidated handoff in the project's `TODO.md` in the SAME RUN, before
reporting the task finished, including when the workflow exits with unresolved work. Schedule
those cleanup units promptly; recording an issue is not fixing it or permission to defer it
indefinitely. Do not force unrelated cleanup into the current fix loop or interrupt the root
for each entry separately. If recording is blocked, report the incomplete handoff explicitly.

**`TODO.md` stays UNTRACKED by default, not merely unstaged.** Creating or updating a local
cleanup record is not permission to version it. Track and commit it only when the user
explicitly requests that. Before writing, inspect any existing file and check its Git tracking
status with `git ls-files --error-unmatch -- TODO.md`. For an untracked file, ensure Git ignores
it; prefer a repo-local `/TODO.md` entry in the exclude file located by
`git rev-parse --git-path info/exclude` unless an existing ignore rule already covers it.
Inspect and preserve that exclude file; do not rewrite tracked `.gitignore` just for this
local default. Never stage or commit TODO content through a broad add/commit operation.

If `TODO.md` is already tracked, do not silently delete it or remove it from the index.
Honor a recorded explicit request to track and commit it; otherwise report the tracking
conflict to the root for direction before writing cleanup entries into it. The read-only
reviewers and verifier never edit TODO files or Git excludes; this handoff belongs to the root.

The enum-locked handoff and executable example below implement this contract. The design
and rejected alternatives are recorded in `docs/workflow-finding-verification.md`.

## Root completion checks — timing, size and project-defined integration

A completed Review/Verify/Fix cycle proves that cycle, not permission to integrate or delete
its worktree. The root performs the checks below before accepting the unit. These are root
responsibilities, not extra workflow seats or a second implementer pre-check.

### Root question-premise check

Before presenting any question, trade-off, limitation or acceptance request to the human, the
root checks its premises first. Identify the proposed question in plain terms, the premise it
rests on, and the exact directive/context reference and any related spec-compliance or
inverse-spec finding it touches. Then check the record against that premise: when it challenges
the premise, investigate the mismatch before asking anything, identify the unsupported scope, and
report a discovered implementation deviation from the requested result plainly — never present the
consequence of an invented mechanism as though it were a new choice the human must make. A choice
the record already settles is never asked again; only a choice it leaves genuinely unresolved is
presented as a decision request. Every entry the run returns in `inverseSpecDecisions` gets this
treatment: the root either corrects the spec to state the existing decision faithfully or, after
this check, asks the human about the part that is genuinely unsettled.

This is a root PROMPT obligation, not a script gate. An executable test can confirm the
instruction above is wired into the root's prompt and that `exceptions`, `inverseSpecDecisions`
and `projectBenefitDecisions` reach the root intact and unretired;
it cannot prove a future model actually performed the conversational premise check correctly.

Every entry in `projectBenefitDecisions` reaches the root whatever its disposition. The root closes
a standing one only by deletion, a rewrite, or the human's verbatim word to keep the shape, quoted
in the private record; a patch that keeps the flagged mechanism is never closure. A decision the
verifier rejected closes at the root once it has checked the counterevidence against the tree and
the record and recorded it.

### Post-run timing review

After every run, including an incomplete run, inspect the actual per-stage durations in the
harness results or journal. Include retries and distinguish executed work from cached replay.
Name the largest time sink and whether it was necessary reasoning/generation, machine waiting,
repeated source discovery, repeated checks, or rework. Parallel durations overlap: do not add
agent elapsed times and call the total workflow wall time. If timing data is unavailable,
report that limitation rather than inventing durations.

Twenty minutes of executed (not cached-replay) elapsed time per agent task is the soft ceiling.
Any agent whose executed duration exceeds 20 minutes automatically triggers this review for
that agent: name its largest time sink and remove the avoidable part at the source. Time spent
on necessary reasoning or generation is acceptable at any length and is not itself a defect;
crossing the ceiling obliges the review, and what gets removed is machine wait and rework.
Soft means no agent is aborted, killed or timed out for crossing it, and no script gate
enforces it. It is a root prompt obligation like the rest of this section.

Remove avoidable cost at its source: reusable prepared artifacts, narrower assignments,
missing task context, or redundant checks. Preserve cold-review input boundaries and required
checks after the last write; do not improve timing by deleting reviewers or trusting stale
proof. Apply improvements within authorized scope and report any broader follow-up.

### Size report and the 20:1 acceptance gate

Measure the final candidate against its unit spec before integration, using immutable inputs:
record the merge-base SHA, candidate SHA, spec path and spec blob ID. Read the spec at that
candidate, not a moving working file. For bundle/patch delivery the comparison base is the
project's declared reconstruction base; do not silently substitute a convenient newer base.

- **Spec lines:** count non-blank lines in the unit spec. This is a line count, not a Markdown
  interpretation; include its technical content, not a private conversation record.
- **Code added/deleted:** sum the added and deleted line counts from
  `git diff --no-ext-diff --no-textconv --no-renames --numstat BASE_SHA CANDIDATE_SHA --`
  over implementation files. Use added lines as the numerator, never net added-minus-deleted.
- **Test added/deleted:** report separately for paths containing `tests/`, `test/`, `.test.`
  or `_test.`. Treat the repository root as a path boundary so root-level test directories count.
- Exclude documentation (`*.md`), lockfiles, generated files and binaries from implementation
  counts. List excluded paths and the reason for each; lockfile/generated classification must
  come from concrete project conventions or Git attributes, not an agent's wish to reduce the
  number. State additional project-specific test/doc patterns explicitly. Keep the same
  classification and rename setting on every measurement; report deleted totals and test totals
  alongside the ratio. Disabling rename detection makes accounting reproducible (a moved file
  counts as delete/add); explain large moves rather than silently changing the measurement.
- **Ratio:** code added / non-blank spec lines, displayed to one decimal. Compare unrounded
  counts: **above 20:1 blocks acceptance/merge**; exactly 20:1 does not breach the size gate.
  The size gate passing is not proof of correctness or permission to skip another check.

The root obtains the counts from Git and the pinned spec, retaining receipts. Use established
libraries/tools for machine-readable Git data, not a hand-written diff or Markdown parser.
Missing measurements or an empty required spec leave acceptance incomplete, never a zero ratio.
For the separate no-spec targeted-patch path, report the ratio as not applicable and the code/test
counts anyway; do not manufacture a spec or reclassify a spec-governed unit to evade the gate.

This arithmetic helper classifies a measured, spec-governed unit; it does not collect counts or
authorize integration. The root supplies the verified counts and handles the result:

```js
const assessSize = ({ specLines, codeAdded }) => {
  if (!Number.isSafeInteger(specLines) || specLines <= 0 ||
      !Number.isSafeInteger(codeAdded) || codeAdded < 0) {
    throw new Error('Verified code counts and a non-empty unit spec are required')
  }
  return {
    specLines, codeAdded, ratio: (codeAdded / specLines).toFixed(1) + ':1',
    status: codeAdded > 20 * specLines ? 'root-review-required' : 'within-limit',
  }
}
```

A breach is first a **root diagnosis**, not an automatic request for permission or a fixer retry.
Read the inverse-spec review and the candidate against the existing requirements. Identify
unnecessary mechanisms, duplication and concrete deletion/simplification savings; also identify
real missing spec detail or a prerequisite foundation. Correct excess code through the normal
approved-fix/review path. Only the root may clarify genuinely missing spec detail, consistent
with existing authority; new scope still needs authorization. Never pad the spec to lower the
ratio, or use a later amendment to retroactively authorize unsupported code. A spec suggestion
alone does not stop the implementation/reviewer cycle; this gate applies to the finished unit.

After any code/spec change, repeat affected verification and measure the new pinned candidate.
If the justified implementation still exceeds 20:1, keep acceptance blocked unless the user
explicitly approves that remaining size. Before asking once, present the ratio, inverse-spec
conclusions, savings already taken or rejected with reasons, real spec gaps and the remaining
size traced to requirements. Keep any verbatim approval private/untracked; record only the
technical disposition in commit-bound artifacts. Approval is specific to the measured candidate
and spec, not a reusable waiver. Do not repeat the request without materially new evidence.

### Integration and worktree cleanup belong to the project

The project chooses its integration/delivery contract: a PR, direct merge, Git bundle, patch
file, or another explicit handoff. Record the chosen route, destination and completion evidence
before integration; if no route is established, leave a verified candidate and report that
integration is pending. Never infer merge/push/network-send permission from snapshot commits.
The size gate applies before accepting the candidate for any route, not only direct merges.
An explicitly requested draft/review artifact may expose an unresolved gate, but must be labeled
unaccepted; producing or sending it does not waive the gate.

Keep temporary worktrees inside an ignored project-local directory, such as `.cache/worktrees/`.
Never delete a worktree merely because the workflow finished. First verify that it is clean,
inspect ignored/untracked contents for material to preserve, and verify the project's handoff:

- **Direct merge:** confirm the candidate commit is contained in the intended target branch.
  For squash/rebase integration, verify the resulting content and the project's recorded mapping.
- **PR:** creating a PR is not proof of merge. Verify the durable source branch/candidate and
  project-selected completion condition; retain the branch while the PR still needs it.
- **Bundle:** verify the bundle with Git, its advertised candidate and prerequisites, and its
  durable destination. If delivery is required, verify receipt too; a local bundle is not proof
  it arrived. A bundle depending on this soon-to-be-deleted checkout is not a durable handoff.
- **Patch:** verify reconstruction from the declared base yields the intended candidate tree,
  including binary/mode/deletion changes where relevant. Verify the durable patch destination
  and any required delivery receipt. A patch left only inside the removed worktree is not saved.

The verification is its **own tool call**, whose successful result the root reads before issuing
any removal in a **separate call**. Never chain checks and deletion with `&&`, use forced removal,
or treat a failed/unknown check as success. Worktree removal does not authorize deleting its
branch or handoff artifacts. If evidence or preservation is incomplete, retain the worktree and
report what remains. Respect the project's deletion authorization in addition to these checks.

## The QUALITY GATE — three different things, and only two of them BLOCK

A gate is not a review seat, and the two words are not interchangeable. Say which of the three a
given check is, because only two of them stop the run:

- **BLOCKING — committed TOOLS invoked as gate steps.** The repo's own check scripts (tests, lint,
  format), plus scans of the same objective kind: a banned-vocabulary scanner, an incoming
  conflict-marker sweep. These are **exit-code gates** — they pass or they fail and nobody
  adjudicates the result.
- **BLOCKING — SCRIPT-LEVEL contract checks.** The orchestrator SCRIPT throws on a protocol
  violation: the stage helper's completeness checks (law 4) in the acceptance section below. These
  stop the run deliberately, and **the decision lives in the script** — never delegated to a
  downstream agent to rediscover, for the same reason the structural abort does not (law 10).
- **RECORDING — SEATS.** Quality and cleanliness emit findings for independent verification,
  not directly into a fix queue. Their judgments are claims, not exit-code gates. A missing
  required report or a verified unresolved decision still prevents the next stage.

**The boundary is the whole taxonomy in one line: MECHANICAL AND OBJECTIVE goes in the GATE as a
TOOL; JUDGMENT goes in the REVIEW as a SEAT.** A gate that only reports is a seat wearing the wrong
name, and a seat that stops the run is a gate — either way the run's exit reason is a lie about
which mechanism decided it.

**THE COMPLETION-CLAIM RULE: a fixer's completion claim is only valid off a BARE RERUN AFTER ITS
LAST WRITE, with the tails quoted VERBATIM.** A claim resting on a run from before the last edit is
not evidence — the edit it is offered as proof of is precisely what that run never saw. And piping a
check through `head` or `grep` is itself an offense rather than a style question, because it hides
the failure the gate exists to surface.

**GATE TOOLS ARE VERSIONED AND MATERIALIZED.** A gate tool lives in a REPOSITORY and is materialized
into every tree the gate runs in (a link or copy placed at tree creation). A tool kept as a loose
file at one workspace root fails not-found in every OTHER tree, and every run then hand-substitutes
it — a failure that is silent in the worst way, because it presents as a broken gate rather than as
a missing tool, so each run debugs the gate instead of installing the tool.

**GATES EXECUTE INSIDE THE FIX PHASE** — the fixer runs them bare after its own last write.
A failing required check returns a failed proof, never permission to invent an unapproved fix.
Do not place checks after the completed workflow and still claim its proof covered them.
Likewise, do not ask reviewers to judge a criterion a later stage has not yet produced.

**THE RECORDING SEATS RIDE AS TEMPLATE CONSTANTS, not as per-script prose.** Anything retyped per
run erodes — audits find the standing quality and cleanliness lenses silently absent from the large
majority of a fleet's scripts, each omission individually reasonable when it was made. A constant
resists that; retyping does not. This is in genuine tension with law 5(a) — editing a shared
constant busts every cache key — and the two coexist by a rule about WHEN, not whether:
**the constant is authored once and then left alone.** When a resume needs one seat re-run,
bump that seat's OWN prompt, never the constant (law 5a stands unchanged). Erosion is the larger
cost, because a busted cache costs one run while a dropped seat costs every run after it.

## Why this shape (the rationale that makes it work)

- **Sequential implement, parallel review.** Implementation has write-conflicts; review is
  read-only and independent — so the parallelism goes in the review phase, not the build.
- **Reviewers split by concern, not by file.** Different lenses find different classes of problem;
  pointing them all at "review everything" wastes them on overlap.
- **Adversarial correctness review is the point.** Brief the correctness reviewer to *try to break*
  the change — name the hazards and ask "is this actually wrong?". That's what catches the
  plausible-but-broken implementation that tests written by the implementer won't.
- **Verification precedes mutation.** One read-only verifier checks and consolidates every
  source; the separate fixer rechecks approved corrections and returns disagreements to the root.
  Fresh review and verification attest the changed tree rather than trusting its author's claim.
- **The biggest wall-clock win is killing redundant stages, not parallelizing bad ones.**

## Laws

Non-negotiable across every run of this skill.

1. **EXPLICIT model AND effort on every stage — never inherited.** Two silent-downgrade paths: a
   custom `agentType` resolving its own default, and a cached resume. Either can quietly land a
   stage on the cheapest tier while the run looks healthy.
2. **Cross-family review.** Prefer a reviewer from a DIFFERENT model family/vendor than the
   implementer. A same-family reviewer shares the author's blind spots and will nod at exactly the
   assumption you needed challenged. (Vendor-neutral rule; pick per the project's own model policy.)
3. **Effort policy.** High for implementation, fixing, and code review. Low/medium for mechanical or
   repetitive stages (list-checking, formatting sweeps). Reserve the top efforts for genuinely hard
   reasoning — they overthink routine work and cost wall-clock for nothing.
4. **FAIL-FAST.** An agent returning null or an incomplete object retries the SAME agent (3 attempts
   total) with the failure named, then the helper throws naming the last failure and no downstream
   stage runs. The main loop records the incomplete run with any pending unverified writes; it
   never treats a failure as an empty review. Completeness is structural: the schema validates
   shapes and enums, and the script checks the cross-field contracts (one verdict per criterion, a
   receipt on every finding and verdict, coverage with a limitation behind every unchecked entry,
   files and checks behind a new snapshot, a reason behind an abort; see the acceptance section).
   The law guards EVERY required reader, including adversaries: the verifier consumes them all.
   A missing object is incomplete verification, never a harmless gap in a finished fix.
5. **Cache-busting on resume.** A resume replays a cached result for an identical (prompt, opts), so
   retrying a POISONED stage verbatim just replays the same bad output. Edit that ONE stage's prompt
   or label to bust its key, and leave every good stage's key untouched so it replays free. Two
   corollaries. **(a) Shared prompt text is a GLOBAL cache-buster:** editing a shared authority block
   on resume busts every key that embeds it, so every already-settled seat re-runs. Bump ONLY the
   seats that must re-run, via a short revision marker prepended to their *individual* prompts —
   never by touching the shared constant. **(b) A poisoned
   result is itself CACHED,** including a hard-flagged one: fixing the underlying cause and resuming
   returns the same bad result unless that seat's prompt is bumped. The fix is always a prompt edit,
   never a re-invoke.
6. **Barrier discipline.** Review readers run concurrently on a stable clean snapshot, then
   Verify consolidates their results. Fix awaits that approval. Only the Git-object-only roaster
   overlaps the fixer, reading the captured pre-fix SHA and approved list. Await both tasks;
   process the roast on the resulting snapshot before completion. These are data dependencies.
7. **Premise drift — read the authority, not a relayed gloss.** Point authority-aware stages at
   the private, ignored/untracked directive record and the current spec path (law 9). Preserve
   exact source wording in that private record, never in commit-bound artifacts without explicit
   permission. Technical specs record decisions and constraints, not conversational appendices.
8. **AUTHORITY ARCHITECTURE — state the hierarchy in authority-aware prompts.** Quality and
   cold spec reviewers receive only their hygiene/diff inputs; cold alternatives gets invariants,
   not the shared authority briefing. For other seats the three tiers are: **owner/human verbatim directives > the spec > this prompt**, with the prompt
   explicitly labelled **UNTRUSTED** relative to both, and *"a prompt-vs-spec conflict is itself a
   must-fix finding"*. **The AUTHORITY DOCUMENTS are the top two tiers only — the directives and the
   spec. The prompt is not one**, which is what makes a prompt-vs-spec conflict an ordinary finding
   rather than the hard flag of law 10 — **but the human veto still reaches the prompt.** A prompt
   that directly contradicts a directive is the same hard-flag class as a spec that does: being
   untrusted RELATIVE TO THE SPEC does not exempt the prompt from the directive ranked above both.
   Anything the orchestrator adds beyond the spec is labelled **"ORCHESTRATOR SCOPING — this added
   scope loses to the spec on conflict"**, which makes it structurally attackable by every seat; the
   spec itself never outranks a directive, including a spec the orchestrator amended. This
   exists because **the orchestrator's own errors are the dominant error class** — a mis-stated
   criterion, a gloss that contradicts another gloss of the same ruling, a "verbatim" appendix that
   isn't, or an assignment overriding a directive it disagrees with — and this hierarchy is the only
   mechanism in the run that catches them. A specification gains no decision authority merely by
   being written, even when the orchestrator wrote it: it can be corrected to state an existing
   directive faithfully, never used to authorize a new one. **Untrusted means
   VERIFIED, not ignored:** every factual claim the prompt makes about the tree is checked against
   the tree, and a FALSE one is **verified-and-reported** — build to the true state, flag the
   premise as a must-fix — which beats both trusting it and stopping on it (law 10).
9. **SPECS ARE LIVING DOCUMENTS, READ FROM DISK.** Every spec-consuming prompt names it by PATH and instructs:
   *"read the current on-disk revision in full; it is the authority, not this prompt's description of
   it."* Never cite a revision number, never restate the spec's content in the prompt. This is what
   prevents drift between a prompt's stale summary and the doc. Do not change authority during
   a review/fix cycle; return for the authority edit and invalidate affected review/approval calls
   before continuing. An amendment cannot make a cached approval current. **Corollary:
   authority documents RETRACT a contradicted sentence in place.** Never append an acknowledgement
   beside a sentence it contradicts: layered addenda manufacture diverging premises, and seats then
   flag the contradiction forever, correctly.
10. **HARD-FLAG SEMANTICS.** A hard flag (agent stops, script aborts) has exactly two triggers.
    The first is a contradiction that puts a human verbatim directive on at least one side —
    **directive-vs-spec, or directive-vs-this-prompt** — two texts that cannot both be true (law
    8). The prompt being UNTRUSTED relative to the spec does not exempt it from the directive
    ranked above both: an assignment overriding a directive is the same conflict class as a spec
    that does, hard-flagged the same way. The second is a **coder sense-check failure**, and it
    belongs to the writing seats: the implementer finds, before any edit, that the request extends
    a mechanism the recorded words rule out, or the fixer finds that an approved correction is
    itself a band-aid where the record describes deletion or a rewrite (phases 1 and 4). A reading
    seat reports the same observation as a kind-bearing finding, never as a flag. Both triggers
    share one disposition: caught before any edit, the tree stays unmodified; caught after edits
    landed, further writes stop and the coder reports the edits as they stand, committing nothing
    and reverting nothing. A tree that does not yet satisfy a coherent spec is the NORMAL
    precondition of review-and-fix and yields ordinary findings; so does an untrusted prompt that
    merely conflicts with the SPEC with no directive on either side, or one asserting a false
    premise about the tree — those are verified-and-reported, built to the truth (law 8), never an
    abort. Getting this wrong deadlocks the run: the fixer that would resolve the finding can never
    run, because the flag aborts before it. **Two triggers, one field, one disposition** — the
    `abort` field's `trigger` enum names both (`directive-conflict`, `sense-check`) beside `none`,
    with the reason in `abort.reason`; an abort class with no trigger of its own is undetectable,
    and a trigger with more than one disposition is the deadlock in another costume. The cold
    seats carry no `abort` field, because its member names would brief them, and an absent field
    is no abort. And the structural abort lives in the **SCRIPT**, which checks **every consumed
    stage result** for a trigger other than `none` and throws with the whole object — never
    delegated to a downstream agent to rediscover. Every required object is consumed by
    verification; a failed or hard-flagged reader stops the cycle before fixing.
11. **ENUM-LOCK ANY VOCABULARY THE SCRIPT BRANCHES ON.** If control flow keys off severity, lock it in
    the output schema as an enum (`must-fix` / `should-fix` / `nit`) with validation-retry — and the
    same for every other vocabulary the loop switches on: the actionability **lane**
    (`fixer-actionable` / `orchestrator-only` / `later-phase` / `not-a-defect`) and the **disposition**
    (`fixed` / `rejected` / `blocked`), verifier action (`approve-fix` / `reject` /
    `needs-decision` / `root-action` / `cleanup` / `record`), closure (`closed` / `unresolved`),
    the project-benefit finding `kind` (`band-aid` / `longer-route`), the abort `trigger`
    (`none` / `directive-conflict` / `sense-check`), the verdict (`PASS` / `AT-RISK` / `FAIL`),
    the limitation `effect` (`blocks` / `narrows`), the authorization `class`, the rule reader's
    finding `scope` (`in-change` / `beside`), the file `change` (`added` / `modified` / `deleted`)
    and the gap severity.
    A seat emitting one word against a check testing for another
    **silently disables the phase and the run reports success** — the worst possible failure mode,
    because it looks like a green run.
12. **GROUNDED MEANS OBSERVED.** Code-reading that concludes "it should work" loses to empirical
    observation every time. Verify against real output: real builds, real requests, real rendered
    results. Mechanical gates **RECOMPUTE from the artifacts**; an item's self-report is only a
    truncation-and-dishonesty detector, never evidence.
13. **END-OF-RUN COMPLETENESS PASS.** Per-item checks structurally CANNOT see a missing item. Every
    fan-out over a work-list ends with one pass whose only question is *"which item is missing
    entirely?"*. Absences are the worst defect class to ship, and they are invisible to exactly the
    checks that look most thorough.
14. **HARNESS TOOLS BEAT PER-AGENT IMPROVISATION.** When several seats each hand-roll the same
    invocation (gate runs, server boots, probe walks), commit a **one-command tool** and put the exact
    invocation in every prompt with hand-rolling **forbidden**. Measured effect: seat turn-counts
    roughly halved. Extra rule for models **without prompt caching**, which re-pay their full input
    every turn: point them at tool DUMPS and keep their exploration short-context, since long ad-hoc
    exploration is disproportionately expensive exactly there.
15. **IMPLEMENT THE SPEC AS WRITTEN; only the ORCHESTRATOR edits it.** A suggested spec change
    does not block implementation, fixing or the normal reviewer cycle. Report the suggestion
    and its evidence to the root without changing the spec or making its amendment a prerequisite.
    Non-blocking suggestions belong in `specSuggestions`, or `record` when dispositioning a
    supplied finding. A preference for different requirements is not an impossibility.
    If the assigned work genuinely cannot satisfy the applicable requirements, report the concrete
    impossibility and block rather than inventing requirements or claiming completion. Contradictions
    between authority documents retain the existing law-10 hard flag; the spec-versus-instructions
    pre-check already exists and does not need another gate. Reviewers retain their usual checks.
    **ONLY THE ORCHESTRATOR MAY EDIT A SPEC OR OTHER AUTHORITY DOCUMENT.** If the root amends one,
    record the technical rationale, retract contradicted text in place (law 9), and invalidate
    affected cached reviews and approvals. Never retroactively authorize unsupported implementation.
    **Every inverse-spec finding is CRITICAL regardless of the severity or lane it arrived with; the
    finding verifier, the fixer and the root all ignore that supplied categorization and must
    dispose of it explicitly — never leave it implicitly closed.** The root resolves it by
    correcting the spec to state an existing human decision faithfully, or by asking the human
    about a genuinely unsettled choice after checking the question's premises against the recorded
    directives. Amending the spec is not itself the closure: the underlying finding is re-checked
    against the original directives on the next round, and the original verbatim directives are
    never erased, rewritten or selectively omitted to make it disappear.
16. **ASSERT AT THE GRANULARITY AT WHICH THE RULE BINDS** — per row, per section, per item — and
    **never aggregated over the whole artifact**. An aggregate assertion lets a fully DEGENERATE
    part pass on the strength of its neighbours: the property holds across the sample while the
    subsection that matters violates it outright. That is why this class **ships defects THROUGH a
    green suite**, and why it belongs to a SEAT that READS the assertions rather than to the gate
    that RUNS them — the gate is green either way, so it cannot be the thing that catches it. When a
    granularity defect is fixed, the assertion is re-pinned at the binding granularity across every
    case the code can produce, with any genuinely unavoidable exception stated in the assertion
    itself rather than left as a silent widening.

## Writing the workflow script

The phase shape only holds up if the script is written to hold it up. These are the mechanics.

### Skeleton — the spec-review pre-run

Its own tiny run, and it ENDS at the return. A script cannot pause while a person edits a document,
so the orchestrator triages this output, amends the spec doc, and only then launches the main run —
which reads the amended doc from disk with no prompt rewritten (law 9).

```js
export const meta = {
  name: 'spec-cold-review',
  description: 'two unbriefed seats read the spec before any code exists',
  phases: [{ title: 'Spec review' }],
}

// HOUSE is the hygiene floor and NOTHING ELSE. The main run's PINS is these same lines PLUS the
// review framing (authority tiers, findings contract, lanes, review surface); the cold seats get
// only this half on purpose, because that framing is a briefing and unbriefedness is this
// pre-phase's highest-yield property. The field shapes and stage() below are the same as in the
// main skeleton: this is its own run, so the definitions are copied in.
// Use this same stage boundary in the main run and any additional seat prompts.
const STAGE = [
  'EXECUTION CONTEXT: you are one assigned stage, not the orchestrator.',
  'Do not launch workflows or subagents, directly or through skills or shell commands.',
  'The enclosing workflow owns scheduling and remaining checks; those checks have NOT already passed.',
  'Load required skills for instructions when available; apply only your assigned stage, not orchestration.',
  'The caller must supply required stage instructions you cannot load, within your input boundaries.',
  'Missing orchestration tools alone do not block an otherwise executable stage or create an authority conflict.',
  'Report genuinely missing assignment capabilities/instructions, authorization or conflicting applicable requirements.',
].join('\n')
const HOUSE = [
  STAGE,
  'GIT: READ-ONLY BY INTENT. You do not change what git records or which commit the tree sits on,',
  'by any means, named here or not. Illustration, NOT the boundary: stash, checkout, reset, restore,',
  'clean, commit, rebase, merge, cherry-pick, branch or worktree switching. ALLOWED: status, diff, log, show.',
  'An enumerated verb list ROTS; the intent governs. A tree MOVING UNDERNEATH YOU is an ANOMALY:',
  'report it verbatim, never work around it.',
  'Scratch files go in the project cache dir, never a global temp.',
  'Run checks BARE. Never pipe through head/grep - it hides the error.',
  'NEVER end a turn waiting on a backgrounded check; your returned object IS the deliverable.',
  'You may NEVER edit the spec or any other authority document: report it, the orchestrator amends it.',
].join('\n')
// Two UNBRIEFED seats, DIFFERENT model families. No abort field and no abortOnFlag here: nothing
// downstream consumes them, the human does — and a contradiction they find IS the deliverable
// (law 10). Both are told to PROBE: reading alone catches about a third of what probing catches.
const PROBE = [
  'PROBE, do not just read: render, recompute, fetch and MEASURE the spec claims against reality.',
  'Concentrate on three blocker classes: JOINT IMPOSSIBILITY (two constraints each satisfiable',
  'alone, unsatisfiable together - found by COMPUTATION, not by reading); MISSING PRODUCTION',
  'CONTRACT (an artifact assumed to exist with no account of how it is produced, sized or kept in',
  'sync); REALITY DRIFT (the world moved under a recorded assumption).',
].join('\n')
// A schema names field shapes, never the spec's content, so both seats stay unbriefed. RECEIPTS,
// LIMITATIONS, hasHardFlag() and stage() are the main skeleton's: this is its own run, so copy
// those definitions in.
const GAPS = { type: 'object', required: ['limitations', 'gaps', 'categories'], additionalProperties: false,
  properties: { limitations: LIMITATIONS,
    gaps: { type: 'array', items: { type: 'object', additionalProperties: false,
      required: ['category', 'what', 'where', 'why', 'severity', 'receipts'],
      properties: { category: { type: 'string' }, what: { type: 'string' }, where: { type: 'string' }, why: { type: 'string' },
        severity: { enum: ['must-fix', 'should-fix', 'nit'] }, receipts: RECEIPTS } } },
    // Every category swept, with its gap count, so "checked, clean" is explicit.
    categories: { type: 'array', items: { type: 'object', required: ['name', 'gaps'], additionalProperties: false,
      properties: { name: { type: 'string' }, gaps: { type: 'integer', minimum: 0 } } } } } }
const SOUNDNESS = { type: 'object', required: ['limitations', 'satisfiable', 'conflicts', 'criteria'], additionalProperties: false,
  properties: { limitations: LIMITATIONS, satisfiable: { type: 'boolean' },
    conflicts: { type: 'array', items: { type: 'object', required: ['requirements', 'why'], additionalProperties: false,
      properties: { requirements: { type: 'array', minItems: 2, items: { type: 'string' } }, why: { type: 'string' } } } },
    criteria: { type: 'array', items: { type: 'object', required: ['criterion', 'checkable', 'why'], additionalProperties: false,
      properties: { criterion: { type: 'integer', minimum: 1 }, checkable: { type: 'boolean' }, why: { type: 'string' } } } } } }
// The same args.criteriaCount as the main run: the count of numbered acceptance criteria.
const criteriaCount = args.criteriaCount
if (!Number.isInteger(criteriaCount) || criteriaCount < 1) {
  throw new Error('args.criteriaCount must be an integer of at least 1: the count of numbered acceptance criteria in the spec')
}
phase('Spec review')
return await Promise.all([
  stage([HOUSE, PROBE, 'Review the spec at docs/<the-spec>.md. You get no other briefing, by design.'].join('\n\n'),
    { label: 'spec:gaps', phase: 'Spec review', agentType: 'gap-finder', model: '<explicit>', effort: 'high', schema: GAPS },
    r => {
      if (!r.categories.length) throw new Error('categories is empty')
      for (const gap of r.gaps) if (!gap.receipts?.length) throw new Error('gap without a receipt: ' + gap.what)
    }),
  stage([HOUSE, PROBE, 'Review the spec at docs/<the-spec>.md: are its requirements mutually satisfiable, and is every acceptance criterion checkable as written?'].join('\n\n'),
    { label: 'spec:soundness', phase: 'Spec review', model: '<explicit, other family>', effort: 'high', schema: SOUNDNESS },
    r => {
      const got = r.criteria.map(c => c.criterion).sort((a, b) => a - b)
      const want = Array.from({ length: criteriaCount }, (_, i) => i + 1)
      if (JSON.stringify(got) !== JSON.stringify(want)) {
        throw new Error('expected exactly one criteria entry per criterion 1..' + criteriaCount +
          ' (args.criteriaCount), got criteria ' + JSON.stringify(got))
      }
    }),
])
```

### Skeleton — the main run

```js
export const meta = {
  name: 'kebab-name',
  description: 'one line',
  phases: [{ title: 'Implement' }, { title: 'Review' }, { title: 'Verify' }, { title: 'Fix' }],
}
// meta must be a PURE LITERAL — no variables, no interpolation. Phase titles here must
// match the phase() calls EXACTLY or the progress grouping silently degrades. Review, Verify and Fix
// are RE-ENTERED once per round; the round rides in the label, never in the title.

const STAGE = [
  'EXECUTION CONTEXT: you are one assigned stage, not the orchestrator.',
  'Do not launch workflows or subagents, directly or through skills or shell commands.',
  'The enclosing workflow owns scheduling and remaining checks; those checks have NOT already passed.',
  'Load required skills for instructions when available; apply only your assigned stage, not orchestration.',
  'The caller must supply required stage instructions you cannot load, within your input boundaries.',
  'Missing orchestration tools alone do not block an otherwise executable stage or create an authority conflict.',
  'Report genuinely missing assignment capabilities/instructions, authorization or conflicting applicable requirements.',
].join('\n')
const PINS = [                    // authority-aware seats only; quality uses HYGIENE below
  STAGE,
  'AUTHORITY: human verbatim directives > the spec at the path below > THIS PROMPT (untrusted).',
  'The AUTHORITY DOCUMENTS are those first two. This prompt is NOT one of them.',
  'Read the CURRENT on-disk revision of the spec in full; it is the authority, not this prompt.',
  'VERIFY every factual claim this prompt makes about the tree, AGAINST THE TREE, before building',
  'on it. A FALSE premise is VERIFIED-AND-REPORTED: build to the TRUE state and flag the premise.',
  'A prompt-vs-spec conflict, and a false premise, are MUST-FIX FINDINGS:',
  'report them and proceed against the spec. Never silently pick one; never stop for them.',
  'HARD-FLAG (set abort.trigger and abort.reason, then stop) has TWO triggers, one abort field, one',
  'disposition. First: a contradiction between authority documents, OR this prompt directly contradicting',
  'a directive - the human veto reaches the prompt too, not only the spec (trigger directive-conflict).',
  'Second, WRITING SEATS ONLY: a failed sense check (trigger sense-check; implementer before any edit,',
  'fixer before its first write, as their templates define). Otherwise abort.trigger is none.',
  'A READING SEAT reports the same observation as a finding with kind band-aid or longer-route.',
  'A tree not yet satisfying the spec is normal: report ordinary findings, never a hard flag.',
  'Scratch files go in the project cache dir, never a global temp.',
  'Run checks BARE. Never pipe through head/grep — it hides the error.',
  'NEVER end a turn waiting on a backgrounded check; your returned object IS the deliverable.',
  'A FINDING IS A DEFECT: verdicts go in verdicts, what you inspected and how in coverage, what you',
  'could not check in limitations (effect blocks or narrows); an unchecked coverage entry needs a',
  'declared limitation. Every finding carries at least one receipt (file, line, quote).',
  'Every finding cites a FILE and names WHO CAN CLOSE IT - the actionability lane, one of:',
  'fixer-actionable / orchestrator-only / later-phase / not-a-defect.',
  'Cite every file as a REPO-RELATIVE path: the loop matches findings to fixes by that path.',
  'Ordinary verdicts cover the change; the rule reader checks full changed files and separates cleanup.',
  'You may NEVER edit a spec or any other AUTHORITY DOCUMENT: report it, the orchestrator edits it,',
  'and only to match an existing decision - a spec gains no decision authority merely by being written.',
  'Implement the spec AS WRITTEN. Suggested spec edits do not block executable work or normal reviews.',
  'Report non-blocking spec suggestions without making them prerequisites; block only on an actual impossibility.',
  'A spec that contradicts a directive is the hard-flag case above, never "implement it as written".',
  'Read the private directive record below for its surrounding context and examples, not just its',
  'lines in isolation - the absence of a particular keyword never licenses behavior that contradicts',
  'the established context, and an example never authorizes an unrelated feature it did not name.',
  'A necessary part of that record being unavailable or incomplete is a root-action limitation:',
  'report it rather than proceeding as if the spec alone were sufficient.',
].join('\n')
const READ_GIT = [
  'GIT READ-ONLY: never stage, commit, reset, amend, rebase, merge or switch branches/worktrees.',
  'The clean worktree and HEAD must stay at the supplied snapshot; report unexpected movement.',
].join('\n')
const WRITE_GIT = [
  'NARROW COMMIT PERMISSION: start clean at START SHA in the isolated worktree.',
  'Stage explicit paths for only your scoped changes, inspect the staged diff, check, and create a new commit.',
  'No broad add, unrelated changes, amend, reset, rebase, merge, branch switching or push.',
  'Never bypass signing or hooks. Follow project commit style. Recheck proof if hooks change content.',
  'Keep ignored scratch and local TODO.md out of commits unless explicitly requested.',
  'Return startSha, full snapshotSha, clean, git (quoted head and status), commits, files and checks;',
  'never an empty commit for a no-op, whose commits and files are empty and whose snapshotSha is startSha.',
  'Check git rev-parse --verify HEAD^{commit} and git status --porcelain=v1 --untracked-files=all after committing.',
].join('\n')
// The spec rides as a PATH. The criteria live IN the doc and ride as a POINTER, never as a
// copy: an embedded copy goes stale the instant the spec is amended, which is the drift law 9
// exists to kill. Private directives also ride as a PATH (law 7), never as inline conversation
// in a commit-bound script. Orchestrator-only additions are labelled for scrutiny (law 8).
const SPEC = [
  'SPEC (authority): docs/<the-spec>.md — read the current on-disk revision in full.',
  'PRIVATE DIRECTIVES: <ignored untracked record path>. Read privately; never copy messages into tracked files.',
  'ORCHESTRATOR SCOPING (this added scope loses to the spec on conflict; the spec itself never',
  'outranks a directive, including one the orchestrator later amended it to match): ...',
].join('\n')

// Field shapes, declared once and reused inside the stage schemas below. They are field shapes,
// not stage schemas: every stage declares its own closed object in full, so validation names the
// seat that omitted a field. No stage schema declares a free-prose field.
const ABORT = { type: 'object', required: ['trigger', 'reason'], additionalProperties: false,
  properties: { trigger: { enum: ['none', 'directive-conflict', 'sense-check'] }, reason: { type: 'string' } } }
const RECEIPT = { type: 'object', required: ['file', 'line', 'quote'], additionalProperties: false,
  properties: { file: { type: 'string' }, line: { type: 'integer', minimum: 1 }, quote: { type: 'string' } } }
const RECEIPTS = { type: 'array', minItems: 1, items: RECEIPT }
const LIMITATIONS = { type: 'array', items: { type: 'object', required: ['what', 'effect'], additionalProperties: false,
  properties: { what: { type: 'string' }, effect: { enum: ['blocks', 'narrows'] } } } }
// output quotes the bare run: the last 6000 characters when it printed more, then truncated is true.
const CHECKS = { type: 'array', items: { type: 'object', additionalProperties: false,
  required: ['command', 'passed', 'output', 'truncated'],
  properties: { command: { type: 'string' }, passed: { type: 'boolean' },
    output: { type: 'string', maxLength: 6000 }, truncated: { type: 'boolean' } } } }
// head and status quote git rev-parse --verify HEAD^{commit} and git status --porcelain=v1
// --untracked-files=all; status is the empty string on a clean tree.
const GIT = { type: 'object', required: ['head', 'status'], additionalProperties: false,
  properties: { head: { type: 'string' }, status: { type: 'string' } } }
// A finding is a defect with at least one receipt. Project-benefit kinds mark a choice made in
// THIS unit's diff; a finding without kind is ordinary, which keeps the cleanup lane open for a
// band-aid that already existed beside it.
const FINDING = { type: 'object', required: ['file', 'claim', 'severity', 'lane', 'receipts'], additionalProperties: false,
  properties: {
    file: { type: 'string' }, claim: { type: 'string' },
    severity: { enum: ['must-fix', 'should-fix', 'nit', 'CRITICAL'] },
    lane: { enum: ['fixer-actionable', 'orchestrator-only', 'later-phase', 'not-a-defect'] },
    kind: { enum: ['band-aid', 'longer-route'] },
    receipts: RECEIPTS,
  } }
const FINDINGS = { type: 'array', items: FINDING }
// What the seat inspected and how; an entry with checked false needs a limitation beside it, and
// the finding verifier judges whether that limitation excuses it.
const COVERAGE = { type: 'array', items: { type: 'object', required: ['what', 'checked', 'how'], additionalProperties: false,
  properties: { what: { type: 'string' }, checked: { type: 'boolean' }, how: { type: 'string' } } } }
const COMMITS = { type: 'array', items: { type: 'object', required: ['sha', 'subject'], additionalProperties: false,
  properties: { sha: { type: 'string' }, subject: { type: 'string' } } } }
// One entry per path a commit of the stage touched; bytes is the size at the snapshot, 0 when deleted.
const FILES = { type: 'array', items: { type: 'object', required: ['path', 'bytes', 'change'], additionalProperties: false,
  properties: { path: { type: 'string' }, bytes: { type: 'integer', minimum: 0 }, change: { enum: ['added', 'modified', 'deleted'] } } } }
const STRINGS = { type: 'array', items: { type: 'string' } }
// Every factual claim the prompt made about the tree, checked against the tree (law 8); a false
// premise or a prompt-versus-spec conflict is recorded here by both writers.
const PREMISES = { type: 'array', items: { type: 'object', required: ['claim', 'holds', 'note'], additionalProperties: false,
  properties: { claim: { type: 'string' }, holds: { type: 'boolean' }, note: { type: 'string' } } } }

// Nine review seat schemas, one per seat, each declared in full. Every reader owes limitations,
// coverage and findings; the briefed seats also owe abort (law 10). The cold seats (quality,
// cold alternatives, roaster) carry no abort field, because its member names would brief them.
const CORRECTNESS = { type: 'object', additionalProperties: false,
  required: ['abort', 'limitations', 'coverage', 'findings', 'verdicts'],
  properties: { abort: ABORT, limitations: LIMITATIONS, coverage: COVERAGE, findings: FINDINGS,
    verdicts: { type: 'array', items: { type: 'object', required: ['criterion', 'verdict', 'receipts'], additionalProperties: false,
      properties: { criterion: { type: 'integer', minimum: 1 }, verdict: { enum: ['PASS', 'AT-RISK', 'FAIL'] }, receipts: RECEIPTS } } } } }
const CLEANLINESS = { type: 'object', additionalProperties: false,
  required: ['abort', 'limitations', 'coverage', 'findings', 'verdicts'],
  properties: { abort: ABORT, limitations: LIMITATIONS, coverage: COVERAGE, findings: FINDINGS,
    verdicts: { type: 'array', items: { type: 'object', required: ['criterion', 'verdict', 'receipts'], additionalProperties: false,
      properties: { criterion: { type: 'integer', minimum: 1 }, verdict: { enum: ['PASS', 'AT-RISK', 'FAIL'] }, receipts: RECEIPTS } } } } }
const SPEC_COMPLIANCE = { type: 'object', additionalProperties: false,
  required: ['abort', 'limitations', 'coverage', 'findings', 'verdicts'],
  properties: { abort: ABORT, limitations: LIMITATIONS, coverage: COVERAGE, findings: FINDINGS,
    verdicts: { type: 'array', items: { type: 'object', required: ['criterion', 'verdict', 'receipts'], additionalProperties: false,
      properties: { criterion: { type: 'integer', minimum: 1 }, verdict: { enum: ['PASS', 'AT-RISK', 'FAIL'] }, receipts: RECEIPTS } } } } }
const DUPLICATES = { type: 'object', additionalProperties: false,
  required: ['abort', 'limitations', 'coverage', 'findings', 'verdicts'],
  properties: { abort: ABORT, limitations: LIMITATIONS, coverage: COVERAGE, findings: FINDINGS,
    verdicts: { type: 'array', items: { type: 'object', required: ['criterion', 'verdict', 'receipts'], additionalProperties: false,
      properties: { criterion: { type: 'integer', minimum: 1 }, verdict: { enum: ['PASS', 'AT-RISK', 'FAIL'] }, receipts: RECEIPTS } } } } }
const INVERSE = { type: 'object', additionalProperties: false,
  required: ['abort', 'limitations', 'coverage', 'findings', 'authorizations'],
  properties: { abort: ABORT, limitations: LIMITATIONS, coverage: COVERAGE, findings: FINDINGS,
    authorizations: { type: 'array', items: { type: 'object', additionalProperties: false,
      required: ['choice', 'receipts', 'authority', 'class', 'saving'],
      properties: { choice: { type: 'string' }, receipts: RECEIPTS, authority: { type: 'string' }, saving: { type: 'string' },
        class: { enum: ['authorized', 'derivation', 'excess', 'missing-decision', 'directive-conflict'] } } } } } }
// The rule reader's finding also carries scope: in the change, or an existing violation beside it.
const RULES_SEAT = { type: 'object', additionalProperties: false,
  required: ['abort', 'limitations', 'coverage', 'findings', 'ruleSources'],
  properties: { abort: ABORT, limitations: LIMITATIONS, coverage: COVERAGE,
    findings: { type: 'array', items: { type: 'object', additionalProperties: false,
      required: ['file', 'claim', 'severity', 'lane', 'receipts', 'scope'],
      properties: { file: { type: 'string' }, claim: { type: 'string' },
        severity: { enum: ['must-fix', 'should-fix', 'nit', 'CRITICAL'] },
        lane: { enum: ['fixer-actionable', 'orchestrator-only', 'later-phase', 'not-a-defect'] },
        kind: { enum: ['band-aid', 'longer-route'] }, receipts: RECEIPTS, scope: { enum: ['in-change', 'beside'] } } } },
    ruleSources: { type: 'array', items: { type: 'object', required: ['path', 'read'], additionalProperties: false,
      properties: { path: { type: 'string' }, read: { type: 'boolean' } } } } } }
const QUALITY = { type: 'object', additionalProperties: false, required: ['limitations', 'coverage', 'findings'],
  properties: { limitations: LIMITATIONS, coverage: COVERAGE, findings: FINDINGS } }
const ALTERNATIVES = { type: 'object', additionalProperties: false,
  required: ['limitations', 'coverage', 'findings', 'currentShapeRight', 'candidates'],
  properties: { limitations: LIMITATIONS, coverage: COVERAGE, findings: FINDINGS, currentShapeRight: { type: 'boolean' },
    candidates: { type: 'array', maxItems: 2, items: { type: 'object', additionalProperties: false,
      required: ['shape', 'collapses', 'cost', 'invariants'],
      properties: { shape: { type: 'string' }, collapses: { type: 'string' }, cost: { type: 'string' }, invariants: { type: 'string' } } } } } }
const ROAST = { type: 'object', additionalProperties: false, required: ['limitations', 'coverage', 'findings', 'snapshotSha'],
  properties: { limitations: LIMITATIONS, coverage: COVERAGE, findings: FINDINGS, snapshotSha: { type: 'string' } } }

// Writer schemas. The deliverable proof is files together with checks: an account of the work
// with an empty files list behind a new snapshot fails the completeness check below.
const IMPLEMENT = { type: 'object', additionalProperties: false,
  required: ['abort', 'limitations', 'startSha', 'snapshotSha', 'clean', 'proofPassed', 'premises',
    'senseCheck', 'commits', 'files', 'checks', 'git', 'specSuggestions'],
  properties: { abort: ABORT, limitations: LIMITATIONS, startSha: { type: 'string' }, snapshotSha: { type: 'string' },
    clean: { type: 'boolean' }, proofPassed: { type: 'boolean' },
    premises: PREMISES,
    senseCheck: { type: 'object', required: ['passed', 'recordSilent', 'note'], additionalProperties: false,
      properties: { passed: { type: 'boolean' }, recordSilent: { type: 'boolean' }, note: { type: 'string' } } },
    commits: COMMITS, files: FILES, checks: CHECKS, git: GIT, specSuggestions: STRINGS } }
const FIX = { type: 'object', additionalProperties: false,
  required: ['abort', 'limitations', 'startSha', 'snapshotSha', 'clean', 'proofPassed', 'premises', 'commits',
    'files', 'checks', 'git', 'specSuggestions', 'dispositions', 'touched'],
  properties: { abort: ABORT, limitations: LIMITATIONS, startSha: { type: 'string' }, snapshotSha: { type: 'string' },
    clean: { type: 'boolean' }, proofPassed: { type: 'boolean' }, premises: PREMISES,
    commits: COMMITS, files: FILES, checks: CHECKS, git: GIT, specSuggestions: STRINGS,
    dispositions: { type: 'array', items: { type: 'object', additionalProperties: false,
      required: ['key', 'disposition', 'reason', 'receipts'],
      properties: { key: { type: 'string' }, disposition: { enum: ['fixed', 'rejected', 'blocked'] },
        reason: { type: 'string' }, receipts: RECEIPTS } } },
    touched: STRINGS } }
const VERIFY = { type: 'object', additionalProperties: false,
  required: ['abort', 'limitations', 'snapshotSha', 'clean', 'git', 'checks', 'writerScope', 'decisions',
    'issues', 'closures', 'specSuggestions'],
  properties: { abort: ABORT, limitations: LIMITATIONS, snapshotSha: { type: 'string' }, clean: { type: 'boolean' },
    git: GIT, checks: CHECKS,
    // One entry per writer commit of the round, inspected against its start; filesMatch is true
    // when the writer's files list equals the paths the commit touched (law 12).
    writerScope: { type: 'array', items: { type: 'object', required: ['sha', 'ok', 'filesMatch', 'note'], additionalProperties: false,
      properties: { sha: { type: 'string' }, ok: { type: 'boolean' }, filesMatch: { type: 'boolean' }, note: { type: 'string' } } } },
    decisions: { type: 'array', items: { type: 'object', additionalProperties: false,
      required: ['sourceIds', 'action', 'severity', 'reason', 'evidence', 'authority',
        'correction', 'constraints', 'acceptance', 'receipts'],
      properties: {
        sourceIds: { type: 'array', minItems: 1, items: { type: 'string' } },
        action: { enum: ['approve-fix', 'reject', 'needs-decision', 'root-action', 'cleanup', 'record'] },
        severity: { enum: ['must-fix', 'should-fix', 'nit', 'CRITICAL'] },
        reason: { type: 'string' }, evidence: { type: 'string' }, authority: { type: 'string' },
        correction: { type: 'string' }, constraints: { type: 'string' }, acceptance: { type: 'string' },
        receipts: RECEIPTS,
      } } },
    // Limitations and unchecked coverage must not disappear merely because they lacked a source finding.
    issues: { type: 'array', items: { type: 'object', required: ['kind', 'detail'], additionalProperties: false,
      properties: { kind: { enum: ['needs-decision', 'root-action'] }, detail: { type: 'string' } } } },
    closures: { type: 'array', items: { type: 'object', required: ['key', 'verdict', 'evidence'], additionalProperties: false,
      properties: { key: { type: 'string' }, verdict: { enum: ['closed', 'unresolved'] }, evidence: { type: 'string' } } } },
    specSuggestions: STRINGS } }

// The hard flag is the abort field (law 10): a trigger other than none. Cold seats carry no abort
// field, and an absent field is no abort. The thrown error carries the WHOLE aborting object, so
// its reason survives into the exception handoff, including an exit thrown before any round exists.
const hasHardFlag = r => r?.abort != null && r.abort.trigger !== 'none'
const abortOnFlag = (r, label) => {
  if (hasHardFlag(r)) throw new Error('HARD-FLAG from ' + label + ':\n' + JSON.stringify(r))
  return r
}
// ONE acceptance helper for every stage (law 4): a stage is accepted on the completeness of its
// object, never on the length of a text. The schema validates shapes and enums; complete() checks
// the cross-field contracts named in the acceptance section. An abort with a reason returns at
// once. A null result or a failed check retries the SAME agent with the failure named plainly,
// three attempts in all; the throw names the last failure, so a stale input such as
// args.criteriaCount is visible as the cause.
async function stage(prompt, opts, complete = () => {}) {
  let failure = ''
  for (let i = 0; i < 3; i++) {
    const r = await agent(prompt + (failure ? '\n\nHOW YOUR PREVIOUS ATTEMPT FAILED, plainly: ' + failure : ''), opts)
    if (hasHardFlag(r) && typeof r.abort.reason === 'string' && r.abort.reason.trim()) return r
    try {
      if (r == null) throw new Error('it returned nothing usable at all')
      if (hasHardFlag(r)) throw new Error('abort.trigger is set but abort.reason is empty')
      complete(r)
      return r
    } catch (error) { failure = error.message }
    log('incomplete result from ' + (opts.label || 'agent') + ', retry ' + (i + 1) + ': ' + failure)
  }
  throw new Error('FAIL-FAST: ' + (opts.label || 'agent') + ' returned no complete result after 3 attempts: ' + failure)
}

// The root supplies the clean isolated worktree's starting commit as an immutable ID, and the count
// of numbered items under the spec's acceptance-criteria heading at the revision it launches (law 9
// keeps that revision fixed for the run).
const SHA = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/
const baseSha = args.baseSha
if (!SHA.test(baseSha || '')) throw new Error('A full immutable baseSha is required')
const criteriaCount = args.criteriaCount
if (!Number.isInteger(criteriaCount) || criteriaCount < 1) {
  throw new Error('args.criteriaCount must be an integer of at least 1: the count of numbered acceptance criteria in the spec')
}
const CRITERIA = 'ACCEPTANCE CRITERIA: numbered in the spec. Read them there; return a verdict PER criterion in verdicts, each with a receipt.'
const checkWriterSnapshot = (result, startSha) => {
  if (result.startSha !== startSha || !SHA.test(result.snapshotSha || '') || result.clean !== true) {
    throw new Error('Writer did not return a clean immutable snapshot from the expected start SHA')
  }
}

// Completeness checks, one per stage kind; each throws naming what is missing.
const withReceipts = (items, label) => {
  for (const item of items) if (!item.receipts?.length) throw new Error(label + ' without a receipt: ' + JSON.stringify(item))
}
const checkReader = r => {
  withReceipts(r.findings, 'finding')
  for (const f of r.findings) if (!f.lane) throw new Error('finding without a lane: ' + f.claim)
  if (!r.coverage.length) throw new Error('coverage is empty')
  // The finding verifier judges which limitation excuses which unchecked entry; the script only
  // requires that a limitation exists to judge.
  for (const c of r.coverage) {
    if (!c.checked && !r.limitations.length) throw new Error('coverage entry not checked and no limitation declared: ' + c.what)
  }
}
const checkVerdicts = r => {
  checkReader(r)
  const got = r.verdicts.map(v => v.criterion).sort((a, b) => a - b)
  if (JSON.stringify(got) !== JSON.stringify(Array.from({ length: criteriaCount }, (_, i) => i + 1))) {
    throw new Error('expected exactly one verdict per criterion 1..' + criteriaCount + ' (args.criteriaCount), got criteria ' + JSON.stringify(got))
  }
  withReceipts(r.verdicts, 'verdict')
}
const checkInverse = r => { checkReader(r); if (!r.authorizations.length) throw new Error('authorizations is empty') }
const checkAlternatives = r => {
  checkReader(r)
  if (!r.candidates.length && !r.findings.length && !r.currentShapeRight) throw new Error('no candidate, no finding and currentShapeRight false')
}
const checkWriter = r => {
  if (r.git.head.trim() !== r.snapshotSha) throw new Error('git.head ' + JSON.stringify(r.git.head) + ' differs from snapshotSha ' + JSON.stringify(r.snapshotSha))
  if (r.clean !== (r.git.status === '')) throw new Error('clean disagrees with git.status')
  if (r.snapshotSha !== r.startSha) {
    if (!r.commits.length || !r.files.length) throw new Error('a new snapshot needs commits and files')
    if (!r.checks.some(c => c.passed === r.proofPassed)) throw new Error('no check has passed equal to proofPassed')
  } else if (r.commits.length || r.files.length) throw new Error('an unchanged snapshot lists commits or files')
}
const blocking = r => r.limitations.filter(l => l.effect === 'blocks')
// The run record, declared ahead of the implement stage so every stage's exit writes the same
// record. A blocks limitation on any accepted stage ends the run after that stage, the way a
// verifier exception ends a round: appended to exceptions, with the reason as the exit.
const BUDGET = 3                 // code-fix passes; final independent verification is still required
const history = []
let snapshotSha = null
let readCache = null
let pending = []
let pendingRoasts = []
const verifiedRoasts = new Set()
const roastRuns = []
const roastComplete = () => roastRuns.length > 0 && roastRuns.every(r => verifiedRoasts.has(r.label))
let fixPasses = 0
let fix = null
let treeUnreviewed = true
let complete = false
let exit = 'incomplete verification'
let exceptions = []
const limited = results => {
  const blocks = results.flatMap(r => blocking(r).map(l => ({ kind: 'stage-limitation', label: r.label, ...l })))
  if (blocks.length) { exceptions = [...exceptions, ...blocks]; exit = 'stage limitation needs root resolution' }
  return blocks.length > 0
}
// The deliverable of a writer is FILES ON DISK, proved by files and checks in its object: an
// account of the work is not the work (law 12). The retry in stage() names the actual failure.
const PROVE = [
  'Your deliverable is FILES ON DISK, proved by your returned object: files lists every path a commit',
  'of this stage touched with its byte size at the snapshot, checks quotes the output of every bare',
  'run, git quotes HEAD and status. An account of the work with an empty files list is not the work.',
  'Where the deliverable is an AUTHORED ARTIFACT it is MULTI-FILE: ONE FILE PER WRITE CALL, each',
  'under <the per-file size cap>. One large file written in a single call fails MID-WRITE at any',
  'output ceiling and leaves a TRUNCATED file rather than an error. The layout of CODE is decided',
  'by the spec and not by this rule: decomposition governs the DELIVERABLE, never the design.',
].join('\n')
phase('Implement')
const implemented = await stage(
  [PINS, WRITE_GIT, SPEC, PROVE, 'START SHA: ' + baseSha, 'Implement, check, and commit only scoped changes.'].join('\n\n'),
  { label: 'impl', phase: 'Implement', agentType: 'implementer', model: '<explicit>', effort: 'high', schema: IMPLEMENT },
  checkWriter,
)
const impl = abortOnFlag(implemented, 'impl')
checkWriterSnapshot(impl, baseSha)
snapshotSha = impl.snapshotSha
const implLimited = limited([{ ...impl, label: 'impl' }])
if (!implLimited && !impl.proofPassed) throw new Error('Implementation checks failed; no successful snapshot')

const RULES = 'RULE SOURCES: <applicable project, directory and global rule paths>.'
const INVARIANTS = 'REQUIRED INVARIANTS, VERBATIM: <only the constraints alternatives must preserve>.'
const HYGIENE = [
  STAGE, READ_GIT, 'Scratch goes in the project gitignored cache; no background waits.',
].join('\n')
// Only the three briefed code-lens readers receive the implementer's object, as claims to verify.
const CLAIMS = ['UNTRUSTED implementer claims (its returned object):', JSON.stringify(impl)]
// Each seat: template, label, inputs, its own schema, and its completeness check.
const SEATS = [
  ['reviewer-correctness', 'correctness', [PINS, READ_GIT, SPEC, CRITERIA, ...CLAIMS], CORRECTNESS, checkVerdicts],
  ['reviewer-cleanliness', 'cleanliness', [PINS, READ_GIT, SPEC, CRITERIA, ...CLAIMS], CLEANLINESS, checkVerdicts],
  ['reviewer-spec-compliance', 'spec', [PINS, READ_GIT, SPEC, CRITERIA], SPEC_COMPLIANCE, checkVerdicts],
  ['duplicate-checker', 'dupes', [PINS, READ_GIT, SPEC, CRITERIA, ...CLAIMS], DUPLICATES, checkVerdicts],
  ['quality', 'quality', [HYGIENE], QUALITY, checkReader],
  ['reviewer-inverse-spec', 'inverse', [PINS, READ_GIT, SPEC], INVERSE, checkInverse],
  ['project-rule-reader', 'rules', [PINS, READ_GIT, SPEC, RULES], RULES_SEAT, checkReader],
  ['cold-alternatives', 'alternatives', [HYGIENE, INVARIANTS], ALTERNATIVES, checkAlternatives],
]
const diffInput = sha => 'DIFF: ' + baseSha + '..' + sha + '. The clean worktree must remain at ' + sha + '.'
// Source findings get their IDs here, for readers and roasts alike. A kind-bearing (band-aid /
// longer-route) finding is CRITICAL: one arriving with any other severity or none is set to it here.
const sourceFindings = (findings, seat, round, sha) => findings.map((f, i) => {
  if (f.kind && f.severity !== 'CRITICAL') log('Project-benefit finding from ' + seat + ' with kind ' + f.kind + ' set to severity CRITICAL')
  return { ...f, ...(f.kind ? { severity: 'CRITICAL' } : {}), id: 'r' + round + ':' + seat + ':' + i, seat, snapshotSha: sha }
})
const readSeat = async ([type, label, inputs, schema, complete], round, sha) => {
  const stageLabel = 'review:' + label + ':r' + round
  const result = await stage([...inputs, diffInput(sha)].join('\n\n'), {
    label: stageLabel, phase: 'Review', agentType: type, model: '<explicit>', effort: 'high', schema,
  }, complete)
  return { ...abortOnFlag(result, stageLabel), seat: label, snapshotSha: sha,
    label: stageLabel }
}
const roastPass = async (queue, round, sha) => {
  const result = await stage([
    STAGE,
    'IMMUTABLE BASE SHA: ' + baseSha, 'IMMUTABLE SNAPSHOT SHA: ' + sha,
    'Read source ONLY through Git objects at those exact IDs, never HEAD or the source filesystem.',
    'The fixer runs concurrently; its HEAD/worktree changes are expected, not your review surface.',
    'Use git diff --no-ext-diff --no-textconv, git ls-tree, git show SHA:path and git grep at the pinned tree.',
    'No filesystem Read/Grep/Glob, working-tree scripts, builds, external diff helpers or Git mutations.',
    'Cite the snapshot SHA and snapshot file:line in receipts. Return snapshotSha, limitations, coverage and findings.',
    'APPROVED FIX LIST (planned, not completed):', JSON.stringify(queue),
    'Do not repeat assigned defects; do flag inadequate corrections, interactions and uncovered weaknesses.',
  ].join('\n\n'), {
    label: 'roast:r' + round, phase: 'Fix', agentType: 'roaster',
    model: '<explicit>', effort: 'high', schema: ROAST,
  }, checkReader)
  abortOnFlag(result, 'roast:r' + round)
  if (result.snapshotSha !== sha) throw new Error('Roaster reviewed the wrong snapshot')
  return { ...result, seat: 'roaster', label: 'roast:r' + round,
    findings: sourceFindings(result.findings, 'roaster', round, sha) }
}

// Schema validation handles shapes and enums; these guards enforce cross-item contracts.
const requireText = (value, label) => {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Missing ' + label)
}
const exactlyOnce = (actual, expected, label) => {
  const wanted = new Set(expected), seen = new Set()
  for (const id of actual) {
    if (!wanted.has(id) || seen.has(id)) throw new Error('Unknown or duplicate ' + label + ': ' + id)
    seen.add(id)
  }
  if (seen.size !== wanted.size) throw new Error('Missing ' + label)
}
const checkVerification = (v, sources, pending, sha) => {
  if (v.snapshotSha !== sha || v.clean !== true) throw new Error('Verifier observed snapshot drift or a dirty worktree')
  exactlyOnce(v.decisions.flatMap(d => d.sourceIds), sources.map(f => f.id), 'source ID')
  const seatOf = new Map(sources.map(f => [f.id, f.seat]))
  const kindOf = new Map(sources.map(f => [f.id, f.kind]))
  for (const d of v.decisions) {
    if (!d.sourceIds.length) throw new Error('Decision without source IDs')
    requireText(d.reason, 'decision reason')
    requireText(d.evidence, 'decision evidence')
    if (d.action === 'approve-fix') {
      for (const field of ['authority', 'correction', 'constraints', 'acceptance']) requireText(d[field], 'approved ' + field)
    }
    // A kind-bearing finding is about this unit's own diff: CRITICAL whatever its disposition,
    // never deferred as cleanup or record, and its authority quotes the record on EVERY action.
    const fromKind = d.sourceIds.some(id => kindOf.get(id))
    if (fromKind && d.severity !== 'CRITICAL') throw new Error('Project-benefit finding must keep CRITICAL severity whatever its disposition')
    if (fromKind && ['cleanup', 'record'].includes(d.action)) throw new Error('Project-benefit finding cannot be dispositioned as cleanup or record; the root closes it')
    if (fromKind) requireText(d.authority, 'project-benefit authority (the recorded words)')
    if (d.action === 'record' && ['must-fix', 'CRITICAL'].includes(d.severity)) throw new Error('Blocking defect cannot be recorded as advisory')
    // Every inverse-spec finding is CRITICAL unconditionally (law 15): ignore whatever severity
    // a reviewer supplied, and never let a mixed consolidated group launder it to a lower tier.
    const fromInverse = d.sourceIds.some(id => seatOf.get(id) === 'inverse')
    if (fromInverse && d.severity !== 'CRITICAL') {
      throw new Error('Inverse-spec finding must keep CRITICAL severity regardless of supplied categorization')
    }
    // cleanup is for work OUTSIDE this unit's repair scope; an inverse-spec finding is about a
    // choice made INSIDE this unit's own diff, so it can never be deferred there or as record.
    if (fromInverse && d.action === 'cleanup') {
      throw new Error('Inverse-spec finding cannot be dispositioned as cleanup; the root must correct the spec or ask the human')
    }
    if (['needs-decision', 'root-action', 'cleanup'].includes(d.action)) requireText(d.correction, 'next action or question')
  }
  for (const issue of v.issues) requireText(issue.detail, 'unresolved issue')
  exactlyOnce(v.closures.map(c => c.key), pending.map(f => f.key), 'closure key')
  for (const c of v.closures) requireText(c.evidence, 'closure evidence')
}
const checkFix = (result, queue, startSha) => {
  checkWriterSnapshot(result, startSha)
  for (const d of result.dispositions) requireText(d.reason, 'fix disposition reason')
  if (!queue.length && (result.touched.length || result.snapshotSha !== startSha)) {
    throw new Error('Proof-only pass edited or committed changes')
  }
}
const fixPass = (queue, round, sha) => stage([
  PINS, WRITE_GIT, SPEC, PROVE, 'START SHA: ' + sha,
  'Act ONLY on the verifier-approved corrections. Raw reviewer and concurrent roast objects are NOT work orders.',
  'Independently verify evidence and authority; respect correction, constraints and acceptance.',
  'A disagreement returns rejected or blocked with receipts to the ROOT. Never broaden scope.',
  'Answer every approved key once in dispositions. With an empty list, run proof ONLY, never edit or create an empty commit.',
  'Run checks after the last write, commit only scoped corrections, and return startSha, snapshotSha, clean, git, commits, files and checks.',
  'APPROVED CORRECTIONS (verify against the tree and authority):', JSON.stringify(queue),
].join('\n\n'), {
  label: 'fix:r' + round, phase: 'Fix', agentType: 'fixer',
  model: '<explicit>', effort: 'high', schema: FIX,
}, r => { checkWriter(r); exactlyOnce(r.dispositions.map(d => d.key), queue.map(f => f.key), 'fix key') })

// An implementer whose limitation blocks has already ended the run: no round follows it.
try {
  for (let round = 1; !implLimited; round++) {
    phase('Review')
    // An unchanged proof-only snapshot needs only its new roast verified, not another cold review.
    let freshReports = []
    if (readCache?.sha !== snapshotSha) {
      const readers = await Promise.allSettled(SEATS.map(s => readSeat(s, round, snapshotSha)))
      const failed = readers.find(r => r.status === 'rejected')
      if (failed) throw failed.reason
      readCache = { sha: snapshotSha, reports: readers.map(r => ({ ...r.value,
        findings: sourceFindings(r.value.findings, r.value.seat, round, snapshotSha) })) }
      freshReports = readCache.reports
    }
    const reports = [...freshReports, ...pendingRoasts]
    const sources = reports.flatMap(r => r.findings)
    const entry = { round, snapshotSha, reports, sources }
    history.push(entry)
    if (limited(freshReports)) break
    phase('Verify')
    // The round's writer object: the implementer's in round one, the fixer's after a fix pass.
    const writer = fix ?? impl
    const verified = await stage([
      PINS, READ_GIT, SPEC, RULES, diffInput(snapshotSha),
      'Independently run git rev-parse --verify HEAD^{commit} and git status --porcelain=v1 --untracked-files=all.',
      'Confirm the immutable commit exists and the clean current tree matches it; return snapshotSha, clean and git with the quoted output.',
      'Inspect each writer commit of this round against its start SHA for unrelated changes or history rewriting:',
      'one writerScope entry per commit, filesMatch true only when the writer\'s files list equals the paths the commit touched.',
      'Verify ALL source findings, every seat\'s limitations and unchecked coverage; consolidate without losing IDs.',
      'Roast receipts name an OLDER snapshot and the planned fixes. Check what still holds on the CURRENT snapshot.',
      'Read old Git objects when needed; reject already-resolved roast findings with current evidence, never auto-apply them.',
      'Approve only authorized corrections with evidence, receipts, authority quotes, constraints and acceptance.',
      'Independently attest EVERY pending fix: closed / unresolved with evidence; silence is not closure.',
      'SOURCE FINDINGS:', JSON.stringify(sources), 'SEAT OBJECTS (UNTRUSTED):', JSON.stringify(reports),
      'WRITER OBJECTS (UNTRUSTED, this round):', JSON.stringify([writer]),
      'PRIOR DECISIONS (UNTRUSTED):', JSON.stringify(history.slice(0, -1).map(h => ({
        round: h.round, verification: h.verification, fix: h.fix }))),
      'PENDING FIXES (UNTRUSTED):', JSON.stringify(pending),
    ].join('\n\n'), {
      label: 'verify:r' + round, phase: 'Verify', agentType: 'finding-verifier',
      model: '<explicit>', effort: 'high', schema: VERIFY,
    }, v => {
      checkVerification(v, sources, pending, snapshotSha)
      if (v.git.head.trim() !== v.snapshotSha) throw new Error('git.head ' + JSON.stringify(v.git.head) + ' differs from snapshotSha ' + JSON.stringify(v.snapshotSha))
      exactlyOnce(v.writerScope.map(w => w.sha), writer.commits.map(c => c.sha), 'writer commit in writerScope')
    })
    entry.verification = abortOnFlag(verified, 'verify:r' + round)
    if (limited([{ ...verified, label: 'verify:r' + round }])) break
    const unresolved = verified.closures.filter(c => c.verdict === 'unresolved')
    pending = pending.filter(f => unresolved.some(c => c.key === f.key))
    treeUnreviewed = pending.length > 0
    for (const roast of pendingRoasts) verifiedRoasts.add(roast.label)
    pendingRoasts = []
    // A writer commit the verifier found out of scope, or whose files list disagrees with the paths
    // it touched, is an exception for the root like any other verifier issue.
    exceptions = [...verified.issues,
      ...verified.writerScope.filter(w => !w.ok || !w.filesMatch).map(w => ({ kind: 'writer-scope', ...w })),
      ...verified.decisions.filter(d => ['needs-decision', 'root-action'].includes(d.action)),
      ...unresolved.map(c => ({ kind: 'non-convergence', ...c }))]
    if (exceptions.length) { exit = 'verification needs root resolution'; break }
    const queue = verified.decisions.filter(d => d.action === 'approve-fix')
      .map((d, i) => ({ ...d, key: 'r' + round + ':fix:' + i }))
    entry.approved = queue
    if (!queue.length && fix?.proofPassed && fix.snapshotSha === snapshotSha && roastComplete()) {
      complete = true
      exit = 'verified clean with passing proof and processed roast'
      break
    }
    if (queue.length && fixPasses >= BUDGET) {
      exceptions = [{ kind: 'budget-exhausted', approved: queue }]
      exit = 'fix budget spent; additional verified corrections need root resolution'
      break
    }

    phase('Fix')
    const startSha = snapshotSha       // captured BEFORE the writer can advance HEAD
    entry.roastLabel = 'roast:r' + round
    roastRuns.push({ label: entry.roastLabel, snapshotSha: startSha })
    pending = queue
    treeUnreviewed = true
    if (queue.length) fixPasses++
    const pair = await Promise.allSettled([fixPass(queue, round, startSha), roastPass(queue, round, startSha)])
    // Preserve either successful result even if the other task failed after writes.
    if (pair[1].status === 'fulfilled') pendingRoasts.push(pair[1].value)
    if (pair[0].status === 'fulfilled') {
      entry.fix = pair[0].value
      fix = abortOnFlag(entry.fix, 'fix:r' + round)
      checkFix(fix, queue, startSha)
      snapshotSha = fix.snapshotSha
      pending = queue.filter(f => fix.dispositions.some(d => d.key === f.key && d.disposition === 'fixed'))
    }
    const failed = pair.find(r => r.status === 'rejected')
    if (failed) throw failed.reason
    if (limited([{ ...fix, label: 'fix:r' + round }, ...pendingRoasts])) break
    const disagreements = fix.dispositions.filter(d => d.disposition !== 'fixed')
    if (disagreements.length) {
      exceptions = disagreements.map(d => ({ kind: 'fixer-disagreement',
        approved: queue.find(f => f.key === d.key), response: d }))
      exit = 'verifier/fixer disagreement needs root resolution'
      break
    }
    if (!fix.proofPassed) {
      exceptions = [{ kind: 'proof-failed', checks: fix.checks }]
      exit = 'required checks failed'
      break
    }
    // Even an empty queue must loop through Verify to process the concurrent roast.
    // Re-enter verification to process this roast, with fresh readers only if the SHA changed.
  }
} catch (error) {
  exit = 'incomplete verification: ' + error.message
  exceptions.push({ kind: 'protocol-or-stage-failure', detail: error.message })
}
const decisions = history.flatMap(h => h.verification?.decisions || [])
// Every inverse-spec decision, from every round, stays visible to the root by SOURCE IDENTITY —
// not by aggregate count — whatever it resolved to (approve-fix, reject, needs-decision,
// root-action): a completed run or a later spec edit never retires one on its own (law 15).
const sourceOfAny = new Map(history.flatMap(h => h.sources).map(s => [s.id, s]))
const inverseSpecDecisions = decisions.filter(d => d.sourceIds.some(id => sourceOfAny.get(id)?.seat === 'inverse'))
// Every kind-bearing decision in round order, with its kind-bearing source findings attached.
const projectBenefitDecisions = history.flatMap(h => (h.verification?.decisions || [])
  .filter(d => d.sourceIds.some(id => sourceOfAny.get(id)?.kind))
  .map(d => ({ decision: d, round: h.round,
    findings: d.sourceIds.map(id => sourceOfAny.get(id)).filter(f => f?.kind)
      .map(({ id, seat, kind, file, claim }) => ({ id, seat, kind, file, claim })) })))
return {
  complete, exit, exceptions, proof: fix ? { checks: fix.checks, files: fix.files } : null, baseSha, snapshotSha,
  acceptance: 'pending-root-checks', // Cycle completion is not size approval or integration permission.
  unverified: pending.map(f => f.key), treeUnreviewed,
  unverifiedRoasts: roastRuns.filter(r => !verifiedRoasts.has(r.label)),
  roastComplete: roastComplete(),
  counts: { sources: history.reduce((n, h) => n + h.sources.length, 0),
    approved: decisions.filter(d => d.action === 'approve-fix').length,
    rejected: decisions.filter(d => d.action === 'reject').length,
    recorded: decisions.filter(d => d.action === 'record').length },
  rounds: history.map(h => ({ round: h.round, snapshotSha: h.snapshotSha, verifier: h.verification ? 'verify:r' + h.round : null,
    reviewers: h.reports.filter(r => r.seat !== 'roaster').map(r => r.label),
    fixer: h.fix ? 'fix:r' + h.round : null, roaster: h.roastLabel || null })),
  cleanup: decisions.filter(d => d.action === 'cleanup'),
  inverseSpecDecisions, // the root's unconditional handoff: amend the spec, or ask the human.
  projectBenefitDecisions, // closed only by deletion, a rewrite, or the human's recorded word.
}
```

### The backtick hazard — the single most common launch failure

Build every prompt as an **array of plain-quoted strings joined with newlines**, with **NO
backticks anywhere in the text**. The script is parsed as JS: one stray backtick inside a template
literal closes it early and the whole launch dies with an opaque token error far from the real
line. The array-join convention eliminates the entire class. (This constraint is about the workflow
*scripts* — backticks in this markdown are fine.)

### Accepting a stage result — COMPLETENESS of the object

Every stage returns one structured object and nothing else, and the script accepts it on the
completeness of that object, never on the length of a text. One helper, `stage(prompt, opts,
complete)`, accepts every stage: the schema validates shapes and enums, `complete` checks the
cross-field contracts, and the helper returns at once an object whose `abort.trigger` is not `none`
with a non-empty `abort.reason` (law 10). A null result or a failed check retries the SAME agent up
to three times, each retry stating plainly HOW the previous attempt failed; the third miss throws
with the last failure named, so a stale input such as `args.criteriaCount` is visible as the cause.
`args.criteriaCount` is a required integer of at least 1: the root counts the numbered items under
the spec's acceptance-criteria heading at the revision it launches, fixed for the run by law 9.

The completeness checks, by stage kind:
- **every briefed stage**: `abort.reason` non-empty when the trigger is not `none`;
- **verdict seats**: exactly one verdict per criterion from 1 to `args.criteriaCount`, each with a
  receipt (a mismatch names the count and the criteria returned); every finding has a receipt
  and a lane;
- **the other readers**: every finding has a receipt; `coverage` non-empty; a coverage entry with
  `checked` false needs a non-empty `limitations` list, and the finding verifier judges whether a
  limitation excuses it; the inverse seat has a non-empty `authorizations` list; the alternatives
  seat has a candidate, a finding, or `currentShapeRight` true;
- **writers**: a `snapshotSha` other than `startSha` needs non-empty `commits` and `files` and a
  check whose `passed` equals `proofPassed`; an unchanged one needs both empty; the quoted
  `git.head` equals `snapshotSha` and `clean` equals `git.status` being empty; the fixer answers
  every key once;
- **finding verifier**: the source-coverage, decision and closure guards, the quoted `git.head`
  equals its `snapshotSha`, and one `writerScope` entry per writer commit of the round;
- **pre-phase seats**: `categories` non-empty and every gap with a receipt; `criteria` with
  exactly one entry per criterion from 1 to `args.criteriaCount`.

A `blocks` limitation on any accepted stage ends the run after that stage: the script appends it
to `exceptions` and exits with `stage limitation needs root resolution`, the way a verifier
exception ends a round.

**ARTIFACT-PRODUCING STAGES PROVE THE ARTIFACT IN `files` AND `checks`.** A stage can produce a
long, immaculate ANALYSIS of the work and never create the file; an empty `files` list behind a
new snapshot fails the check above, and the finding verifier recomputes from the artifact (law 12)
by checking `files` against the paths the commit touched. The stage's own account of itself is a
truncation-and-dishonesty detector, never evidence. The second line of defense is downstream:
**COLD seats refuse to fabricate a review against an artifact that is not there**, and say so in
`limitations`. If a completeness check ever rejects a genuinely complete answer, the check was
wrong, not the agent: correct it, do not delete the mechanism.

### Deliverables must be DECOMPOSABLE

Specify a deliverable as **MULTI-FILE OUTPUT — one file per write call, with a stated per-file size
cap** — never as one large artifact written in a single call. Every model has an output ceiling, and
a single-call artifact sized near it fails **MID-WRITE**: what lands is a TRUNCATED file rather than
an error, so nothing downstream can distinguish a finished deliverable from half of one, and the
completeness checks above never fire because the object lists the file with a size. This is a rule
about the SHAPE of a deliverable — it is not a property of any particular model, and a deliverable
that only works below some ceiling is a latent failure waiting for the run that sits above it.

### Threading stage outputs into later prompts

The prompt is the ONLY channel between stages. Thread outputs in **explicitly**, each block
LABELLED for what it is, and marked UNTRUSTED where it is:

```js
const fixPrompt = [
  PINS, WRITE_GIT, SPEC, PROVE, 'START SHA: ' + snapshotSha,
  'Act ONLY on the verifier-approved corrections. Independently verify their evidence and authority.',
  'Respect each correction, constraints and acceptance check. Never broaden scope.',
  'Answer each key in dispositions: fixed / rejected / blocked with receipts. Disagreements go to the ROOT.',
  'APPROVED CORRECTIONS:', JSON.stringify(queue),
].join('\n\n')
```

The verifier receives every seat object, source IDs and prior dispositions. The fixer
receives only the consolidated approvals, including source IDs and the evidence needed to
check them. The script checks every source ID once in consolidation and every approved key
once in fix dispositions. Unknown, duplicated and unanswered IDs are protocol failures.

### The FINDING-RESTATEMENT style

Any prompt handing findings to a fixer restates each one as three parts: **the DEFECT, its
EVIDENCE, and explicitly WHAT NOT TO TOUCH.** The third part is the one that gets dropped and the
one that does the work — it is what keeps a fixer inside the finding instead of tidying its
neighbourhood on the way past. Name any OPEN DECISION in the same block, stated plainly as
deliberately NOT the fixer's job, and ask the fixer to confirm it went untouched: an unnamed open
question reads to a fixer as an oversight to correct.
Unlabelled concatenation is exactly where premise drift starts: the fixer cannot tell a claim from
a ruling once they are one undifferentiated wall of text.

### `label` + `phase` on every `agent()` call

`label` makes the live progress tree and the journal legible (`review:correctness`, `impl:web`);
`phase` pins the call to its progress group even when calls race. Without labels, debugging a
failed run means reading raw transcripts to work out who was who.

### Resume corollaries

Every completed `agent()` is journaled keyed by (prompt, opts). A resume replays matching keys
instantly and re-runs the rest.
- To re-run ONE failed stage, edit ONLY that stage's prompt — usually by appending the corrective
  instruction you wanted anyway. Its key changes, it runs live, every other stage replays free.
- **NEVER edit a shared constant (`PINS`, `SPEC`) to fix one stage.** It is embedded in every
  prompt, so every key busts and the whole run re-executes.
- An in-run retry with identical (prompt, opts) is fine — the runtime treats them as separate
  calls. Across a resume, a poisoned cached result replays, so the fix is always a prompt/label
  edit, never a re-invoke.
- Before diagnosing a weird resume, READ THE JOURNAL (one result line per agent): a cached result
  can itself be empty, and that is a very different bug from a stage that never ran.
- If the run was stopped while agents were still MID-FLIGHT, those seats have no cached result and a
  plain resume restarts them from zero. Recovering their work is a different procedure — see the
  **resume-interrupted-run** skill.

### Determinism

No `Date.now()`, no `Math.random()`, no argless `new Date()` in scripts — they break replay
determinism and the runtime blocks them. Pass timestamps in via `args`, and stamp results after the
workflow returns.

### `parallel()` returns nulls

`parallel()` thunks resolve to `null` on error rather than rejecting. `filter(Boolean)` before use,
or wrap each thunk in `stage()` when a missing result must kill the run instead of silently
vanishing from the set.

### Schema versus plain text

Every stage carries a `schema`, because every stage's object is what the next stage and the script
consume (validated, retried on mismatch). Nine review seats have nine schemas, each declared in
full under its own name, so validation says which seat omitted what; the five leaf shapes (abort,
receipt, limitation, check, git) are constants reused inside them as field shapes. No stage schema
declares a free-prose field, and every stage schema root is closed with `additionalProperties:
false`: a capped summary string beside the fields is the place the content drifts back into. The
quality seat's schema, like the other cold seats', names field shapes only and carries no `abort`.

The reviewer, verification and fixer objects carry enum-locked machine fields and typed evidence:
the script checks source coverage, branches on verifier action and on the fixer's per-key
disposition to decide whether another round runs, and reads receipts (`file`, `line`, `quote`),
`coverage`, `limitations` and quoted `checks` output where a human used to read prose. The findings
array is **defects only**: verdict rows go in `verdicts`, what was inspected in `coverage`, what
was run in `checks`.

**And ENUM-LOCK the vocabulary the script branches on (law 11).** Fixing is authorized by
`approve-fix`, not a reviewer's free-form lane or severity. Lock verifier actions, severities
(including `CRITICAL` for rule violations and, unconditionally, every inverse-spec finding —
law 15), closure verdicts and fixer dispositions in the schema.
An unfamiliar word must fail validation, not silently skip a phase and produce success.

### The PINS constant

This content rides authority-aware seats, verbatim, not paraphrased. Quality and cold
spec readers get the hygiene floor only; cold alternatives gets that floor plus invariants.
Do not defeat an unbriefed seat by appending instructions to read the spec or project docs.
For the other seats:
- **The authority hierarchy** (law 8) — human verbatim directives > the spec, named by PATH and read
  from disk > this prompt, explicitly UNTRUSTED relative to the spec. Name the AUTHORITY DOCUMENTS
  as the first two and say plainly that the prompt is not one, or the next bullet has no boundary
  — but the directive still reaches the prompt directly (a spec gains no decision authority merely
  by being written, and neither does a prompt that overrides a directive it disagrees with).
- **Hard-flag semantics** (law 10) — the one `abort` field and its two triggers: a contradiction
  with a human directive on at least one side, spec or prompt (`directive-conflict`), and a
  writing seat's failed sense check (`sense-check`), the reason in `abort.reason`. Spell out the
  counter-case too, since it is the common one: a tree that does not yet satisfy the spec, or a
  prompt that merely conflicts with the spec with no directive on either side, yields ordinary
  must-fix findings, never a flag.
- **Premise verification** (law 8) — every factual claim the prompt makes about the tree is
  **VERIFIED against the tree** before anything is built on it, and a false one is
  **VERIFIED-AND-REPORTED**: build to the true state, flag the premise as a must-fix. Say this
  explicitly, or "untrusted" degrades into "ignored" and the seat builds against nothing at all.
- **Git permissions are role-specific.** Shared authority PINS contain no blanket commit
  prohibition. Append WRITE_GIT only to implementer/fixer: clean starting SHA, scoped new
  commits after checks, no unrelated changes or history rewriting. Append READ_GIT to
  ordinary readers/verifier. The roaster gets only its Git-object-only snapshot contract:
  expected fixer movement is not an anomaly, and it must never inspect that moving tree.
- **Scratch directory** — where temp files go (a gitignored cache dir), never a global temp the
  user must approve.
- **Run checks BARE** — never piped through `head`/`grep`, which hides the error you needed.
- **No background waits** — never end a turn waiting on a backgrounded check; the returned object
  IS the deliverable.
- **Abort on two triggers only** — set `abort.trigger` to `directive-conflict` for a contradiction
  with a human directive on at least one side (spec or this prompt on the other side), or to
  `sense-check` for a writing seat's failed sense check, with the reason in `abort.reason`; it is
  `none` otherwise. Everything else (the prompt losing to the spec with no directive on either
  side, a false prompt premise verified and reported, a tree that does not yet satisfy the spec)
  is an ordinary must-fix finding and the seat proceeds; see law 10.
- **The findings contract** — a source finding is a DEFECT, cites a **repo-relative** FILE and
  carries at least one receipt (`file`, `line`, `quote`); verdicts go in `verdicts`, what was
  inspected in `coverage`, what could not be checked in `limitations`. Concern reviewers suggest
  who can close it using their actionability lanes. The verifier checks every source finding,
  limitation and unchecked coverage entry, then consolidates; only its approved corrections enter
  the fixer queue. Source IDs, not file-name heuristics, bind the handoff. Every inverse-spec
  source finding is CRITICAL unconditionally, whatever label it arrived with.
- **Bound detection and repair separately.** Ordinary verdicts cover the change; the rule reader
  reads full changed files and separates unrelated cleanup. No seat turns cleanup into in-unit scope.
- **No seat edits an authority document** (law 15). Implement the spec as written unless it
  contradicts a directive (law 10); report suggestions without blocking executable work or normal
  reviews. Only an actual impossibility warrants blocking on the requirements. Only the
  orchestrator edits a spec, and only to state an existing decision, never to invent one.

Keeping these in one constant is a deliberate trade-off: editing `PINS` busts every cache key. That
cost is accepted so no stage's copy of the house rules can drift from another's.

Some of these (no background waits, abort on two triggers) also appear in the `agents/` templates.
That overlap is **deliberate reinforcement, not a second source of truth**: the template is the
authority for that role, `PINS` is the floor for authority-aware roles even when a project swaps
in its own template. Unbriefed roles get only their explicitly limited inputs. Changing a rule means changing both — they are prompt text, and a prompt rule an agent
sees twice is cheap; a prompt rule it sees nowhere is a defect.

### The fixer's prompt must NAME its inputs

The fixer acts only on the verifier's consolidated approved list, never on raw reviewer or roast
objects.
Each item carries its source IDs, verified evidence, authority references and exact quotes,
the permitted correction, constraints and acceptance check. It owes one disposition per key.
Rejected or blocked corrections return to the root with counterevidence. A new necessary
choice is not the fixer's to make; no scope expansion or authority-document edits are allowed.

## Agent prompt templates (verbatim base, append-only)

Every NAMED role this skill spawns has a fixed prompt template in `agents/` — `agents/implementer.md`,
`agents/reviewer-correctness.md`, `agents/reviewer-cleanliness.md`,
`agents/reviewer-spec-compliance.md`, `agents/duplicate-checker.md`, `agents/roaster.md`,
`agents/cold-alternatives.md`, `agents/quality.md`, `agents/reviewer-inverse-spec.md`,
`agents/project-rule-reader.md`, `agents/finding-verifier.md`, `agents/fixer.md`, plus
`agents/gap-finder.md` for the cold spec-review
pre-phase. That file's body is the agent's **authoritative
rules** and is used **VERBATIM** as the start of its prompt — invoke the agent via
`agentType:'<role>'`. The string you pass to `agent()` is **ONLY the task-specific context
APPENDED** after that base (the design, the diff, the acceptance criteria, the test command).
**Do NOT modify, reorder, or paraphrase the base rules inline — append only.**

The one deliberate exception is the pre-phase **soundness seat**, which has no template and no
`agentType` on purpose: a role template is a briefing, and an unbriefed seat is the entire mechanism.
An exception that states its reason is a rule; a template quietly missing is a defect.

## Model assignment

Set an EXPLICIT model AND effort on EVERY agent/stage — never inherit or default (see law 1).
General rule unless a project overrides it: **implementation and fixing → the strongest available
coding model at high effort; review → a strong model from a DIFFERENT family than the implementer,
high effort; mechanical stages → a mid tier at low/medium effort; never the cheapest tier.** The
roaster wants whichever model is most willing to be blunt, at high effort. Match the project's own
stated model policy if it has one.

## Don't over-fan

Scale to the change; more agents re-reading the same code is cost, not rigor.

- **Never droppable:** implementer, finding verifier, fix/proof pass, roaster, at least one
  correctness reviewer, quality and the project rule reader. No selected reader may silently fail.
- **Droppable on a tightly-scoped change:** duplicate checker when no decision path is added,
  cleanliness for a handful of lines in one file, and cold alternatives when no shape changes.
- **Never drop inverse-spec or spec-compliance when a written spec exists** — it is the cheapest insurance against
  the failure that the other seats structurally cannot see, because they check the code against the
  prompt.
- Reserve wider fan-out for genuine breadth (many independent sites), not for reassurance.

**The escape hatch: a targeted patch.** The full composition carries a roughly FIXED overhead per
increment — worth paying for an increment, absurd for a three-file fix. For those, drop out of the
composition entirely rather than running a thinned version of it: **ONE agent in an ISOLATED GIT
WORKTREE** (create it manually with `git worktree add` if the runner cannot), the gates run **inside
that worktree**, and the orchestrator **inspects the result itself** — reads the diff, looks at the
actual output — before the project's chosen integration or delivery. Apply the root completion
checks above.

Two rules that come with it:
- **Never run two tree-mutating workflows in one repo at once.** They interleave writes and neither
  run's gate result means anything afterwards. Worktree-isolate one of them.
- **When the human says stop, stop AT A PHASE BOUNDARY** — let the in-flight fix record, then stop —
  so the tree is left landable rather than half-edited. Then record what never ran as an **explicit
  unknown** ("round 3 did not run; its findings are unknown"), never by silently omitting it. An
  absence presented as a completed run is a lie the next reader cannot detect.

## Authoring notes

- Implementer and fixer have only the scoped commit permission above and return clean
  immutable snapshots. No seat may push or rewrite history. Do not apply the reader-only
  Git prohibition to the writers, or grant writer permissions to any reader.
- The root applies **Root completion checks** after every run: inspect stage durations, measure
  the final code/spec ratio (above 20:1 blocks acceptance), and follow the project's chosen
  integration route. Verify preservation/handoff in a separate call before worktree removal.
- Tell agents where scratch files go (a gitignored cache dir), never a global temp the user must approve.
- Keep routine consolidation, rejections and successful fixes inside the workflow record. Relay
  a concise result plus genuine exceptions: unsettled decisions, authority prerequisites,
  verifier/fixer disagreements or non-convergence. Preserve source findings and dispositions for
  inspection; the root need not consume every seat object to adjudicate routine work.
- Complete the same-run cleanup handoff under **Rule violations and local cleanup records**:
  update local, untracked `TODO.md` without staging or committing it unless explicitly requested.
  This is one consolidated handoff, not an interruption per issue. Never call recorded work fixed.
- A project may carry its OWN scoped copy of this skill with environment specifics (test command,
  isolation quirks, the local model floor, the must-read architecture doc). When present, that scoped
  copy wins for that project.
