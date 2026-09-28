---
name: implement-review-verify
description: Implements code changes involving shared infrastructure or subtle invariants, or changes requested through a workflow with reviewers.
---

# Implement → Review → Verify → Fix — a workflow for code changes

**Load the `writing-style` skill first.** It binds every comment, document, commit message and
reply this skill produces, and it is not optional when working with this plugin.

A reusable, project-agnostic shape for landing a non-trivial CODE change with confidence. It
*builds* against a settled design and adversarially checks the result before it is accepted.
Scoped commits provide immutable review snapshots, not approval to merge or push.

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
A simple, direct change whose outcome is very unlikely to change meaningfully, and which has no
meaningful impact on the overall product, is done directly, without a workflow.

The workflow needs git: the project is one git repository, or a tree of several git repositories
such as a repo-tool client. In a project without git no run starts, and the root may ask the user
whether they want a git repository.

## Before phase 1 — the unit spec

The root writes and validates the unit spec as `workflow-skills:spec-writing` says before either
run starts.

Every command below uses `<plugin root>/tools/check-spec.ts`, with the plugin root that
`workflow-skills:spec-writing` names, and the shipped scripts take the plugin root in their marked
block. An installed plugin older than this tool prints no proof, so its launch check fails and no
run launches on it until the plugin is updated; that is the intended effect.

A tree too large to list, such as a ROM tree of a thousand repositories worked on in place, sets
`partialBase` to true in the marked block of the main and spec review scripts. The base list then
names only the repositories the unit changes, the launch check adds `--partial-base`, and the tool
checks the listed repositories and their commits and skips the search for the ones the list leaves
out. Nothing then checks that a writer left the other repositories of the tree alone, so a tree
that can be listed in full never sets it.

The tracked design document is written by hand from the code after the implementation, so it
records what was built. It describes the change as the code at the writer's final commit
implements it: what it does, how its parts fit together, the decisions with their reasons, and the
alternatives the user rejected with their reasons. The rejected alternatives come from the spec's
items of kind `rejected`, and the writer adds none of its own. The writer checks every statement
about behaviour against that code. The document carries no words of the user, no local absolute
paths and no account of the conversation, and it follows the repository's prose rules and
`workflow-skills:writing-style`. Writing it is the writers' completion step. The implementer, once
its implementation is done, writes `docs/<unit>.md` as its last write. Its focused checks then run
once, after that write, and it commits the document as its own commit. The fixer, once its
corrections are done, updates the document by hand where a correction changed what it describes, as
its last write before its checks, and commits it when it changed. A fix run's fixer does the same
for the parent unit's document. The writer prompts of the main and fix-run scripts carry this step,
with the document path built from the spec path of the marked block: the document takes its name
from the spec's file name.

The tool prints its summary on stdout, as JSON with `--json`. The root runs the tool before the spec
pre-phase and again before the main run's implement stage, and each run's first stage runs it once
more and returns the `proof` the tool prints only when the spec passes. A spec with no item of
source `transcript` fails, as does a `requirement` derived from observations alone: the tool refuses
a spec that carries none of the user's words. A failing spec launches neither run.

Use the tool's `counts.kind.criterion` for `args.criteriaCount`, never a hand count. Its
ordered `criteria` list of `{ ordinal, id }` assigns integer ordinals from one in YAML file order;
verdicts keep that integer in `criterion`. Authority mappings name the item id: an inverse-spec
entry's authority names the authorizing id or explicitly reports that no item does. The tool proves
references resolve; the provenance reader judges authorization before code, and spec compliance,
inverse-spec and finding verification judge it after code.

### Pre-phase — two unbriefed spec seats and the provenance reader, BEFORE any implementation

Since a settled spec is already the precondition for launching, review the SPEC before reviewing
the code. Two seats, from **DIFFERENT model families**, each given only *"review the spec at
`<path>`"* plus repo access and the run's **hygiene floor** (git safety, what
`workflow-skills:local-cache` lets a reading stage write, run checks bare, no background waits,
and that no seat edits an authority document),
with **no briefing, no framing, no orchestrator summary**, because the
absence of briefing is what makes them see what the author stopped seeing. The hygiene floor is not a
briefing: it says nothing about the spec, the review taxonomy or what the author meant. The main run's
shared `AUTHORITY` block is *not* handed to these seats, because its authority tiers and findings contract
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

A third reader, **spec-provenance** (`agents/spec-provenance.md`), receives the YAML spec,
transcript directory, private record and base commits. Item by item it judges authorization,
asserted conditions and mandated mechanisms. For every subject the spec covers it searches every
message of the user in every transcript of that directory, queued messages included, and a later
statement that refines, narrows or contradicts a cited one outranks it. It also checks the frame
around the items: the summary sentence by sentence, every boundary item, every comment line of the
raw spec file, and every document, branch or earlier unit the spec names or builds on. A claim there
that no item backs, and a decision found only in a comment, are must-fix findings; comments carry
provenance notes only. It re-runs each read-only observation command and reports output or exit
mismatches and observations older than the newest base commit.

The provenance reader lists every message the user wrote, in every transcript of the directory
and queued messages included, on the unit's subject and on the subject of everything the unit
extends: documents, earlier units, and existing code the unit changes or builds on, whether or not
an item names it. A message on those subjects that no record entry holds is a must-fix finding
that blocks the main run until the root has added it to the record or the user has answered, in
the same class as a must-fix finding that an item's words are missing. It reports a choice in the
spec that no words of the user back as a finding with kind `unbacked-choice`, and the root puts
every such finding to the user as a question before the main run. The rule that approved text
counts as the user's words reaches the pre-phase through the spec-provenance template, because
the pre-phase script gives its unbriefed stages the hygiene floor only and carries no authority
block.

Its findings advise the root alongside the two unbriefed seats, whose inputs remain the spec and
hygiene floor. The spec-provenance findings carry the same must-fix, should-fix and nit severity
the gap-finder uses. Two classes of them are not advisory: a must-fix finding that an item's words
are missing, misread or ambiguous blocks the main run until the user's answer is in the record,
and a must-fix finding that a message of the user is missing from the record blocks it until the
root has added the message or the user has answered. The pre-phase is its own run, so those
blocks are a rule for the root and no script enforces them.

Their output is **advisory to the orchestrator**, who triages it against the recorded rulings and
amends the YAML spec, then validates it again. Amend the YAML — never patch the
finding into a prompt, or the spec and the prompts immediately disagree.

**Run the pre-phase as its OWN short run, and let it end there.** A running script cannot pause
while a person edits a document, so a pre-phase bolted onto the front of the main script launches
the implementer against the *unamended* spec and the whole yield is advisory to nobody. Two runs:
one that returns the two unbriefed seats and the provenance reader, then triage-and-amend, then the main workflow
against the amended YAML — which the seats below read from disk (law 9), so no prompt needs rewriting.

**Spec discipline: trivial work gets no spec, and *having* a spec is exactly what makes the two cold
seats worth it.** Do not manufacture a spec to justify the seats, and do not skip the seats when a
spec exists.

## The shape

Four phases: **Implement → Review → Verify → Fix** — after the cold spec review above.
Cold alternatives joins Review. The mandatory roaster overlaps Fix on the pre-fix commit plus approved fix list; its findings return to the root in `remaining`.

### Phase 1 — Implement (1 agent, sequential — `agentType:'implementer'`)

ONE implementer (`agents/implementer.md`), working sequentially on the real tree. One agent — not a fan-out — because a
coupled change mutates shared files and parallel writers collide. Multi-implementer fan-out on a
coupled change is **explicitly rejected**: it produced file collisions and consistency drift.
Parallel implementers are allowed only across genuinely disjoint trees/repos — and even then the
reviews can be one barrier covering both. Brief it with:
- **what is already on disk** (if part of the work exists), file by file, told to REUSE it; where the
  record permits the rebuild, the sense check below governs instead;
- the **spec**, meaning its items read from the spec path, plus the acceptance criteria. A decision
  the prompt states quotes the user's words and names the date they were said;
- the **invariants** in plain language (the ordering rule, the idempotency rule, …);
- a **self-check**: the focused checks that cover what it changed, its tests and its type check or
  build, run once before reporting done, and FIX what it added that fails. The implementer never
  runs the full check command: the fixer changes code after it, so a full run in the implement
  stage goes stale, and the fixer's run after the last write of the run is the one full check.

**Sense check before any edit.** The implementer reads the private directive record and the spec
and asks two questions: does any recorded decision rule out the mechanism the request changes, or
describe the system in a shape that mechanism contradicts; and does growing that mechanism serve
the project, or would the request stack new behavior onto a mechanism the record has already ruled
out? A record that says nothing about the mechanism rules nothing out: the check passes and
`senseCheck.recordSilent` records the silence. Where the record permits it, the implementer removes
the code and rebuilds it to the spec instead of growing it. A failed check sets `abort.trigger` to
`sense-check` with the reason in `abort.reason`: the mechanism, the recorded decision it
contradicts, why extending it is the wrong shape.

**A record that was never supplied is not a silent record.** Before any edit, the implementer sets
`abort.trigger` to `no-words` and leaves the tree unmodified when the private directive record was
not supplied, cannot be read, or holds no verbatim words of the user. A record holds the user's
words when it carries at least one quotation attributed to the user; a record with no such
quotation is wordless. A spec item whose source is `transcript` counts as the user's words; a
paraphrase, a summary and a design document's decision list do not. A record that holds the
user's words and says nothing about the mechanism still passes the sense check as silent. The
fixer sets the same trigger under the same condition before its first write. The simpler
alternative this rules out is a limitation entry, which is what let a wordless record carry a
whole program of units through review.

**Prompt scrutiny / abort — three triggers, one abort field.** The implementer also checks the prompt
against the spec and the code *before* editing. The abort has exactly three triggers: **a user
verbatim directive directly contradicted by either authority document or by this prompt** —
directive-versus-spec and directive-versus-prompt are the same trigger — **a failed sense
check** as defined above, and **a record without the user's words** (`no-words`) as defined
above. The AUTHORITY DOCUMENTS are the user's verbatim directives and the
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

None of those three sets the abort. Only a contradiction with a user directive on at least one
side (`abort.trigger` `directive-conflict`), a failed sense check (`sense-check`), or a record
without the user's words (`no-words`) sets a trigger
other than `none`, with the reason in `abort.reason`. Caught before any edit, it stops with the tree
UNMODIFIED; caught after some edits already landed, it stops further writes that would extend the
conflict or the flagged mechanism and returns the existing changes as they stand in `files` and
`commits`, committing nothing and without reverting them. Three triggers, one field, one disposition
— an abort class with no trigger of its own is undetectable, and a trigger with more than one
disposition deadlocks. The second and third triggers belong to the writing seats: a reading seat
reports the sense-check observation as a `band-aid` or `longer-route` finding (phase 2), never as
a flag, and a reading seat never sees a wordless record because the implementer stops the run
before any reader starts.
After a sense-check flag the unit continues only on the user's verbatim decision quoted in the
private record; the root chooses the continuation from the coder's object and that decision. Same
rule for scope: touch only what the task needs, and flag anything beyond the ruled scope as an
invention rather than building it.

Its last write is the design document it writes by hand from the code once its implementation is
done, as the unit spec section above describes, and its checks run once after that write. It
commits only its own scoped changes after checks, with the design document as its own commit. It
then returns `files` (every path a commit of
the stage touched, with its byte size at the snapshot), `checks` (each bare run with its quoted
output), `commits`, the full immutable snapshot SHA, `clean` and `git` (the quoted HEAD and
status). A failed check or commit is an incomplete stage, never a fabricated successful snapshot.

#### Writer commits are snapshots, not integration permission

Start each writer in a clean isolated tree with every git repository of it at its supplied full
SHA. Before edits, inspect HEAD, the index and working-tree status of each repository; unrelated
or pre-existing changes are an anomaly,
not permission to absorb or discard them. Only the implementer and fixer may stage explicit
paths for their own scoped changes, inspect the staged diff, and create NEW commits after
checks. No broad add, amend, reset, rebase, merge, cherry-pick, branch switching, history
rewriting or push. Honor project commit-message rules and normal hooks/signing. If hooks
change content, rerun proof on the final committed contents before claiming success.

Return `repositories`, one entry per repository of the base list with its `path`, `startSha`,
full `snapshotSha`, `clean` and `git` (the quoted output of `git rev-parse --verify HEAD^{commit}`
and `git status --porcelain=v1 --untracked-files=all` in that repository), then `commits`, each
naming its repository, `files`, relative to the tree root, and `checks`. The script accepts a
writer only when every repository of the list appears exactly once at its expected start, each
quoted `git.head` equals its `snapshotSha`, each `clean` agrees with an empty `git.status`, a
repository whose snapshot moved has commits in it and an unchanged one none, and a new snapshot
anywhere lists files with a check whose `passed` equals `proofPassed`.
Scratch files, which go where `workflow-skills:local-cache` says, and the todo record of
`workflow-skills:todo-md` remain ignored and untracked; clean status is not permission to commit
them. Genuine no-ops reuse their starting SHA without an empty commit. Readers and the verifier
independently
check snapshots; a writer's own object is not proof by itself.

All other seats remain Git-read-only. The root passes the starting commits as `args.base`, one
`{ path, sha }` per git repository of the tree, changed or not; a tree that is one repository is a
list of one entry whose path is a single dot. Each script refuses an empty list, a path named twice,
a path of another form than a dot or slash-joined segments of letters, digits, dots, underscores and
hyphens, and a commit ID that is not full. Use full object IDs, not HEAD or moving branch names, as
review identity. Readers receive one diff range per repository whose snapshot moved and read with
`git -C` in that repository. Immutable commits
avoid an extra checkout, archive or copy. Acceptance and integration still happen separately.

### Phase 2 — Review (N agents, parallel VERDICT seats, split BY CONCERN)

Independent reviewers, run in parallel, each owning a DISTINCT lens, each via its own `agentType`.
This phase is a **genuine barrier** — the finding verifier needs every seat's object before consolidation.

**The review stage has fifteen fixed, mandatory seats.** Every run runs all of them, whatever the
size of the change: correctness, spec compliance, the duplicate checker, quality, inverse-spec, the
project rule reader, cold alternatives, and the eight audit seats (separation of concerns,
abstraction quality, code smell, type safety, code cleanliness, missing gaps, domain leakage and
type smearing), each loading the agent template of its name. No root leaves a review seat out,
rewrites a seat's template or the prompt text the script gives a seat, or removes anything from
either. The one exception is the note `resume-interrupted-run` appends to the prompt of an
interrupted agent of a run being resumed, which adds and removes nothing else. The main script
keeps the list of the fifteen required seat labels, each with the template it loads, apart from its
seat list, and it stops before its first agent when the seat list holds any other set or gives a
label another template; the finding verifier's template names the fifteen seats and reports a seat
whose object is missing as an issue for the root.

The seats that give per-criterion verdicts:
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
- **Spec compliance** (`agents/reviewer-spec-compliance.md`) — checks explicit requirements
  FORWARD into the implementation: missing or incorrect required behaviour. The spec, not the
  orchestrator's description, is its reference. It receives NO implementer object. Inverse-spec
  owns the reverse authorization map, excess scope and decisions missing from the spec.
- **Duplicate checker** (`agents/duplicate-checker.md`) — "one decision path, recorded once": second
  enforcement sites, parallel decision paths, truth re-derived or re-recorded twice, logic copied
  instead of shared. Cheap, narrow, and catches a class nothing else does.

**A seat earns its place by having a DISTINCT FAILURE-DETECTION MODE, not by adding redundancy.**
Three identical reviewers are worth less than three different lenses. The fifteen seats are the
lenses of every run, and the main script stops a run whose seat list holds another set.

**Concern-reviewer output: per-criterion verdicts, never bare lists.** These seats return
`verdicts`, exactly one entry per criterion from 1 to `args.criteriaCount`, each
**PASS / AT-RISK / FAIL** with at least one receipt (file, line, quote), plus `findings` rated
**must-fix / should-fix / nit**. A bare findings list lets a reviewer hedge; a verdict is a claim
someone can refute. Receipts are the only currency that survives triage.

**Only the two code-lens verdict seats receive the implementer's object as UNTRUSTED CLAIMS.**
The code-lens seats (correctness and duplication) get it serialized, explicitly as a
list of CLAIMS TO VERIFY against the actual tree, never as a source they may review by reading:
holding the claim in hand is what lets a seat catch a claim that is false, which it cannot do if
it never saw the claim.
**The SPEC-COMPLIANCE seat does not receive it at all.** The seat that judges the code against the
AUTHORITY DOCUMENT must not be handed the implementer's account of what it did — its whole job is
the spec versus the tree, and an account of the work is precisely the framing that makes a missing
requirement look answered. One briefed verifier plus one cold judge beats both all-briefed and
all-cold. This rule governs WHICH INPUT a seat gets, including in a fix run or a new unit's run.

**And a FINDING IS A DEFECT — nothing else.** Verdict rows go in `verdicts`, what the seat
inspected and how in `coverage`, what it could not check in `limitations`, never in the findings
array, because mixing coverage with defects obscures what actually needs correction. Every source
finding carries a **FILE**, cited **repo-relative**, and a receipt, so verification can trace the
claim to the tree. Concern reviewers suggest **WHO CAN CLOSE IT** using their existing
actionability lanes; the verifier validates those suggestions before dispositioning, and checks
every limitation and unchecked coverage entry.

**A limitation is only something the stage was supposed to check and could not.** An act the
stage's own rules forbid, such as running tests, builds or the spec tool as a reading stage, and
input the stage is not given by design, such as the private spec for an unbriefed stage, are never
limitations and are not reported. They get no unchecked coverage entry either. The shared reader
blocks of the three scripts and every reading-stage template state this, and the finding verifier
discards such an entry without a decision.

**A reviewer suggests and never decides.** A review seat proposes, the finding verifier authorizes,
and the user decides anything that changes what the product does. Behavior nobody approved is such
a decision, whoever proposed it and however small it looks. One of two existing paths closes it:
behavior added without authority is removed as an unauthorized addition, which the inverse-spec
template already prescribes, and only a choice that removing the behavior cannot close reaches the
user at all. The correctness, spec-compliance and inverse-spec templates carry the same rule in
their own words.

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
- **The eight audit seats** (`agents/separation-of-concerns.md`, `agents/abstraction-quality.md`,
  `agents/code-smell.md`, `agents/type-safety.md`, `agents/code-cleanliness.md`,
  `agents/missing-gaps.md`, `agents/domain-leakage.md`, `agents/type-smearing.md`) — each judges
  the code through its one lens. Each receives what quality receives, the hygiene floor and the
  diff of every repository that moved, and returns what quality returns: `limitations`, `coverage`
  and `findings`, accepted by the same completeness check. Their templates ask for nothing about
  the spec, so they get no authority block and no spec. Their findings reach the finding verifier
  with the other seats' under source IDs of their label, such as `code-smell:0`.

All fifteen Review seats are REQUIRED results. Read them against a stable tree and await
ALL of them before verification. The roaster is the explicit exception to this scheduling:
it runs in Fix against immutable Git objects, never against the writer's moving filesystem.
Quality can legitimately return an empty findings list with its coverage. Each seat has its own
schema: the inverse reviewer owes a non-empty `authorizations` map, the rule reader `ruleSources`
and a `scope` on every finding, the alternatives seat a candidate, a finding or
`currentShapeRight` true. Acceptance-criterion verdicts belong to the three concern seats only.

**Every review seat also judges whether the diff HELPS THE PROJECT, not only whether it is
correct.** Two finding kinds, enum-locked as the optional `kind` field of the findings schema, each
CRITICAL, scoped to choices made in this unit's own diff: **`band-aid`** — a repair of a mechanism
the recorded words do not call for, a compensation layer around an earlier choice, or a workaround
that leaves the underlying mechanism in place — and **`longer-route`** — a longer implementation
where the recorded words already describe a simpler one. Briefed seats quote the recorded words
beside the finding. Cold seats (quality, the eight audit seats, cold alternatives, the roaster)
keep their input boundaries, flag by shape and attach no quotes; the verifier supplies the words
for a finding of quality, an audit seat or cold alternatives, and a roaster finding returns to the
root in remaining, where the root checks it against the tree and the recorded words. The rule reader
reports a pre-existing band-aid beside the diff without a kind, so the cleanup lane stays available.

**A choice without the user's words is its own finding kind.** A briefed reader reports a choice
in the spec, the prompt or the diff that no words of the user back as a finding with kind
**`unbacked-choice`**, and the inverse-spec reviewer's missing-decision findings carry it. A
decision on such a finding is CRITICAL. The unbriefed readers (quality, the eight audit seats,
`cold-alternatives`, the roaster) never see the private record, so their schemas do not carry that
kind. The provenance reader
reports the same kind in the pre-phase.

### Phase 3 — Verify and consolidate (1 read-only `agentType:'finding-verifier'`)

The verifier receives every Review seat object serialized, including quality and cold alternatives,
and the implementer's object. It checks claims against the code, settled spec, applicable rules and
recorded instructions, resolves conflicts using evidence, and merges duplicate defects into ONE fix
list, every decision with receipts. It preserves every source ID: consolidation is never permission
to drop a finding. It also checks every seat's limitations and unchecked coverage entries, inspects
each implementer commit in `writerScope`, naming its repository, and returns its own
`repositories` and `checks`. A writer's `files` list names the paths of all its commits together,
relative to the tree root, so `filesMatch` is true when every path the commit touched, under its
repository's path, appears in that list. A path in `files` that no commit of the writer touched is a
writer-scope problem, reported in the note of the writer's last commit with `ok` false.

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
EVERY action, not only `approve-fix`, supplied by the verifier for a quality or cold-alternatives
finding. Where
the record holds no words about the mechanism, `authority` states that silence in plain words,
and `approve-fix` is unavailable because the record describes no deletion or rewrite.
`approve-fix` only for the deletion or rewrite the record describes; `reject` only with
counterevidence against the finding itself. Every such decision reaches the root in
`projectBenefitDecisions`.

A decision on an `unbacked-choice` finding is CRITICAL the same way, and only two actions answer
it. `needs-decision` states in `authority` that no recorded words back the choice and reaches the
root in `remaining` as an open decision. `reject` closes it only on a record entry whose words back
the choice: its `authority` reads `record entry <id>: "<quote>"`, quoting the backing words together
with their surrounding context from that entry, and its `reason` says how that context supports the
choice. A line found by searching for a word and quoted without its context backs nothing. The
script's decision checks refuse `approve-fix`, `root-action`, `cleanup` and `record` for such a
finding, and a rejection whose `authority` lacks that citation.

Reviewer lanes and severity are claims to verify, not queue permissions. Every source ID
must belong to exactly one decision group. The SCRIPT checks coverage, unknown IDs, duplicate
IDs and approval payloads before mutation. A missing seat object or an invalid handoff stops the
run, and a `blocks` limitation on any accepted stage other than the fifteen reading seats and the
verifier ends it after that stage with exit `root-resolution` and a `blocking-limitation` item. A
reading seat's limitation reaches the root only through the verifier, which receives it with the
seat's object and keeps it as an unresolved issue or discards it, and the pass goes on to the fix
stage; missing evidence is never an implicit rejection or a clean empty queue.

Only approvals enter the fixer list. Unsettled necessary decisions, required root actions,
unresolved `issues` and the verifier's own blocking `limitations` do not hold the approved work
back: the fixer applies the approved list and runs the checks, and those items reach the root in
`remaining` with exit `root-resolution`. A read-only verifier can never run a build, a test, a
capture or a device, so a stop on every open item would end every run before its fixes. A question
only such a check can answer is the acceptance check of the approved correction it concerns. Only a
hard flag or a writer commit outside its scope keeps the fixer from running. Routine rejections and successful consolidation remain in the workflow record
and final summary; they do not interrupt the root one by one. Every decision on an inverse-spec
source finding, however it resolves, stays visible to the root in that summary: an `approve-fix`
or a well-evidenced `reject` does not need to interrupt the cycle, but the root still owes each one
an explicit resolution — recording in the todo record that the user's recorded words back the
code's choice, or asking the user about a genuinely unsettled one — and neither a later spec edit
nor a completed run closes it on its own.

### Phase 4 — Fix and roast concurrently

Launch ONE fixer and ONE mandatory roaster together after the approved list is finalized.
Capture the pre-fix SHAs before starting either. The roaster receives the immutable base and
snapshot SHA of every repository plus the approved list, using its Bash-only Git-object prompt.
In each repository, through `git -C`, it reads files with `git show SHA:path`, lists with
`git ls-tree`, searches with `git grep` at that SHA, and compares with
`git diff --no-ext-diff --no-textconv BASE_SHA SNAPSHOT_SHA --`.
No source-tree Read/Grep/Glob, filesystem scripts, builds, symlink following or external diff
helpers. It never substitutes HEAD. Receipts include the repository path, its snapshot SHA and
file:line, and it returns the snapshot it read per repository.

The fix list is PLANNED WORK, not proof. The roast should avoid repeating assigned defects,
but may flag inadequate corrections, interactions and uncovered weaknesses. Both tasks
must settle before control returns, including on failure. The roaster
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
- returns disagreements with counterevidence to the ROOT, not automatically to the user
  and not to another automatic fix attempt. A blocked mechanism stays untouched;
- updates the design document by hand as its last write once its corrections are done, where a
  correction changed what it describes, runs full checks BARE AFTER THAT LAST WRITE, commits
  completed scoped corrections and the document when it changed, then
  returns the clean snapshot SHA, `git`, `commits`, `files`, `checks` with the quoted output and
  `proofPassed`; the root attests each claimed fix against its approved correction and checks.

With an EMPTY approved list the fix pass owes PROOF ONLY and may not edit or create an empty
commit. It returns the original SHA. A failing check is reported for independent triage,
not permission to invent a repair. The concurrent roast is still mandatory and must be
returned with the remaining items; the root checks its claims against the tree.

#### One pass per run

**Each stage runs once.** Implement, the fifteen parallel Review seats, Verify, then Fix with its
concurrent roast. A stage failure, a hard flag or a blocking limitation ends the run after that
stage, except that the verifier's own blocking limitation, like an unresolved verifier decision,
ends it after the fix stage. A reading seat's limitation reaches the root only as the verifier's
issue. Fix and roast join with settlement: either valid result is retained when its peer fails,
and the fixer's cause names `detail` when both end the run.

**Source identity is deterministic, consolidation is semantic.** The script assigns IDs by seat
and finding index, `<seat>:<index>`, with `roaster` as the roast's seat name. The verifier groups the
same defect across sources using code evidence, preserving every source ID for exact coverage
checks. Stage labels are `review:<seat>`, `verify`, `fix` and `roast`.

**Every ending returns remaining items.** The run's single handoff is `remaining`, one
`{ kind, severity, item }` per open decision, verifier issue, writer-scope violation, blocking
limitation, unfixed approval, failed proof, roast finding or limitation, unattested fix, abort or
stage failure. Every fixed key carries its disposition, approved correction, snapshot and commits.
The roast's findings retain their source IDs and snapshot; its limitations and unchecked coverage
also return for the root to inspect. The root records the list in the todo record that
`workflow-skills:todo-md` defines and checks its claims as the remaining items section below says.

The run returns `exit` and a one-sentence `detail`: `clean` for a completed pass with neither a
must-fix/CRITICAL remaining item nor an unattested fix; `follow-up` for a completed pass with such
items; `root-resolution` for unresolved verification, a blocking limitation, fixer disagreement or
failed proof; `aborted` for a hard flag; `failed` for a protocol or stage failure. Completion
requires the verifier's return, both concurrent tasks settling without ending the run, and passing
proof. `proof` holds the checks and files of a fixer that passed its writer checks, otherwise the
implementer's.

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
The root records this consolidated handoff in the todo record that `workflow-skills:todo-md`
defines, in the SAME RUN, before reporting the task finished, including when the workflow exits
with unresolved work. Each
cleanup entry is recorded as a separate unit, done later; recording an issue is not fixing it.
Do not force unrelated cleanup into the current fix pass or interrupt the root
for each entry separately. If recording is blocked, report the incomplete handoff explicitly.

**The todo record stays UNTRACKED by default. Unstaged is not enough.** Creating or updating a local
cleanup record is not permission to version it. Track and commit it only when the user
explicitly requests that. Before writing, inspect the file `workflow-skills:todo-md` names and
check its Git tracking status with `git ls-files --error-unmatch -- <file>`. For an untracked
file, ensure Git ignores it; prefer a repo-local `/<file>` entry in the exclude file located by
`git rev-parse --git-path info/exclude` unless an existing ignore rule already covers it.
Inspect and preserve that exclude file; do not rewrite tracked `.gitignore` just for this
local default. Never stage or commit todo content through a broad add/commit operation.

If that file is already tracked, do not silently delete it or remove it from the index.
Honor a recorded explicit request to track and commit it; otherwise report the tracking
conflict to the root for direction before writing cleanup entries into it. The read-only
reviewers and verifier never edit the todo record or Git excludes; this handoff belongs to the root.

The enum-locked handoff and the shipped main script implement this contract. The design
and rejected alternatives are recorded in `docs/workflow-finding-verification.md`.

## Root completion checks — timing, size and project-defined integration

A completed pass returns its evidence and remaining items for root acceptance. The root performs
the checks below before accepting the unit. These are root responsibilities, not extra workflow
seats or a second implementer pre-check.

### Remaining items and follow-up work

When a run ends, the root records every remaining item in the todo record that
`workflow-skills:todo-md` defines, each as its own unit, and moves on to the next work. The run and
its unit are finished: the root never starts a run on the same spec again, never edits a finished
run's spec, and never hands a new run the previous run's findings as its next round.
Remaining items are claims until the root reads them. Check
each `roast-finding` and `roast-limitation` against the tree. Attest each `unattested-fix` by
reading its commits against the approved correction and running the checks yourself. Never
report a fix as verified on the fixer's claim.

A new run starts only for a recorded item that is supposed to be fixed: a confirmed must-fix or
CRITICAL defect in code the unit wrote, an unfixed approval, a failed proof, or an open decision
once the user has decided it. A finding whose fix needs no decision of the user may go to a fix
run, described below, whose fix list names findings of the parent run. Every other such item goes
to a new implement-review-verify unit with its own spec, and such a finding may go there as well
when the user's words cover its fix. The root writes that unit's YAML spec like any unit spec: one
criterion item per confirmed defect with its sources, the settled decision for a decided item, the
previous run's snapshot as the base, and the tool's count of criterion items as `criteriaCount`.
The cold spec review and every other stage apply unchanged. Every new run uses new prompts and a
new run ID. A new run takes as its work the recorded items it was started for, never the findings
its own review raises; those are recorded the same way. Every other item stays in the todo record
as a separate unit, done later.

A run interrupted mid-flight is resumed through `resume-interrupted-run`, as law 5 says, and that
skill is only for a run that was actually interrupted, never a way around these rules. A run
that ended any other way, before or after its review, has its items recorded like every run, and
the root never starts a run on the same spec again.

**A fix run fixes findings that need no decision of the user.** The root uses it for findings of
one named run of a unit whose spec carries the user's words, where the fix needs no decision of the
user: a logic error, a crash, a race, a rule violation or another mechanical defect in code that
unit wrote. A general instruction to fix findings does not authorize a particular fix, because the
user may not agree with the finding, so no unit spec cites such words for one. A finding that needs
a decision, an open decision, and anything the scope check refused go to the user and then to a
full unit with a spec. The root never uses the fix run for work it wants done beyond a finding.

The fix run is `scripts/fix-follow-up.js`, copied and filled in its marked block like the other two
scripts. Its copy sets `meta.name` to a kebab-case name of the fix run and `meta.description` to
one line saying what the run fixes, as a copy of the other two scripts does. It takes no spec and
no quotation. Its input is a fix list,
a YAML file in the main checkout's project cache, which `workflow-skills:local-cache` defines, with the keys `parentSpec`
(the absolute path of the unit spec the parent run was built against), `run` (the parent run's
ID) and `entries`. The tool reports a relative `parentSpec` as a violation. Each entry has
exactly `id`, `source` (the finding's source ID in the parent run, `<seat>:<index>` or
`roaster:<index>`), `finding` (a verbatim part of that finding's claim) and `correction` (the
change to make, in plain words). The list holds no user words and no field for them. The root runs
`<plugin root>/tools/check-spec.ts --fix-list <file> --transcripts <dir> --json`, which resolves
every entry against the parent run's journal and prints the proof only when every entry resolves.
The root passes the tool's `entries` and `parentSpec` output as `args.entries` and
`args.parentSpec` and the parent run's final snapshots as `args.base`, the `snapshots` list its run
record returns, and fills the parent unit's private record and documents directory into the
block. The launch check runs the same command in the worktree with
`--expect` and the JSON of those two launch values, which the script builds and quotes for the
shell. The tool fails when they differ from the fix list, so the corrections the fixer receives are
the ones the tool checked. The command also carries `--record` with the record path from the block,
and the tool fails when that path differs from the parent spec's `record`, so the fixer reads the
record the parent spec was written from.

The read-only scope check runs before any edit and classes every entry as corrective or as a new
choice, each with a reason and receipts. A new choice is not fixed: it returns as a `new-choice`
remaining item with its reason, and when no entry is corrective the run ends there with
`root-resolution` and no fixer runs. The fixer receives only the corrective entries, one key per
entry ID with the correction, the scope check's reason and its receipts, while the roaster reads
the same list. The read-only diff check then maps every change of the fix diff to a corrective
entry. The parent unit's design document has no exception: a change to it maps to the corrective
entry it carries out, or it is a CRITICAL finding. A correction whose only change is the document
is accepted when its entry names the document, and a fix reported as done needs a commit of the
fixer whatever path it touches. The fixer updates the document by hand from the code. Each finding
of the diff check returns as a CRITICAL `diff-finding` and starts no further fixer.
Every entry the fixer reports fixed returns as an `unattested-fix` for the root to attest, as in
the main run, and the run then ends `follow-up`, as it also does when only must-fix or CRITICAL
roast findings remain. It ends `root-resolution` when an entry was refused, a fix was not applied,
a fix reported as done has no commit or maps to no change in the diff check (an `unproven-fix`),
the proof failed, or the diff check found a change without an entry. It ends `clean` only when
nothing at all remains, and ends on an abort or a stage failure as the main script does.

**Two relocations mean the cause is untouched.** When the todo record shows the same defect moved
twice, the third change fixes the cause instead of moving it a third time, and a third relocation
is refused with the cause reported to the user. The count lives in that defect's entry in the todo
record of `workflow-skills:todo-md`, which is amended as the same entry each time the defect
reappears, never duplicated, since a duplicated entry hides the second move behind a
fresh-looking first one.

Record a disproved item with its counterevidence; a nit or record stays recorded in the todo record
of `workflow-skills:todo-md`.

### Root question-premise check

Before presenting any question, trade-off, limitation or acceptance request to the user, the
root checks its premises first. Identify the proposed question in plain terms, the premise it
rests on, and the exact directive/context reference and any related spec-compliance or
inverse-spec finding it touches. Then check the record against that premise: when it challenges
the premise, investigate the mismatch before asking anything, identify the unsupported scope, and
report a discovered implementation deviation from the requested result plainly — never present the
consequence of an invented mechanism as though it were a new choice the user must make. A choice
the record already settles is never asked again; only a choice it leaves genuinely unresolved is
presented as a decision request. Every entry the run returns in `inverseSpecDecisions` gets this
treatment: the root either records in the todo record that the user's recorded words back the
code's choice or, after this check, asks the user about the part that is genuinely unsettled. A
code change the decision needs is a new run under the remaining items rules above.

**A decision that changes what a thing is triggers a redesign.** When a decision of the user
changes what a thing is, the root redesigns before any unit continues and shows the redesign to the
user, beginning with what the user sees and then the data model.

**A limit is never attached to a decision.** The root never adds a limit to a decision of the
user. A limit that seems needed is asked as its own question.

**A question about a premise stops every edit to it.** When the user asks a question about a
premise, every edit that touches that premise stops until the question is answered.

**Names follow decisions.** A title, module or heading that contradicts a decision of the user is
renamed in the same change that carries the decision.

**A question is evidence of drift.** Most decisions that reach the user are there because a
direction already given was not honored, in letter or in spirit, and the shape that resulted is
then presented as a product choice whose options do not match what was asked for. That is why
such a question reads as incomprehensible to the person who gave the direction: when a direction
is honored the design comes out clean and no question arises. So before any question reaches the
user, whether a stage returned it as a needs-decision, a root-action or an open-decision item or
the root's own work raised it, the root elevates one layer: search the private directive record
and the session transcripts for the question's own terms, re-read the recorded decisions, the
design documents and the documentation of the code itself, and check whether the answer is
already stated there. The user's words are on disk; answering from memory of them is not a check. Where a recorded direction
was broken, repair the design; asking which broken shape is preferred launders the break into an
approval. Only a choice that genuinely cannot be derived from what is already decided reaches the
user.

**The root is the judge and acts on its own conclusion.** A finding from a reviewer or a critic is
a claim, not an instruction and not a question to relay. The root verifies the claim against the
tree and the recorded words, then fixes it or rejects it with a stated reason, and never hands the
claim itself to the user as a decision request. Anything headed for the user passes one screen
first: is this item in fact a rule violation or an architecture problem that another read of the
recorded words would close? An item the screen closes is decided by the root there and then. The
boundary above is unchanged by the screen: a choice the recorded words settle is never asked, and a
choice the record genuinely leaves open still reaches the user once the screen has passed it.

**A choice without the user's words is a question.** The root puts every open `unbacked-choice`
decision to the user as a question; it is the one kind of item the screen above never closes. The
root accepts a rejected one only after reading the cited record entry and checking that the quoted
words, read in their surrounding context, back the choice. A quote that does not match its context
leaves the choice open, and it goes to the user the same way. A pre-phase `unbacked-choice` finding
from the provenance reader goes to the user the same way before the main run launches.

**A reported problem carries two literal quotations.** A problem reported to the user quotes the
observed symptom and the line that causes it, each with its file and line or the command that
produced it. A characterization is not a quotation. When the cause is not identified the report
says so and names what was checked, and never substitutes a plausible cause.

**Resolve every name before you answer.** A rule, a file, a repository, a feature: each is found
and read before the reply that relies on it is written, and agreement with a name nobody looked up
is forbidden. An ambiguous reference is confirmed before anything acts on it, because the wrong
referent produces work that is internally consistent and answers the wrong question. No reply opens
with noted, recorded or done before the thing it claims has been verified.

**Asking means waiting.** A question the root does present stops the work that rests on its
answer. The root never launches a stage, a fix pass or a new run in the same turn as the
question that work would answer: pairing them makes the question decorative, because what it
asked about has already happened by the time an answer can arrive. Either the root is confident
enough to proceed without asking, or it waits. Work that does not depend on the answer continues
meanwhile.

**Decide or ask, and never both.** A decision offered with an escape hatch, standing until the user
objects, is worse than a decision the root simply takes, even when the root takes it wrongly. A
wrong call stated plainly can be interrupted and reversed. A choice offered while the work is
already moving cannot be exercised at all, and it records the user as having approved what the root
chose. So the root either owns the call, says plainly that it is its own, and proceeds, or it asks
and stops. It never dresses its own call as the user's.

This is a root PROMPT obligation, not a script gate. An executable test can confirm the
instruction above is wired into the root's prompt and that `remaining`, `inverseSpecDecisions`
and `projectBenefitDecisions` reach the root intact and unretired;
it cannot prove a future model actually performed the conversational premise check correctly.

**An ask is one short sentence, and the question stands alone on its own line.** A question buried
in a paragraph of context gets answered by the context instead of by the user. An answer approves
only what it literally names: a later change of scope or of shape spends the previous yes and needs
a new one, because what was approved is no longer what is being built. The construction that pairs
a question with a stated intention to proceed anyway is forbidden in every wording of it, since it
asks and proceeds at once and so does both of the things the decide-or-ask rule above separates.

Every entry in `projectBenefitDecisions` reaches the root whatever its disposition. The root closes
a standing one only by deletion, a rewrite, or the user's verbatim word to keep the shape, quoted
in the private record; a patch that keeps the flagged mechanism leaves the decision open. A decision the
verifier rejected closes at the root once it has checked the counterevidence against the tree and
the record and recorded it.

### While a run is in flight

The root inspects every active run at least once every thirty minutes, for as long as the run is
alive. What it reads is the run's journal and the per-agent transcript files in the run directory.
The signal it looks for is an agent whose transcript has not grown and whose stage has produced no
journal line for the whole interval, which is what a stuck or looping agent looks like from
outside. The response is to read that agent's transcript, and then either stop the run and record
why it was stopped, or record why the agent is still progressing, in both cases in the todo record
that `workflow-skills:todo-md` defines. Recording the second case is what makes the next inspection
able to tell slow work from a stall.

The inspection is a recurring task the root registers with `CronCreate` when it launches a run and
no such task is registered yet. At the first inspection that finds no run alive, the root deletes
that task with `CronDelete`, and it registers a new one with the next run it launches.

This inspection is separate from the twenty-minute soft ceiling on one agent's task below, which is
measured after the fact and is unchanged by this rule: the inspection watches a run that is still
moving and can still be stopped, and the ceiling reviews a task that has already finished.

The twelve work-execution rules, their placement and the alternatives rejected for each are
recorded in [work execution rules](../../docs/work-execution-rules.md).

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
record, for every repository of the tree, the merge-base SHA and the candidate SHA, and the `sha256`
of the final spec that the spec tool prints. That `sha256` equals the one the launch check of the
run that produced the candidate printed, so the counted spec is the one the writers and reviewers
read. The gate reads no design document. For bundle/patch delivery the comparison base is the
project's declared reconstruction base; do not silently substitute a convenient newer base.

- **Spec lines:** the `specLines` count the spec tool reports for the final spec: the non-blank
  lines of its prose (`unit`, `summary` and each item's `content`, `user_words`, `answers`,
  `quote`, `observation.output` and `reason`), wrapped by the width rule the tool checks, plus
  one line for each distinct item id named as a parent. This is the denominator of the
  code-to-spec ratio. The tool's `nonBlankLines` counts the whole YAML file, quoted words,
  evidence and keys included, and belongs only to the tool summary.
- **Code added/deleted:** sum the added and deleted line counts from
  `git diff --no-ext-diff --no-textconv --no-renames --numstat BASE_SHA CANDIDATE_SHA --`
  over implementation files, run in each repository and summed over all of them. Use added lines
  as the numerator, never net added-minus-deleted.
- **Test added/deleted:** report separately for paths containing `tests/`, `test/`, `.test.`
  or `_test.`. Treat the repository root as a path boundary so root-level test directories count.
- Exclude documentation (`*.md`), lockfiles, generated files and binaries from implementation
  counts. List excluded paths and the reason for each; lockfile/generated classification must
  come from concrete project conventions or Git attributes, not an agent's wish to reduce the
  number. State additional project-specific test/doc patterns explicitly. Keep the same
  classification and rename setting on every measurement; report deleted totals and test totals
  alongside the ratio. Disabling rename detection makes accounting reproducible (a moved file
  counts as delete/add); explain large moves rather than silently changing the measurement.
- **Ratio:** code added / spec lines, displayed to one decimal. Compare unrounded
  counts: **above 20:1 blocks acceptance/merge**; exactly 20:1 does not breach the size gate.
  The size gate passing is not proof of correctness or permission to skip another check.

The root obtains the counts from Git and the spec tool, retaining receipts. Use established
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
real missing spec detail or a prerequisite foundation. Excess code is corrected by a new run under
the remaining items rules above. Genuinely missing spec detail is work for a new unit with its own
spec, consistent with existing authority; new scope still needs authorization. Never pad the spec
to lower the ratio, or use a later amendment to retroactively authorize unsupported code. A spec
suggestion alone does not stop the implementation/reviewer cycle; this gate applies to the
finished unit.

A new run that changes the code is measured against the size bar on its own candidate.
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

Keep temporary worktrees where `workflow-skills:local-cache` puts workflow worktrees.
Never delete a worktree merely because the workflow finished. First verify that it is clean,
inspect ignored/untracked contents for material to preserve, and verify the project's handoff:

- **Direct merge:** confirm each repository's candidate commit is contained in its intended
  target branch.
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
- **RECORDING — SEATS.** The review seats emit findings for independent verification,
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
run erodes — audits find standing review lenses silently absent from the large majority of a
fleet's scripts, each omission individually reasonable when it was made. A constant resists that;
retyping does not. Author the constant once for the run and retain it when
resuming an interrupted run, so completed stages replay from their journaled results.

## The quality bar

A change is measured against a fixed bar:

- **Modularity.** A piece of work has one subject, and the parts that change together sit together
  while the parts that change independently stay apart.
- **The structure carries the cases.** An architecture where each case has its own place beats one
  generic path with conditionals bolted onto it for every case it did not anticipate.
- **A generic mechanism stays generic.** It never learns the specifics of one concrete type.
  Knowledge of a single type, smeared into shared code, makes every later type a special case.
- **A package is named after the project.** Names describe what the thing does for the project,
  never the person who wrote it.

One decision recorded once is the fifth item of this bar, and it lives with the duplicate checker:
its template and the review phase section above own that lens, so the bar names that seat instead
of repeating the rule here.

**Native mechanisms beat invented markers.** Where the platform, the library or the tool already
expresses the thing, that expression is what the change uses. A sentinel value, a magic string or a
marker invented to carry meaning the native mechanism already carries is a defect, because every
reader and every later tool has to be taught the private convention before either can be correct
about the code.

The twelve work-execution rules, their placement and the alternatives rejected for each are
recorded in [work execution rules](../../docs/work-execution-rules.md).

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
  The root attests fixed keys by reading their commits and running the checks.
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
   stage runs. The main run records the failure and remaining items; it
   never treats a failure as an empty review. Completeness is structural: the schema validates
   shapes and enums, and the script checks the cross-field contracts (one verdict per criterion, a
   receipt on every finding and verdict, coverage with a limitation behind every unchecked entry,
   files and checks behind a new snapshot, a reason behind an abort; see the acceptance section).
   The law guards EVERY required reader, including adversaries: the verifier consumes them all.
   A missing object is incomplete verification, never a harmless gap in a finished fix.
5. **Resume interrupted runs only.** A run stopped mid-flight is resumed through the
   resume-interrupted-run skill. Completed stages replay their journaled results, and unfinished
   stages re-run. A completed run never runs again: the root records its remaining items in the
   todo record and moves on, and a new run starts only for an item that is supposed to be fixed,
   as the remaining items section says.
6. **Barrier discipline.** Review readers run concurrently on a stable clean snapshot, then
   Verify consolidates their results. Fix awaits that approval. Only the Git-object-only roaster
   overlaps the fixer, reading the captured pre-fix SHA and approved list. Await both tasks;
   return the roast to the root in remaining items. These are data dependencies.
7. **Premise drift — read the authority, not a relayed gloss.** Point authority-aware stages at
   the private, ignored/untracked directive record and the current spec path (law 9). Preserve
   exact source wording in that private record, never in commit-bound artifacts without explicit
   permission. Technical specs record decisions and constraints, not conversational appendices.
8. **AUTHORITY ARCHITECTURE — state the hierarchy in authority-aware prompts.** Quality and
   cold spec reviewers receive only their hygiene/diff inputs; cold alternatives gets invariants,
   not the shared authority briefing. For other seats the three tiers are: **user verbatim directives > the spec > this prompt**, with the prompt
   explicitly labelled **UNTRUSTED** relative to both, and *"a prompt-vs-spec conflict is itself a
   must-fix finding"*. **The AUTHORITY DOCUMENTS are the top two tiers only — the directives and the
   spec. The prompt is not one**, which is what makes a prompt-vs-spec conflict an ordinary finding
   rather than the hard flag of law 10 — **but the user veto still reaches the prompt.** A prompt
   that directly contradicts a directive is the same hard-flag class as a spec that does: being
   untrusted RELATIVE TO THE SPEC does not exempt the prompt from the directive ranked above both.
   Text the user approved, held in the approves field of a private record entry, counts as the
   user's verbatim directive: this hierarchy and the directive-conflict hard flag of law 10 treat a
   contradiction with it like a contradiction with the user's own sentence.
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
   prevents drift between a prompt's stale summary and the doc. The root does not edit a spec or
   its record while a run on it is in flight. The spec review before the main run is the one run
   after which the root amends the spec, once, before it launches the main run on it. A change
   after the main run started is work for a new unit and never repeats the finished run's
   reviews. **Corollary:
   authority documents RETRACT a contradicted sentence in place.** Never append an acknowledgement
   beside a sentence it contradicts: layered addenda manufacture diverging premises, and seats then
   flag the contradiction forever, correctly.
10. **HARD-FLAG SEMANTICS.** A hard flag (agent stops, script aborts) has exactly three triggers.
    The first is a contradiction that puts a user verbatim directive on at least one side —
    **directive-vs-spec, or directive-vs-this-prompt** — two texts that cannot both be true (law
    8). The prompt being UNTRUSTED relative to the spec does not exempt it from the directive
    ranked above both: an assignment overriding a directive is the same conflict class as a spec
    that does, hard-flagged the same way. The second is a **coder sense-check failure**, and it
    belongs to the writing seats: the implementer finds, before any edit, that the request extends
    a mechanism the recorded words rule out, or the fixer finds that an approved correction is
    itself a band-aid where the record describes deletion or a rewrite (phases 1 and 4). A reading
    seat reports the same observation as a kind-bearing finding, never as a flag. The third is a
    **record without the user's words**, also the writing seats': the implementer finds, before
    any edit, that the private directive record was not supplied, cannot be read, or holds no
    quotation attributed to the user, or the fixer finds the same before its first write (phase
    1). A record that was never supplied is not a silent one. All three triggers
    share one disposition: caught before any edit, the tree stays unmodified; caught after edits
    landed, further writes stop and the coder reports the edits as they stand, committing nothing
    and reverting nothing. A tree that does not yet satisfy a coherent spec is the NORMAL
    precondition of review-and-fix and yields ordinary findings; so does an untrusted prompt that
    merely conflicts with the SPEC with no directive on either side, or one asserting a false
    premise about the tree — those are verified-and-reported, built to the truth (law 8), never an
    abort. Getting this wrong deadlocks the run: the fixer that would resolve the finding can never
    run, because the flag aborts before it. **Three triggers, one field, one disposition** — the
    `abort` field's `trigger` enum names all three (`directive-conflict`, `sense-check`,
    `no-words`) beside `none`,
    with the reason in `abort.reason`; an abort class with no trigger of its own is undetectable,
    and a trigger with more than one disposition is the deadlock in another costume. The cold
    seats carry no `abort` field, because its member names would brief them, and an absent field
    is no abort. And the structural abort lives in the **SCRIPT**, which checks **every consumed
    stage result** for a trigger other than `none` and throws with the whole object — never
    delegated to a downstream agent to rediscover. Every required object is consumed by
    verification; a failed or hard-flagged reader stops the cycle before fixing.
11. **ENUM-LOCK ANY VOCABULARY THE SCRIPT BRANCHES ON.** If control flow keys off severity, lock it in
    the output schema as an enum (`must-fix` / `should-fix` / `nit`) with validation-retry — and the
    same for every other vocabulary the script switches on: the actionability **lane**
    (`fixer-actionable` / `orchestrator-only` / `later-phase` / `not-a-defect`) and the **disposition**
    (`fixed` / `rejected` / `blocked`), verifier action (`approve-fix` / `reject` /
    `needs-decision` / `root-action` / `cleanup` / `record`),
    the finding `kind` (`band-aid` / `longer-route` / `unbacked-choice`), the abort `trigger`
    (`none` / `directive-conflict` / `sense-check` / `no-words`), the verdict (`PASS` / `AT-RISK` / `FAIL`),
    the limitation `effect` (`blocks` / `narrows`), the authorization `class`, the rule reader's
    finding `scope` (`in-change` / `beside`), the file `change` (`added` / `modified` / `deleted`)
    and the gap severity.
    A seat emitting one word against a check testing for another
    **silently disables the phase and the run reports success** — the worst possible failure mode,
    because it looks like a green run.
12. **GROUNDED MEANS OBSERVED.** Code-reading that concludes "it should work" loses to empirical
    observation every time. Verify against real output: real builds, real requests, real rendered
    results. Mechanical gates **RECOMPUTE from the artifacts**; an item's self-report is only a
    truncation-and-dishonesty detector, never evidence. **No claim about an external system without
    an observation of it.** A statement that an external system misbehaved requires an observation
    of that system misbehaving, quoted where the claim is made. A symptom is evidence that something
    happened and never evidence of which component caused it, so an attribution drawn from a symptom
    is a hypothesis and is written down as one.
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
    record the technical rationale and retract contradicted text in place (law 9), never while a
    run on it is in flight. Never retroactively authorize unsupported implementation.
    **Every inverse-spec finding is CRITICAL regardless of the severity or lane it arrived with; the
    finding verifier, the fixer and the root all ignore that supplied categorization and must
    dispose of it explicitly — never leave it implicitly closed.** The root resolves it by
    recording in the todo record that the user's recorded words back the code's choice, or by
    asking the user about a genuinely unsettled choice after checking the question's premises
    against the recorded directives; a code change it needs is a new run under the remaining items
    rules. Amending the spec does not resolve the finding, and the original verbatim directives are
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

The phase shape only holds up if the script is written to hold it up.

### Every unit's script is a copy of the shipped one, edited in one block

The skill ships three complete scripts under `scripts/`: `scripts/spec-review.js` for the pre-phase,
`scripts/implement-review-verify.js` for the main run and `scripts/fix-follow-up.js` for a fix run.
Copy the shipped script, and never copy a previous unit's copy. A copy of any of the three scripts
changes only its marked block and two values outside it, `meta.name` and `meta.description`: the
name is a kebab-case name of the unit, or of the fix run, and the description is one line saying
what the run does. Each shipped script carries `kebab-name` and `one line` as the values a copy
replaces, and its phases and every other line outside the marked block stay as shipped. A copy
that keeps the placeholders shows every run of that script in the workflow list under the same
name and description. The marked block sits at the top of each file between two comment lines and
holds every value a unit sets apart from `meta.name` and `meta.description`: the paths (main
checkout, worktree, spec, transcripts, private record, plugin root), the documents directory, the
check command, the `base` list, `criteriaCount`, the unit prompt text for the implementer, the
scoping, the rule sources, the invariants and one model entry per agent. The documents directory
is relative to the tree root and lies inside one repository of the list, `docs` for a tree that is
one repository; the scripts join it with the spec's file name to name the design document, which
the writers commit in that repository. The fix run's block holds the fix list path, the entries
and the parent spec in place of the spec, `criteriaCount` and the implementer's prompt. Everything
below the block is the reviewed script and is not edited per unit. Never copy a previous unit's
script and edit it, and never generalize one that already ran into a runner several units share.

A note for the implementer, such as the transcript of an earlier attempt it can read, goes into
the marked block's `implementerPrompt`, and nothing below the block changes for it. The implementer
still starts clean at the start commits of the base list, so such a note carries over committed
work only, through the base list, and never uncommitted changes.

A script is not neutral plumbing: most of it is prompt text, and every line of that text is
authority to the stage that receives it. A copied script carries the previous unit's authority —
an assertion about a record that does not exist here, a boundary that belonged to another spec, a
validator rule tuned to what a different writer happened to return. Those lines read as true to
the stage that gets them, and no seat reviews them, because the script is the one artifact that
never appears in a diff. Copying is how a false premise outlives the unit it was written for.

Observed three times, each caught by a WRITING seat refusing to proceed, never by a reviewer:
a runner asserted a supersession entry the unit's record did not contain; a runner told every
authority-bearing seat the check command while the same prompt forbade reviewers from running it;
a validator rule rejected an implementer for honestly reporting the iterations that failed before
its final passing run. All three arrived by inheritance from a script written for something else.

What carries across units is the shipped scripts and the template constants they name —
reviewed text, versioned in one place, changed once. What does not carry across is a file from a
previous run. Reuse the shipped file, fill the block for the unit.

The check command is prompt text for the fixer only. It never sits in a block that reviewers
receive: a reviewer may not run it, so a shared block carrying it orders and forbids the same act.
The main script keeps it in `CHECK`, which only the fixer's prompt joins. The implementer's prompt
joins `FOCUSED` in its place, the order to run only the checks that cover what it changed.

### The launch check

All three scripts begin with a launch check, before any other agent: a small stage on the model
the root sets in the `gate` entry of the marked block, shipped at low effort, whose prompt is one
command line and one sentence. The command
changes to the tree the run works on, the worktree from the marked block, so the cited rule files
resolve there and the tool finds the repositories of that tree alone. The main checkout of a
multi-repository project can hold other task trees and cached clones, which the tool would count as
repositories the base list leaves out.
It then runs `<plugin root>/tools/check-spec.ts` with `--json`, the spec path from
`args.specPath`, the transcript directory from `args.transcripts`, `--base` with the base list as
JSON in single quotes and `--record` with the private record from the marked block. The tool fails
when that record path differs from the spec's `record`. The sentence tells the stage to run that
exact command once with the Bash tool and return its exit code, stdout, stderr and the proof string
printed on success, with no interpretation, retry or fix. Its schema requires `exitCode`,
`stdout`, `stderr` and `proof`.
The script continues when `exitCode` is zero and `proof` is a non-empty string; otherwise the
stage helper retries up to three times and then throws, quoting stderr. The script refuses at
once when `args.specPath` does not end in `.yaml`. The script parses nothing from stdout and
inlines no check: the tool's own random string proves the tool ran on the one spec file the
prompt names, and the script does nothing else with it.

The fix run's launch check runs the tool's fix-list mode in place of the spec check:
`--fix-list` with the fix list from `args.fixList`, the transcript directory, `--json`, `--record`
with the parent unit's private record from the marked block, and `--expect` with the entries and
the parent spec from the launch values as one JSON argument. The script refuses at once when
`args.fixList` does not end in `.yaml`, and the tool fails when the launch values differ from the
list or the record path differs from the parent spec's `record`.

### The pre-phase script

`scripts/spec-review.js` is its own tiny run and it ENDS at the return. A script cannot pause
while a person edits a document, so the orchestrator triages this output and amends the YAML,
then launches the main run after the tool passes again. Stages
read the amended YAML from disk with no prompt rewritten (law 9). `HOUSE` is the hygiene floor
and nothing else: the two unbriefed seats get only that half on purpose, because the review
framing is a briefing and unbriefedness is the pre-phase's highest-yield property. The field
shapes and the `stage()` helper are the main script's, copied in because this is its own run.

### The main script

`scripts/implement-review-verify.js` runs the launch check, then Implement, Review, Verify and
Fix, and returns the run record. Its `meta` is a pure literal whose phase titles match the
`phase()` calls exactly. Its shipped `name` is `kebab-name` and its shipped `description` is
`one line`, and every copy replaces them with a kebab-case name of the unit and one line saying
what the run implements, so each main run appears in the workflow list under its own unit.
`AUTHORITY` rides every authority-aware seat, `HYGIENE` the unbriefed
ones, `WRITE_GIT` the two writers and `READ_GIT` the readers. The field shapes are declared once
and reused inside eight reader schemas and the writer, verifier and launch check schemas,
each a closed object declared in full; the eight audit seats share the quality seat's schema,
because they return the object it returns. `stage()` is the one acceptance helper, `abortOnFlag()`
the structural abort for every consumed stage result, and the completeness checks, the
remaining-items handoff and the exit values are the ones the sections above and below describe.

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
`args.criteriaCount` is a required integer of at least 1, taken from the tool's count of criterion
items at the YAML revision the root launches, fixed for the run by law 9.

The completeness checks, by stage kind:
- **every briefed stage**: `abort.reason` non-empty when the trigger is not `none`;
- **verdict seats**: exactly one verdict per criterion from 1 to `args.criteriaCount`, each with a
  receipt (a mismatch names the count and the criteria returned); every finding has a receipt
  and a lane;
- **the other readers**: every finding has a receipt; `coverage` non-empty; a coverage entry with
  `checked` false marks a real gap and needs a non-empty `limitations` list, and the finding
  verifier judges whether a limitation excuses it; the inverse seat has a non-empty
  `authorizations` list; the alternatives seat has a candidate, a finding, or
  `currentShapeRight` true;
- **writers**: one `repositories` entry per repository of the list; in each, a `snapshotSha`
  other than `startSha` needs commits in that repository and an unchanged one none, the quoted
  `git.head` equals `snapshotSha` and `clean` equals `git.status` being empty; a new snapshot
  anywhere needs non-empty `files` and a check whose `passed` equals `proofPassed`, and no new
  snapshot needs empty `files`; the fixer answers every key once;
- **finding verifier**: the source-coverage and decision guards, one `repositories` entry per
  repository whose quoted `git.head` equals its `snapshotSha`, and one `writerScope` entry per
  implementer commit and repository;
- **pre-phase seats**: `categories` non-empty and every gap with a receipt; `criteria` with
  exactly one entry per criterion from 1 to `args.criteriaCount`; provenance with non-empty
  coverage, receipts on findings and a non-empty `limitations` list when any entry is unchecked.

A `blocks` limitation on any accepted stage other than the fifteen reading seats and the verifier
ends the run after that stage: the script records a `blocking-limitation` item with its stage label
and exits with `root-resolution`. The verifier's own is recorded the same way, and the run ends
with `root-resolution` after the fix stage has run. The main script records no reading seat's
limitation: the verifier keeps it as an unresolved issue or discards it. The fix run has no
verifier, so there the script records the blocking limitations of the scope check, the roaster
and the diff check itself.

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
  AUTHORITY, WRITE_GIT, SPEC, PROVE, CHECK, 'START SHAS, per repository: ' + listed(snapshots),
  'Act ONLY on the verifier-approved corrections. Independently verify their evidence and authority.',
  'Respect each correction, constraints and acceptance check. Never broaden scope.',
  'Answer each key in dispositions: fixed / rejected / blocked with receipts. Disagreements go to the ROOT.',
  'APPROVED CORRECTIONS:', JSON.stringify(queue),
].join('\n\n')
```

No prompt text the root writes, the scoping and the implementer prompt of the marked block
included, calls a design settled or decided on the root's own authority. A prompt that states a
decision quotes the user's words and names the date they were said, and the script copy that
carries them stays untracked like every script holding private text.

The verifier receives every Review seat object, source IDs and the implementer object. The fixer
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

Every completed `agent()` is journaled keyed by (prompt, opts). For an interrupted run, matching
keys replay instantly and unfinished stages re-run. Read the journal to distinguish a completed
stage from one that never returned. Recover mid-flight work through **resume-interrupted-run**.
A completed run ends permanently; its remaining items are recorded and handled as the remaining
items section above says.

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
consume (validated, retried on mismatch). The readers have eight schemas, each declared in full
under its own name, so validation says which schema a seat's object failed: one per briefed seat,
one for quality, which the eight audit seats share, one for cold alternatives and one for the
roaster. The five leaf shapes (abort, receipt, limitation, check, git) are constants reused inside
them as field shapes. No stage schema declares a free-prose field, and every stage schema root is
closed with `additionalProperties: false`: a capped summary string beside the fields is the place
the content drifts back into. The quality seat's schema, like the other cold seats', names field
shapes only and carries no `abort`.

The reviewer, verification and fixer objects carry enum-locked machine fields and typed evidence:
the script checks source coverage, branches on verifier action and on the fixer's per-key
disposition to build remaining items, and reads receipts (`file`, `line`, `quote`),
`coverage`, `limitations` and quoted `checks` output, none of them free prose. The findings
array is **defects only**: verdict rows go in `verdicts`, what was inspected in `coverage`, what
was run in `checks`.

**And ENUM-LOCK the vocabulary the script branches on (law 11).** Fixing is authorized by
`approve-fix`, not a reviewer's free-form lane or severity. Lock verifier actions, severities
(including `CRITICAL` for rule violations and, unconditionally, every inverse-spec finding —
law 15) and fixer dispositions in the schema.
An unfamiliar word must fail validation, not silently skip a phase and produce success.

### The AUTHORITY constant

This content rides authority-aware seats, verbatim, not paraphrased. Quality, the eight audit
seats and cold spec readers get the hygiene floor only; cold alternatives gets that floor plus
invariants.
Do not defeat an unbriefed seat by appending instructions to read the spec or project docs.
For the other seats:
- **The authority hierarchy** (law 8) — user verbatim directives > the spec, named by PATH and read
  from disk > this prompt, explicitly UNTRUSTED relative to the spec. Name the AUTHORITY DOCUMENTS
  as the first two and say plainly that the prompt is not one, or the next bullet has no boundary
  — but the directive still reaches the prompt directly (a spec gains no decision authority merely
  by being written, and neither does a prompt that overrides a directive it disagrees with).
- **Approved text** (law 8) — text the user approved, held in the approves field of a private
  record entry, counts as the user's verbatim directive, and a contradiction with it is a
  contradiction with the user's own sentence, hard-flagged the same way. The main script's and
  the fix script's `AUTHORITY` blocks say so. The pre-phase script has no authority block, since
  its unbriefed stages get the hygiene floor only by design; the spec-provenance template carries
  the rule for the pre-phase.
- **Hard-flag semantics** (law 10) — the one `abort` field and its three triggers: a contradiction
  with a user directive on at least one side, spec or prompt (`directive-conflict`), a
  writing seat's failed sense check (`sense-check`), and a writing seat's private directive record
  that was not supplied, cannot be read, or holds no quotation attributed to the user
  (`no-words`), the reason in `abort.reason`. Never report that gap as a limitation and proceed:
  the shared prompt says so in those words. Spell out the
  counter-case too, since it is the common one: a tree that does not yet satisfy the spec, or a
  prompt that merely conflicts with the spec with no directive on either side, yields ordinary
  must-fix findings, never a flag.
- **Premise verification** (law 8) — every factual claim the prompt makes about the tree is
  **VERIFIED against the tree** before anything is built on it, and a false one is
  **VERIFIED-AND-REPORTED**: build to the true state, flag the premise as a must-fix. Say this
  explicitly, or "untrusted" degrades into "ignored" and the seat builds against nothing at all.
- **Git permissions are role-specific.** The shared AUTHORITY constant contains no blanket commit
  prohibition. Append WRITE_GIT only to implementer/fixer: clean starting SHA, scoped new
  commits after checks, no unrelated changes or history rewriting. Append READ_GIT to
  ordinary readers/verifier. The roaster gets only its Git-object-only snapshot contract:
  expected fixer movement is not an anomaly, and it must never inspect that moving tree.
- **Scratch files by role.** `workflow-skills:local-cache` defines the rule for writing stages and
  the rule for reading stages. WRITE_GIT, which only writers receive, carries the writing rule. The
  reader-only places carry the reading rule: READ_GIT, and HYGIENE through it, and the roaster's
  prompt line. No block both receive names a place for scratch files.
- **Run checks BARE** — never piped through `head`/`grep`, which hides the error you needed.
- **No background waits** — never end a turn waiting on a backgrounded check; the returned object
  IS the deliverable.
- **Abort on three triggers only** — set `abort.trigger` to `directive-conflict` for a contradiction
  with a user directive on at least one side (spec or this prompt on the other side), to
  `sense-check` for a writing seat's failed sense check, or to `no-words` for a writing seat's
  wordless record, with the reason in `abort.reason`; it is
  `none` otherwise. Everything else (the prompt losing to the spec with no directive on either
  side, a false prompt premise verified and reported, a tree that does not yet satisfy the spec)
  is an ordinary must-fix finding and the seat proceeds; see law 10.
- **The findings contract** — a source finding is a DEFECT, cites a **repo-relative** FILE and
  carries at least one receipt (`file`, `line`, `quote`); verdicts go in `verdicts`, what was
  inspected in `coverage`, what could not be checked in `limitations`. Concern reviewers suggest
  who can close it using their actionability lanes. The verifier checks every source finding,
  limitation and unchecked coverage entry, then consolidates; only its approved corrections enter
  the fixer queue. Source IDs, not file-name heuristics, bind the handoff. Every inverse-spec
  source finding is CRITICAL unconditionally, whatever label it arrived with. A reading stage
  reports a choice that no words of the user back as a finding with kind `unbacked-choice`.
- **Bound detection and repair separately.** Ordinary verdicts cover the change; the rule reader
  reads full changed files and separates unrelated cleanup. No seat turns cleanup into in-unit scope.
- **No seat edits an authority document** (law 15). Implement the spec as written unless it
  contradicts a directive (law 10); report suggestions without blocking executable work or normal
  reviews. Only an actual impossibility warrants blocking on the requirements. Only the
  orchestrator edits a spec, and only to state an existing decision, never to invent one.

One shared authority constant keeps the authority-aware prompts consistent throughout the run.

Some of these (no background waits, abort on three triggers) also appear in the `agents/` templates.
That overlap is **deliberate reinforcement, not a second source of truth**: the template is the
authority for that role, `AUTHORITY` is the floor for authority-aware roles even when a project swaps
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
`agents/reviewer-correctness.md`, `agents/reviewer-spec-compliance.md`,
`agents/duplicate-checker.md`, `agents/roaster.md`, `agents/cold-alternatives.md`,
`agents/quality.md`, `agents/reviewer-inverse-spec.md`, `agents/project-rule-reader.md`, the eight
audit templates `agents/separation-of-concerns.md`, `agents/abstraction-quality.md`,
`agents/code-smell.md`, `agents/type-safety.md`, `agents/code-cleanliness.md`,
`agents/missing-gaps.md`, `agents/domain-leakage.md` and `agents/type-smearing.md`,
`agents/finding-verifier.md`, `agents/fixer.md`, plus
`agents/gap-finder.md` and `agents/spec-provenance.md` for the spec-review
pre-phase and `agents/scope-check.md` and `agents/diff-check.md` for the fix run. That file's body is the agent's **authoritative
rules** and is used **VERBATIM** as the start of its prompt — invoke the agent via
`agentType:'<role>'`. The string you pass to `agent()` is **ONLY the task-specific context
APPENDED** after that base (the design, the diff, the acceptance criteria, the test command).
**Do NOT modify, reorder, or paraphrase the base rules inline — append only.**

The one deliberate exception is the pre-phase **soundness seat**, which has no template and no
`agentType` on purpose: a role template is a briefing, and an unbriefed seat is the entire mechanism.
An exception that states its reason is a rule; a template quietly missing is a defect.

## Model assignment

Set an EXPLICIT model AND effort on EVERY agent/stage — never inherit or default (see law 1).
The marked block of each shipped script holds one model entry, a model and an effort, for every
agent the script starts, and the root sets every one of them, the launch check included. Every
entry ships with a placeholder in angle brackets as its model, such as `<explicit>`, so no shipped
script names a model, and no agent template names one either. In the main script, `models.review`
holds one entry per review seat, keyed by the seat's label, so each of the fifteen seats can run on
its own model. The script stops before its first agent when an entry is missing, is still a
placeholder, or names an agent or seat the script does not have. It stops as well on an entry that
holds any field besides the model and the effort, because the stage options take the entry whole
and such a field would replace the agent's template or another option. A seat that reads whole
files, such as the rule reader, may need a model with a larger context than the others.
General rule unless a project overrides it: **implementation and fixing → the strongest available
coding model at high effort; review → a strong model from a DIFFERENT family than the implementer,
high effort; mechanical stages → a mid tier at low/medium effort; never the cheapest tier.** The
roaster wants whichever model is most willing to be blunt, at high effort. Match the project's own
stated model policy if it has one.

## Don't over-fan

No review seat is droppable, whatever the size of the change: every run runs the implementer, all
fifteen review seats, the finding verifier, the fix or proof pass and the roaster, and no reader may
silently fail. The main script stops a run whose seat list leaves a seat out.

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
- **When the user says stop, stop AT A PHASE BOUNDARY** — let the in-flight fix record, then stop —
  so the tree is left landable rather than half-edited. Then record what never ran in the todo
  record that `workflow-skills:todo-md` defines, as an **explicit unknown** ("the roast did not
  run; its findings are unknown"), never by silently omitting it. An absence presented as a
  completed run is a lie the next reader cannot detect.

## Authoring notes

- Implementer and fixer have only the scoped commit permission above and return clean
  immutable snapshots. No seat may push or rewrite history. Do not apply the reader-only
  Git prohibition to the writers, or grant writer permissions to any reader.
- The root applies **Root completion checks** after every run: inspect stage durations, measure
  the final code/spec ratio (above 20:1 blocks acceptance), and follow the project's chosen
  integration route. Verify preservation/handoff in a separate call before worktree removal.
- Give writing agents and reading agents the rules that `workflow-skills:local-cache` states for
  each of the two roles.
- Keep routine consolidation, rejections and successful fixes inside the workflow record. Relay
  a concise result plus genuine exceptions: unsettled decisions, authority prerequisites,
  verifier/fixer disagreements or failed proofs. Preserve source findings and dispositions for
  inspection; the root need not consume every seat object to adjudicate routine work.
- Complete the same-run cleanup handoff under **Rule violations and local cleanup records**:
  update the todo record of `workflow-skills:todo-md` without staging or committing it unless
  explicitly requested.
  This is one consolidated handoff, not an interruption per issue. Never call recorded work fixed.
- A project may carry its OWN scoped copy of this skill with environment specifics (test command,
  isolation quirks, the local model floor, the must-read architecture doc). When present, that scoped
  copy wins for that project.
