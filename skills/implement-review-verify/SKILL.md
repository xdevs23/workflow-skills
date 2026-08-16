---
name: implement-review-verify
description: Implement a CODE change (not a doc) through a four-phase workflow, preceded by a cold review of the spec itself — two unbriefed seats read the spec before any code exists, then one sequential implementer, then parallel verdict reviewers split by concern, then adversarial seats that sit in the human-only route because EVERY finding in the run routes BY DEFECT CLASS (mechanical to the fixer under re-verification, taste and design-authority to the human), then a fix pass that triages, re-verifies and proves the suite green. Use when a code change is coupled/risky enough to warrant review before committing (touches shared infra, has subtle invariants/ordering/concurrency, or the user asks to "use a workflow" / "with reviewers"). Pairs with verify-loop (this implements + reviews code; verify-loop proves a document's claims). NOT for one-off mechanical edits or pure research.
---

# Implement → Review → Adversaries → Fix — a workflow for code changes

A reusable, project-agnostic shape for landing a non-trivial CODE change with confidence. It is
the code-implementation counterpart to the document-oriented loops (`verify-loop`, `find-gaps`,
`research-loop`): those prove a spec; this *builds* against a settled design and adversarially
checks the result before it is committed.

Run it as a `Workflow()` (deterministic fan-out/sequence). The phases are fixed; the breadth
inside each scales to the change.

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
Every reviewer then returns a verdict *per criterion*. This is not ceremony: without pinned
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

**Anti-re-litigation lives IN the spec.** Two sections, carried by the doc itself: a
**rejected-alternatives** section (what was considered and why it lost), and a **rulings appendix**
holding the owner's/human's decisions **VERBATIM**. Without them, every fresh seat re-opens a settled
question in good faith, and the run pays for the same decision three times.

## The shape

Four phases: **Implement → Review → Adversaries → Fix** — after the cold spec review above.

### Phase 1 — Implement (1 agent, sequential — `agentType:'implementer'`)

ONE implementer (`agents/implementer.md`), working sequentially on the real tree. One agent — not a fan-out — because a
coupled change mutates shared files and parallel writers collide. Multi-implementer fan-out on a
coupled change is **explicitly rejected**: it produced file collisions and consistency drift.
Parallel implementers are allowed only across genuinely disjoint trees/repos — and even then the
reviews can be one barrier covering both. Brief it with:
- **what is already on disk** (if part of the work exists), file by file, told to REUSE not rebuild;
- the **settled design** and its decisions, stated as authoritative, plus the acceptance criteria;
- the **invariants** in plain language (the ordering rule, the idempotency rule, …);
- a **self-check**: run the relevant test subset before reporting done, and FIX what it added that fails.

**Prompt scrutiny / abort — exactly one trigger.** The implementer checks the prompt against the
spec and the code *before* editing, and there is a single abort condition: **two AUTHORITY DOCUMENTS
that cannot both be true.** The authority documents are the human's verbatim directives and the
spec — *the prompt is not one of them* (law 8 ranks it UNTRUSTED below both). Then everything else
falls out:
- **prompt vs spec** → an ordinary MUST-FIX finding, not an abort. The prompt loses, the seat
  proceeds against the spec, and it reports the conflict rather than silently picking a side;
- **the prompt asserts a plainly false premise about the tree** ("module X already exists") →
  **VERIFIED-AND-REPORTED**. Every factual claim the prompt makes about the tree is CHECKED against
  the tree before anything is built on it; a false one is not merely disregarded but *corrected* —
  build to the TRUE state of the tree, and flag the premise as a must-fix in the report. That beats
  both stopping and trusting, and it is what "untrusted" is supposed to buy. It is not a
  contradiction between authorities, so it must not fire the marker;
- **a tree that does not yet satisfy the spec** → the NORMAL starting condition. Treating it as a
  contradiction deadlocks the run (law 10).

None of those three emits the marker. Only the authority-vs-authority contradiction emits
`HARD-FLAG:` and stops with the tree UNMODIFIED. One trigger, one marker,
one disposition — a taxonomy with two abort classes and one marker leaves a class undetectable, and
a class with three dispositions deadlocks. Same rule for scope: touch only what the task needs, and
flag anything beyond the ruled scope as an invention rather than building it.

It reports what changed, file by file, plus the test result.

### Phase 2 — Review (N agents, parallel VERDICT seats, split BY CONCERN)

Independent reviewers, run in parallel, each owning a DISTINCT lens, each via its own `agentType`.
This phase is a **genuine barrier** — the fixer needs all of them before it can triage. The
standing seats:
- **Correctness** (`agents/reviewer-correctness.md`) — bugs, races, broken invariants, the failure
  modes the change introduces. Name the hazards in the prompt: "check the guard semantics around X"
  beats "find bugs". Tell it to say plainly "I found nothing" rather than invent issues. This seat
  also owns **ASSERTION GRANULARITY** (law 16): it READS the assertions and checks that each
  invariant is pinned at the granularity the rule binds at, never aggregated over the artifact —
  a class the gate structurally cannot catch, because the aggregate assertion is green.
- **Separation of concerns / cleanliness** (`agents/reviewer-cleanliness.md`) — does logic sit in
  the right layer? Did a special-case leak into shared/generic code? Dead code left by the rework?
  Naming — including a **PLAIN-LANGUAGE lens**: identifiers and prose in plain words, no coined
  metaphor vocabulary, because a coined vocabulary makes the work unreadable to the person who owns
  the thing it describes. (NOT bugs — that's the other seat's job.)
- **Spec compliance** (`agents/reviewer-spec-compliance.md`) — judges the implementation against the
  design doc ONLY, treating the orchestrator's prompt as untrusted. Any prompt-vs-spec disagreement,
  and anything built the spec never asked for, is a must-fix. This seat exists because a prompt can
  invent a surface the spec never had, and every other lens then dutifully checks the code against
  the prompt. **It is the one seat that does NOT receive the implementer's report** — see the output
  contract below.
- **Duplicate checker** (`agents/duplicate-checker.md`) — "one decision path, recorded once": second
  enforcement sites, parallel decision paths, truth re-derived or re-recorded twice, logic copied
  instead of shared. Cheap, narrow, and catches a class nothing else does.

**A seat earns its place by having a DISTINCT FAILURE-DETECTION MODE, not by adding redundancy.**
Three identical reviewers are worth less than three different lenses. Add a fifth lens (security,
performance) only when the change actually has that surface.

**Output contract: per-criterion verdicts, never bare lists.** Each seat returns
**PASS / AT-RISK / FAIL** against each stated acceptance criterion, every verdict backed by
`file:line` receipts, plus its findings rated **must-fix / should-fix / nit**. A bare findings list
lets a reviewer hedge; a verdict is a claim someone can refute. Receipts are the only currency that
survives triage.

**The implementer's report rides as an UNTRUSTED CLAIMS LIST — to every seat but one.** The
code-lens seats (correctness, cleanliness, duplication) get it explicitly as a list of CLAIMS TO
VERIFY against the actual tree, never as a source they may review by reading: holding the claim in
hand is what lets a seat catch a claim that is false, which it cannot do if it never saw the claim.
**The SPEC-COMPLIANCE seat does not receive it at all.** The seat that judges the code against the
AUTHORITY DOCUMENT must not be handed the implementer's account of what it did — its whole job is
the spec versus the tree, and an account of the work is precisely the framing that makes a missing
requirement look answered. One briefed verifier plus one cold judge beats both all-briefed and
all-cold. This is a rule about WHICH INPUT a seat gets, and it is a different thing from the
cold-every-round rule in phase 4, which is about CROSS-ROUND state and applies to every seat here
including this one.

**And a FINDING IS A DEFECT — nothing else.** The verdict rows, the coverage notes, the record of
what was run, the criteria that passed: all of those ride in the seat's *report*, never in its
findings array, because a non-defect sitting in the findings array holds the fix loop of phase 4 open
forever. Every finding additionally carries a **FILE**, cited **repo-relative** — one with no file
cannot be keyed, tracked or mechanically rechecked, so it is a report observation instead, and one
cited some other way cannot be matched against what the fixer touched — and names **WHO CAN CLOSE
IT**, using the four actionability lanes the loop partitions on.

Where these findings go is not this phase's call. Routing is **one rule for every finding in the
run**, stated in the next section: by DEFECT CLASS. These four seats are the mechanical route.

### Phase 3 — Adversaries (parallel), and the routing rule for EVERY finding in the run

**Route findings by DEFECT CLASS, not by how aggressive the seat that raised them was.** This is one
rule with two ROUTES, and it governs the phase-2 verdicts just as much as the seats below. *Route*
and *lane* are two different words here on purpose: a **route** decides who READS a finding, and the
**actionability lane** of phase 4 decides who can CLOSE one.

- **MECHANICAL classes — correctness, spec compliance, cleanliness, duplication — go to the fixer,
  under reviewer re-verification.** It is the phase-2 path, and it works precisely because a
  mechanical finding is checkable against the tree by someone other than the person who raised it.
  Mechanical is necessary but **not sufficient**: a mechanical finding enters the fix queue only if
  the FIXER can actually close it. One whose fix is a spec edit belongs to the orchestrator, and one
  about work a later phase performs belongs to nobody yet — see the actionability lanes in phase 4.
  **A mechanical finding that ORIGINATED with an ADVERSARY seat carries one extra step: the
  ORCHESTRATOR INDEPENDENTLY VERIFIES IT AGAINST THE CODE before it enters the fix queue at all.**
  Adversary claims are stated with the same force whether or not they are true, and one that does
  not survive verification would otherwise become a work order on the strength of its tone. This
  step sits ON TOP of the relay path below, it does not shortcut it: an adversary finding still
  reaches the fixer only as a ruled item the human sent back, never straight from the report. Route
  by class — but never unverified.
- **TASTE and DESIGN-AUTHORITY calls are HUMAN-ONLY.** Nobody but the human may rule on "is this the
  right shape" or "does this look right". A seat on this route RECORDS; it never auto-fixes.

Routing *every* adversary finding to the human is the failure mode on the other side: it turns the
human into the fixer's queue, and a queue with a person in it stops being read. The two seats below
sit on the human-only route for a reason stated per seat — not because they are adversarial — and so
their findings are **relayed to the human and NEVER fed to the fixer**:

- **Roaster** (`agents/roaster.md`) — a deliberately merciless critic told to shred the
  implementation with maximum aggression, bounded by two hard rules: every point cites `file:line`
  and names concretely what is rotten (receipt-less insults are discarded), and it targets CODE
  ONLY, never people or agents. It reliably finds what polite lenses rationalize away.
- **Cold alternatives** (`agents/cold-alternatives.md`) — sees ONLY the diff and the invariants it
  must hold, deliberately not the implementer's report, and answers one question: is there a
  materially simpler shape? It proposes concretely or says plainly that the current shape is right.

**Why these two are human-only.** The roaster is a **detector with excellent recall and poor
precision, and the human is the classifier.** Roughly two thirds of its output is stylistic opinion or
re-litigation of a settled decision; a fixer acting on that raw would churn settled code, and would
occasionally "fix" it into violating a recorded ruling. The classifier step is the whole value.
Cold-alternatives is human-only for the *other* reason: a materially simpler shape is a **design-authority call**, so
handing it to a fixer is a mid-flight redesign nobody ruled. The gate costs **one round of latency,
not lost fixes** — a real catch survives triage and comes back as a ruled spec item, on the mechanical
route, where the fixer can act on it.

**Relay them TRIAGED, never verbatim.** Raw relay trains the human to ignore the seat, which kills
it just as surely as never running it. So: (a) drop receipt-less points at relay time — enforce the
bound, do not just state it in the prompt; (b) fold out anything a verdict seat also caught or the
fixer already fixed, with a one-line "caught independently, fixed" note, because settled items must
not be re-adjudicated; (c) present the survivors in plain language, one bullet each, with your own
recommendation attached (fix / accept / your call). The human's terse rulings then become the NEXT
round's spec items, VERBATIM — and any of them that returns as mechanical work is verified against
the code by the orchestrator before it is queued, per the rule above.

### Phase 4 — Fix (1 agent — `agentType:'fixer'`)

ONE agent (`agents/fixer.md`) that acts on **only the verdict seats' output** from phase 2: the keyed
queue the loop below builds, plus those same seats' prose reports as clearly labelled UNTRUSTED
context, because the receipts a finding needs re-verifying against live in the report. The adversary
seats' output is not among its inputs at all. It:
- **independently re-verifies** every finding against the code before acting — reviewers produce
  false positives constantly;
- returns **one DISPOSITION per finding — `fixed` / `rejected` (with reason) / `blocked` (with
  reason)** — keyed to the finding it answers. It is explicitly empowered to reject. Prose in place of
  a disposition is not an answer the loop can read. `rejected` and `blocked` are **permanent**: they
  leave the loop for the human, and no later round has any mechanism to revisit them;
- **leaves a TRACE IN THE TREE for every `blocked` defect** — a pinned or explicitly-skipped test,
  at the place the work lives, naming the disagreement and why it is unresolved. A defect recorded
  only in a report is invisible to everyone who later reads the code, and the report is read once
  while the code is read forever. This is the counterpart of the terminal disposition: the finding
  leaves the loop, but it does not leave the tree silently;
- when a correctness finding implies a fix broader than the original spec (e.g. "re-run on any
  terminal state", not just "on completed"), it is trusted to make that call and document it. That
  is **breadth on the MECHANICAL route** — the fix the finding actually requires — and it is not a
  licence to redesign: a different shape is a design-authority call and stays human-only. It must say
  so in its report, because the spec-compliance seat will correctly raise the resulting
  beyond-the-spec surface as a must-fix, and that finding is **orchestrator-only** — the spec catches
  up with the ruled breadth by a dated disposition (law 15), never by the fixer reverting the fix;
- **never edits the spec or any other authority document** (law 15): a finding whose fix is a spec
  edit comes back `blocked`, with the evidence, for the orchestrator to disposition;
- **PROVES** the result under the **completion-claim rule** of the quality-gate section below — a
  BARE rerun AFTER ITS LAST WRITE, quoted VERBATIM. That section is where the rule and its reasons
  live; this bullet only says the fixer owes it;
- **returns** the disposition table AND a per-criterion status.

**The PROOF BAR: suite green + a per-criterion status.** Not "the fixer said it's done". Ask the fixer
for that status explicitly — a green suite cannot prove a criterion no test covers, so without it the
bar is only half-checkable. Call it the proof bar and not an "exit criterion", because the loop below
has exits of its own and they are a different thing: the proof bar is what ONE fix pass owes. Only the
fixer produces it, so **the fix pass runs even when review finds nothing to fix** — with an empty
queue, its whole job that pass is the proof.

#### The review → fix loop, and why it TERMINATES

When must-fix findings survive, phases 2 and 4 re-run as a loop. There are exactly two structural
ways such a loop never ends, and both are the script's to prevent: a finding **nobody inside the loop
can close**, which keeps the open set non-empty no matter how many rounds run; and a **review surface
with no edge**, which manufactures genuinely-new findings indefinitely. Every rule below closes one of
those two doors.

**Reviewers stay COLD, every round.** A re-run seat gets its **SAME original prompt** and judges the
tree as it now stands. It is never handed prior findings, an open list, or the fixer's report.
Briefing a reviewer with the known list turns it into an adjudicator *of that list* and suppresses the
findings nobody has seen yet; recall must not be traded away to buy termination, and the exits below
mean it never has to be. The consequence goes in the fixer's prompt: since no reviewer will ever read
its explanation, **every fix must be self-explanatory IN THE TREE.**

**All cross-round state lives in the SCRIPT.** The script is the only component that sees more than
one round, so it is the only one entitled to reason about them: it keys every finding, keeps a ledger
of which key appeared in which round with which disposition, and decides what happens next. **No agent
is asked to remember anything.**

**The key is mechanical and exact:** seat + file + claim, each of the three lowercased, whitespace
collapsed and line numbers stripped — **every component, not just the claim**, because seats cite
files as `path:line` and an unnormalised file component turns one defect into three keys across three
rounds. There is deliberately **no fuzzy matching and no classifier seat** ruling on whether
two findings are the same defect — a near-miss counts as a miss, and a differently-phrased finding is
simply treated as new. State the cost honestly: a recurring finding that comes back in different words
evades recurrence detection. The mitigation is that recurrence is not what makes the loop terminate —
the progress and budget exits do that regardless of wording.

**ONLY FIXER-ACTIONABLE FINDINGS MAY HOLD THE LOOP OPEN.** This is the central termination rule. Every
round, the script partitions the findings into four **actionability lanes** by **WHO CAN CLOSE IT** —
a finer cut than the two routes of phase 3, taken *inside* the mechanical route:
- **fixer-actionable** — a code defect the fixer can fix now. **Only this lane counts toward the
  loop's exit condition.**
- **orchestrator-only** — the fix is an edit to the spec or another authority document. It leaves the
  loop and goes to the orchestrator (law 15).
- **later-phase** — the finding is about work a subsequent phase performs, so it cannot be true yet.
  It leaves the loop. The ordering rule that stops it existing in the first place: **never ask a seat
  to verdict a criterion that a LATER phase is responsible for satisfying.** Do it and the loop cannot
  terminate by construction — the fixer has no way to close the finding, and the seat is right to keep
  raising it every round.
- **not-a-defect** — a verdict row, a coverage note, a passing criterion, or an objection that rests
  on taste rather than on a defect. These are REPORT material, never findings; the report is what
  carries them onto the human-only route.

A finding whose lane is not fixer-actionable is removed from the fix queue **for the rest of the run**.
A cold seat will legitimately keep raising it — that is the price of keeping the seats cold — so the
script recognises the key and **re-routes it silently** instead of re-queueing it.

**Severity gates the loop: only `must-fix` holds it open.** should-fix and nit are collected and
reported, never blocking. Letting a non-blocking severity hold the loop open is a known way to never
terminate: the set of things that could be nicer does not empty.

**Exit on PROGRESS, not on attempts.** The loop stops when the fixer-actionable must-fix set is
**empty**; or when a round **closes nothing**, which means the seats and the fixer disagree rather than
the tree being broken, and no further round has anything new to bring; or when the **budget is spent**.
A key that **recurs after a fix attempt** is stuck: it is escalated and never queued again, so the loop
cannot spin on it, and when that retirement empties the queue the loop ends there. A `rejected` or
`blocked` disposition is likewise permanent — it leaves for the human and no later round revisits it.
The attempt cap is a **backstop, never the convergence criterion** — a loop whose only exit is its cap
burns the whole budget every single run. Whatever is still open at exit is **REPORTED to the human,
never force-fixed**, and the budget exit additionally reports the last round's fixes as an explicit
**unverified** set, because no cold round ever saw them.

**A cheap mechanical check comes before any round.** Every finding carries a file, so the script can
ask whether the fixer touched that file at all. If it did not, the finding is **trivially unresolved**
and no seat is needed to establish that — and a `fixed` disposition on an untouched file is a
contradiction, escalated and recorded in the result rather than re-reviewed. Recompute the touched set
from the tree where the runner permits it; the fixer's own list is a cross-check, not evidence
(law 12). Either way both sides are pinned to **repo-relative paths** and compared after the same
normalisation as the key: a check whose two inputs come from two different authors under no path
convention false-negatives on every genuine fix, and this check is the loop's own decision input, so a
false negative there corrupts the exit reason itself. The complementary gap is checked in the same
place — a **queued key no disposition answered** is unresolved by definition, and the script records it
rather than reading the silence as a disagreement.

**Scope the review surface to THE CHANGE.** Seats review the change under review and what it touches —
**not the whole product, and not previously landed work.** Pre-existing problems noticed in passing are
backlog material (that is what `audit-loop`'s log is for), never inputs to this loop's exit condition.
An unbounded review surface yields new findings forever, and then no other rule here can make the exit
condition arrive.

The loop branches on **severity, lane and disposition**, so all three are ENUM-LOCKED in the schemas
(law 11) — a loop keyed on a word a seat is merely trusted to spell right is a loop that silently
never runs.

## The QUALITY GATE — three different things, and only two of them BLOCK

A gate is not a review seat, and the two words are not interchangeable. Say which of the three a
given check is, because only two of them stop the run:

- **BLOCKING — committed TOOLS invoked as gate steps.** The repo's own check scripts (tests, lint,
  format), plus scans of the same objective kind: a banned-vocabulary scanner, an incoming
  conflict-marker sweep. These are **exit-code gates** — they pass or they fail and nobody
  adjudicates the result.
- **BLOCKING — SCRIPT-LEVEL contract checks.** The orchestrator SCRIPT throws on a protocol
  violation: the fail-fast retry helper (law 4) and the **deliverable-proof** check below. These
  stop the run deliberately, and **the decision lives in the script** — never delegated to a
  downstream agent to rediscover, for the same reason the structural abort does not (law 10).
- **RECORDING — SEATS.** The standing quality and cleanliness lenses ride the review phase and emit
  findings into the fixer's queue like any other reviewer. **They never block.**

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

**GATES EXECUTE INSIDE THE FIX PHASE** — the fixer runs them bare after its own last write — and
never as a later phase that emits findings of its own. A gate placed after the loop produces
findings no fixer can close, which is exactly the `later-phase` lane of phase 4: the open set is
pinned above zero, no round can close it, and the run burns its whole budget before the backstop
exit fires. The ordering rule in that phase already forbids this shape; a gate is simply the most
tempting way to build it by accident.

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
- **The fix phase triages, doesn't rubber-stamp.** A finding is a hypothesis, not a verdict. The
  fixer decides, applies the fix, and re-proves — closing the loop with real suite output, not a claim.
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
4. **FAIL-FAST.** An agent returning null or a sub-minimal result retries the SAME agent (3 attempts
   total), then the WORKFLOW THROWS. Never let an empty result flow into the next stage: a fixer
   triaging an empty review "succeeds" vacuously and you ship unreviewed code believing it was
   reviewed. A *short but complete* result is not a failure — a clean seat still owes a per-criterion
   verdict block, so set the floor below that and it clears. **The floor is a PROSE test and it
   cannot prove an artifact**, so a stage whose deliverable is FILES is ACCEPTED ON a deliverable-proof
   marker — a long narration clears any floor with nothing on disk. The floor still rides underneath
   that marker, because it catches a different failure and costs nothing; it is simply not what
   decides acceptance there (see the acceptance section below). The law
   guards results a later stage CONSUMES; a seat nothing consumes (the adversaries) reports its own
   failure to the human instead of killing a finished fix.
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
6. **Barrier discipline.** Barrier only where the next stage genuinely needs ALL prior results (the
   fix phase does — it needs every verdict). A barrier after every stage "for cleanliness" is pure
   wall-clock waste; everything else pipelines. The two standing **human-route** adversary seats are
   the counter-example: nothing downstream consumes them, so nothing downstream waits on them.
7. **Premise drift — never paraphrase an authority.** The human's rulings ride VERBATIM; the spec
   rides as a PATH the agent reads for itself (law 9). Every paraphrase hop through an orchestrator
   mutates the ruling, and by the third hop the agents are building against something the user never
   said.
8. **AUTHORITY ARCHITECTURE — state the hierarchy in EVERY prompt.** Three tiers, spelled out in the
   prompt itself: **owner/human verbatim directives > the spec > this prompt**, with the prompt
   explicitly labelled **UNTRUSTED** relative to both, and *"a prompt-vs-spec conflict is itself a
   must-fix finding"*. **The AUTHORITY DOCUMENTS are the top two tiers only — the directives and the
   spec. The prompt is not one**, which is what makes a prompt-vs-spec conflict an ordinary finding
   rather than the hard flag of law 10. Anything the orchestrator adds beyond the spec is labelled **"ORCHESTRATOR
   SCOPING — the spec wins on conflict"**, which makes it structurally attackable by every seat. This
   exists because **the orchestrator's own errors are the dominant error class** — a mis-stated
   criterion, a gloss that contradicts another gloss of the same ruling, a "verbatim" appendix that
   isn't — and this hierarchy is the only mechanism in the run that catches them. **Untrusted means
   VERIFIED, not ignored:** every factual claim the prompt makes about the tree is checked against
   the tree, and a FALSE one is **verified-and-reported** — build to the true state, flag the
   premise as a must-fix — which beats both trusting it and stopping on it (law 10).
9. **SPECS ARE LIVING DOCUMENTS, READ FROM DISK.** Every prompt names the spec by PATH and instructs:
   *"read the current on-disk revision in full; it is the authority, not this prompt's description of
   it."* Never cite a revision number, never restate the spec's content in the prompt. This is what
   makes mid-run amendments work — amend the spec, and the next round enforces the new ruling with no
   relaunch — and what prevents drift between a prompt's stale summary and the doc. **Corollary:
   authority documents RETRACT a contradicted sentence in place.** Never append an acknowledgement
   beside a sentence it contradicts: layered addenda manufacture diverging premises, and seats then
   flag the contradiction forever, correctly.
10. **HARD-FLAG SEMANTICS.** A hard flag (agent stops, script aborts) is reserved **EXCLUSIVELY for
    contradictions AMONG authority documents** — two texts that cannot both be true, where "authority
    document" means the directives or the spec and never the prompt (law 8). A tree that does not yet
    satisfy a coherent spec is the NORMAL precondition of review-and-fix and yields ordinary findings;
    so does an untrusted prompt that conflicts with the spec, or one asserting a false premise about
    the tree — that one is verified-and-reported, built to the truth (law 8), never an abort.
    Getting this wrong deadlocks the run: the fixer that would resolve the finding can never
    run, because the flag aborts before it. **One trigger, one marker, one disposition** — a second
    abort class with no marker of its own is undetectable, and a single event with three dispositions
    is the deadlock in another costume. And the structural abort lives in the **SCRIPT**, which
    checks **every consumed stage result** for the marker and returns — never delegated to a
    downstream agent to rediscover. (A seat nothing consumes relays its flag to the human instead of
    killing a finished fix; see law 4.)
11. **ENUM-LOCK ANY VOCABULARY THE SCRIPT BRANCHES ON.** If control flow keys off severity, lock it in
    the output schema as an enum (`must-fix` / `should-fix` / `nit`) with validation-retry — and the
    same for every other vocabulary the loop switches on: the actionability **lane**
    (`fixer-actionable` / `orchestrator-only` / `later-phase` / `not-a-defect`) and the **disposition**
    (`fixed` / `rejected` / `blocked`). A seat emitting one word against a check testing for another
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
15. **THE SPEC ITSELF CAN BE WRONG — route it by EVIDENCE TIER, and only the ORCHESTRATOR edits it.**
    A seat may conclude the spec is *wrong* without the spec being self-contradictory (that is the
    law-10 hard flag, and it is already covered). Route the soft case by what the belief stands on.
    **Grounded in a HIGHER authority** — the human's verbatim rulings, or reality itself (a
    measurement, a disproven claim, an artifact that does not behave as the spec asserts) — it is an
    **ordinary must-fix whose fix is a SPEC EDIT**, lane `orchestrator-only`. **Ungroundable in
    either**, it is taste, so it is not a finding at all: it rides in the seat's REPORT (lane
    `not-a-defect`), which is what carries it onto the **human-only route** of phase 3 — never to the
    fixer, and never into the fix queue. **ONLY THE ORCHESTRATOR MAY EDIT A SPEC OR ANY
    OTHER AUTHORITY DOCUMENT.** The fixer and every seat are forbidden from editing one — they report,
    the orchestrator dispositions. The edit lands as a **dated DISPOSITION in the spec** that carries
    the reasoning and the evidence and **RETRACTS the contradicted sentence IN PLACE** (law 9). That
    is the whole anti-circling mechanism: seats read the spec live from disk each round, so the next
    round reads *why* the sentence says what it says and can only re-open it with NEW evidence. Append
    an acknowledgement beside the contradicted sentence instead of retracting it and the conflict is
    re-manufactured every round — flagged, correctly, forever.
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
// pre-phase's highest-yield property. robust() is the same helper as in the main skeleton below:
// this is its own run, so copy the definition in.
const HOUSE = [
  'GIT: READ-ONLY BY INTENT. You do not change what git records or which commit the tree sits on,',
  'by any means, named here or not. Illustration, NOT the boundary: stash, checkout, reset, restore,',
  'clean, commit, rebase, merge, cherry-pick, branch or worktree switching. ALLOWED: status, diff, log, show.',
  'An enumerated verb list ROTS; the intent governs. A tree MOVING UNDERNEATH YOU is an ANOMALY:',
  'report it verbatim, never work around it.',
  'Scratch files go in the project cache dir, never a global temp.',
  'Run checks BARE. Never pipe through head/grep - it hides the error.',
  'NEVER end a turn waiting on a backgrounded check; your final message IS the deliverable.',
  'You may NEVER edit the spec or any other authority document: report it, the orchestrator amends it.',
].join('\n')
// Two UNBRIEFED seats, DIFFERENT model families. No abortOnFlag here: nothing downstream
// consumes them, the human does — and a contradiction they find IS the deliverable (law 10).
// Both are told to PROBE: reading alone catches about a third of what probing catches.
const PROBE = [
  'PROBE, do not just read: render, recompute, fetch and MEASURE the spec claims against reality.',
  'Concentrate on three blocker classes: JOINT IMPOSSIBILITY (two constraints each satisfiable',
  'alone, unsatisfiable together - found by COMPUTATION, not by reading); MISSING PRODUCTION',
  'CONTRACT (an artifact assumed to exist with no account of how it is produced, sized or kept in',
  'sync); REALITY DRIFT (the world moved under a recorded assumption).',
].join('\n')
phase('Spec review')
return await Promise.all([
  robust([HOUSE, PROBE, 'Review the spec at docs/<the-spec>.md. You get no other briefing, by design.'].join('\n\n'),
    { label: 'spec:gaps', phase: 'Spec review', agentType: 'gap-finder', model: '<explicit>', effort: 'high' }, 300),
  robust([HOUSE, PROBE, 'Review the spec at docs/<the-spec>.md: are its requirements mutually satisfiable, and is every acceptance criterion checkable as written?'].join('\n\n'),
    { label: 'spec:soundness', phase: 'Spec review', model: '<explicit, other family>', effort: 'high' }, 300),
])
```

### Skeleton — the main run

```js
export const meta = {
  name: 'kebab-name',
  description: 'one line',
  phases: [{ title: 'Implement' }, { title: 'Review' }, { title: 'Adversaries' }, { title: 'Fix' }],
}
// meta must be a PURE LITERAL — no variables, no interpolation. Phase titles here must
// match the phase() calls EXACTLY or the progress grouping silently degrades. Review and Fix
// are RE-ENTERED once per round; the round rides in the label, never in the title.

const PINS = [                    // house rules; every agent gets these verbatim (see below)
  'AUTHORITY: human verbatim directives > the spec at the path below > THIS PROMPT (untrusted).',
  'The AUTHORITY DOCUMENTS are those first two. This prompt is NOT one of them.',
  'Read the CURRENT on-disk revision of the spec in full; it is the authority, not this prompt.',
  'VERIFY every factual claim this prompt makes about the tree, AGAINST THE TREE, before building',
  'on it. A FALSE premise is VERIFIED-AND-REPORTED: build to the TRUE state and flag the premise.',
  'A prompt-vs-spec conflict, and a false premise, are MUST-FIX FINDINGS:',
  'report them and proceed against the spec. Never silently pick one; never stop for them.',
  'HARD-FLAG (prefix HARD-FLAG: and stop) ONLY for a contradiction BETWEEN authority documents.',
  'A tree not yet satisfying the spec is normal: report ordinary findings, never a hard flag.',
  'GIT: READ-ONLY BY INTENT. You do not change what git records or which commit the tree sits on,',
  'by any means, named here or not. Illustration, NOT the boundary: stash, checkout, reset, restore,',
  'clean, commit, rebase, merge, cherry-pick, branch or worktree switching. ALLOWED: status, diff, log, show.',
  'An enumerated verb list ROTS; the intent governs. A tree MOVING UNDERNEATH YOU is an ANOMALY:',
  'report it verbatim, never work around it.',
  'Scratch files go in the project cache dir, never a global temp.',
  'Run checks BARE. Never pipe through head/grep — it hides the error.',
  'NEVER end a turn waiting on a backgrounded check; your final message IS the deliverable.',
  'A FINDING IS A DEFECT: verdict rows, coverage notes and passing criteria go in the report.',
  'Every finding cites a FILE and names WHO CAN CLOSE IT - the actionability lane, one of:',
  'fixer-actionable / orchestrator-only / later-phase / not-a-defect (report material, never a finding).',
  'Cite every file as a REPO-RELATIVE path: the loop matches findings to fixes by that path.',
  'Review the CHANGE and what it touches - never the whole product or already-landed work.',
  'You may NEVER edit a spec or any other AUTHORITY DOCUMENT: report it, the orchestrator edits it.',
].join('\n')
// The spec rides as a PATH. The criteria live IN the doc and ride as a POINTER, never as a
// copy: an embedded copy goes stale the instant the spec is amended, which is the drift law 9
// exists to kill. Only the human's rulings ride verbatim (law 7) — they are tier-1 text, not
// spec content. Orchestrator-only additions are labelled so seats can attack them (law 8).
const SPEC = [
  'SPEC (authority): docs/<the-spec>.md — read the current on-disk revision in full.',
  'ACCEPTANCE CRITERIA: numbered in that doc. Read them there; return a verdict PER criterion.',
  'HUMAN RULINGS, VERBATIM: ...',
  'ORCHESTRATOR SCOPING (the spec wins on conflict): ...',
].join('\n')

// The loop below BRANCHES on severity, on the actionability LANE and on the fixer's
// DISPOSITION, so all three are ENUM-LOCKED in the schemas (law 11) — never a word convention
// the seat is trusted to honour. The prose a human reads stays prose. file is REQUIRED and
// REPO-RELATIVE: a finding with no file cannot be keyed, tracked, or mechanically rechecked, and
// one in another path convention cannot be matched against what the fixer touched.
const VERDICT = {
  type: 'object',
  required: ['report', 'findings'],
  properties: {
    report: { type: 'string' },
    findings: { type: 'array', items: {
      type: 'object',
      required: ['severity', 'lane', 'file', 'claim'],
      properties: {
        severity: { enum: ['must-fix', 'should-fix', 'nit'] },
        lane: { enum: ['fixer-actionable', 'orchestrator-only', 'later-phase', 'not-a-defect'] },
        file: { type: 'string' },
        claim: { type: 'string' },
      },
    } },
  },
}
// ONE disposition per finding KEY, never prose: prose is not an answer the loop can read. A
// schema cannot express 'exactly one entry per queued key', so the loop checks that itself, in
// both directions: an unmatched answer and an unanswered key.
// touched is what the fixer says it edited, as REPO-RELATIVE paths — used only to cross-check a
// 'fixed' claim against the cited file, and recomputed from the tree wherever the runner allows
// it (law 12).
const FIX = {
  type: 'object',
  required: ['report', 'touched', 'dispositions'],
  properties: {
    report: { type: 'string' },
    touched: { type: 'array', items: { type: 'string' } },
    dispositions: { type: 'array', items: {
      type: 'object',
      required: ['key', 'disposition', 'reason'],
      properties: {
        key: { type: 'string' },
        disposition: { enum: ['fixed', 'rejected', 'blocked'] },
        reason: { type: 'string' },
      },
    } },
  },
}

// PROSE stages are accepted on a LENGTH FLOOR (law 4): it catches the turn that ended waiting on
// a backgrounded check, where that sentence became the return value.
async function robust(prompt, opts, minLen, text = r => r) {
  for (let i = 0; i < 3; i++) {
    const r = await agent(prompt, opts)
    const s = r && text(r)
    if (typeof s === 'string' && s.length >= minLen) return r
    log('sub-minimal result from ' + (opts.label || 'agent') + ', retry ' + (i + 1))
  }
  throw new Error('FAIL-FAST: ' + (opts.label || 'agent') + ' returned no usable result after 3 attempts')
}
// ARTIFACT stages are accepted on PROOF, never on length: a stage can return a long, immaculate
// ANALYSIS of the work and never create the file, and that narration clears any floor. The marker
// check is a SCRIPT-LEVEL contract check (the quality gate): the script throws, no agent is asked
// to notice. The RETRY states plainly HOW the last attempt failed rather than re-asking.
const PROOF = 'FILES-ON-DISK:'
const PROVE = [
  'Your deliverable is FILES ON DISK, not an account of them.',
  'Where the deliverable is an AUTHORED ARTIFACT it is MULTI-FILE: ONE FILE PER WRITE CALL, each',
  'under <the per-file size cap>. One large file written in a single call fails MID-WRITE at any',
  'output ceiling and leaves a TRUNCATED file rather than an error. The layout of CODE is decided',
  'by the spec and not by this rule: decomposition governs the DELIVERABLE, never the design.',
  'END your final message with the literal line ' + PROOF + ' followed by every file you wrote',
  'with its byte size, then the quoted output of the directory listing you actually ran.',
].join('\n')
async function proven(prompt, opts, minLen, text = r => r) {
  let note = ''
  for (let i = 0; i < 3; i++) {
    const r = await agent(prompt + note, opts)
    const s = r && text(r)
    // A HARD FLAG OUTRANKS THE PROOF CHECK. A correctly flagging stage stops with the tree
    // UNMODIFIED, so it owes no files: retrying it here would coerce it into building against
    // the very contradiction it was told to stop on, and the throw below would then report a
    // missing deliverable as the run's exit reason instead of the contradiction (law 10).
    if (typeof s === 'string' && s.includes('HARD-FLAG:')) return r
    if (typeof s === 'string' && s.length >= minLen && s.includes(PROOF)) return r
    // The note names the ACTUAL failure: a retry told the wrong cause is itself a false premise.
    note = '\n\nHOW YOUR PREVIOUS ATTEMPT FAILED, plainly: ' + (
      typeof s !== 'string' ? 'it returned nothing usable at all.'
      : !s.includes(PROOF) ? 'it returned an account of the work with no ' + PROOF +
        ' line, so the files were never proved to exist. An analysis of the work is not the work.'
      : 'it emitted ' + PROOF + ' but the report itself was far too short to be complete.'
    ) + ' Write the files, then END with ' + PROOF + ' and the quoted listing.'
    log('no deliverable proof from ' + (opts.label || 'agent') + ', retry ' + (i + 1))
  }
  throw new Error('DELIVERABLE PROOF: ' + (opts.label || 'agent') + ' never emitted ' + PROOF)
}
// The structural abort is the SCRIPT'S job (law 10), on EVERY CONSUMED result — never a
// downstream agent's to rediscover. Seats nothing consumes relay their flag instead (law 4).
const abortOnFlag = (r, label, s = r) => {
  if (s.includes('HARD-FLAG:')) throw new Error('HARD-FLAG from ' + label + ':\n' + s)
  return r
}

phase('Implement')
const impl = abortOnFlag(await proven(
  [PINS, SPEC, PROVE, 'Implement now.'].join('\n\n'),
  { label: 'impl', phase: 'Implement', agentType: 'implementer', model: '<explicit>', effort: 'high' },
  600,
), 'impl')

// TEMPLATE CONSTANT: the standing seats are authored HERE, once, and left alone. Retyped per
// script they erode - the quality and cleanliness lenses are the ones that silently go missing.
// Leaving the constant alone is also what keeps law 5(a) satisfied: bump an individual seat's
// prompt on resume, never this.
const SEATS = [
  ['reviewer-correctness', 'correctness'],
  ['reviewer-cleanliness', 'cleanliness'],
  ['reviewer-spec-compliance', 'spec'],
  ['duplicate-checker', 'dupes'],
]
// COLD EVERY ROUND: a re-run seat gets its SAME ORIGINAL PROMPT and judges the tree as it now
// stands — no findings history, no open list, never the fixer's report. Since the prompt is
// byte-identical across rounds, the ROUND MUST ride in the label: that is what distinguishes
// the calls, and it makes each round its own cache key so settled rounds replay free (law 5).
// SEPARATELY from that (this is about WHICH INPUT a seat gets, not about cross-round state):
// the SPEC seat is the one seat that gets NO implementer report - the seat judging the code
// against the authority document must not hold the implementer's account of what it did. Every
// other lens keeps it as a CLAIMS LIST, which is what lets a seat catch a claim that is false.
const seat = (type, label, round) => robust(
  [PINS, SPEC,
   ...(label === 'spec' ? [] :
       ['Implementer report (UNTRUSTED CLAIMS - verify every one against the code):', impl]),
  ].join('\n\n'),
  { label: 'review:' + label + ':r' + round, phase: 'Review', agentType: type,
    model: '<explicit>', effort: 'high', schema: VERDICT },
  300,
  v => v.report,
)

// THE KEY: seat + file + claim, EACH normalised the same way — lowercased, whitespace collapsed,
// line numbers stripped. Normalising only the claim would make one defect three keys, because
// seats cite files as path:line. Exact and mechanical — no fuzzy matching, no classifier seat
// deciding whether two findings are the same defect. A near-miss is a miss and a re-worded
// finding is simply new; the progress and budget exits below terminate the loop regardless.
const norm = s => String(s == null ? '' : s).toLowerCase()
  .replace(/:\d+(-\d+)?/g, '').replace(/\bline \d+/g, '').replace(/\s+/g, ' ').trim()
const keyOf = (seatLabel, f) => [norm(seatLabel), norm(f.file), norm(f.claim)].join(' | ')
// The cited file and the touched file come from two different authors, so compare them
// normalised, and tolerate one side carrying a longer prefix — a raw === here false-negatives on
// every genuine fix the moment one author writes an absolute path (PINS pins repo-relative).
const samePath = (a, b) => {
  const x = norm(a), y = norm(b)
  return x.length > 0 && y.length > 0 && (x === y || x.endsWith('/' + y) || y.endsWith('/' + x))
}

// Adversaries launch ONCE, alongside the first fix, and are NEVER awaited before it — the fix
// stage is forbidden to receive them, so barriering on them is pure wall-clock waste (law 6).
// Cold-alternatives gets the SPEC (it must name the invariants a simpler shape still honors)
// but never the implementer's report. Their failure is caught, not thrown: nothing downstream
// consumes them, so a dead seat costs the human one report and must not kill a finished fix.
const relay = p => p.catch(e => 'ADVERSARY SEAT FAILED: ' + e.message)
let adversaries = null
let reviews = null
let fix = null
let round = 0

// ALL CROSS-ROUND STATE LIVES HERE: the script is the only component that sees more than one
// round, so it is the only one that reasons about them. No agent is asked to remember anything.
const BUDGET = 3              // BACKSTOP only — never the convergence criterion
const ledger = new Map()      // key -> { seatLabel, finding, file, rounds: [], attempted, ... }
const retired = new Map()     // key -> why it LEFT the loop, for the REST OF THE RUN (human route)
const unanswered = []         // queued keys the fixer never answered: silence IS visible
const contradictions = []     // 'fixed' claimed on a file the fixer never touched
let exit = 'budget spent: ' + BUDGET + ' rounds and the queue never emptied'

// ONE fix pass, callable with an EMPTY queue. The fix pass is never droppable: it is the only
// seat that produces the PROOF BAR (suite green plus a per-criterion status), so a run whose
// first review finds nothing fixer-actionable still owes one pass to prove it.
const fixPass = (queue, round) => robust(
  [PINS, SPEC,
   'The adversary reports go to the human, NOT to you. Triage ONLY the keyed findings below.',
   'Each is a HYPOTHESIS (UNTRUSTED): re-verify it against the code before acting.',
   'Answer EVERY key with ONE disposition - fixed / rejected / blocked - plus the reason.',
   'rejected and blocked are PERMANENT: they leave for the human and no later round revisits them.',
   'A fix that needs a SPEC edit is orchestrator-only: disposition it blocked, never apply it.',
   'A BLOCKED defect leaves a TRACE WHERE THE WORK LIVES - a pinned or explicitly-skipped test',
   'naming the disagreement - not only a line in a report, which nobody reading the code will see.',
   'A fix BROADER than the spec is yours to make - breadth, never a redesign - and SAY SO, so the',
   'spec-compliance finding it causes routes to the orchestrator instead of back to you.',
   'No reviewer reads explanations, so every fix must be self-explanatory IN THE TREE.',
   'Each key below is restated as the DEFECT, its EVIDENCE, and WHAT NOT TO TOUCH. Honour the',
   'third part literally, and confirm in your report that any OPEN DECISION named as not yours',
   'went untouched.',
   'List every file you touched as a REPO-RELATIVE path in touched.',
   'End with a PER-CRITERION status plus the verbatim suite/build output, from a BARE RERUN AFTER',
   'YOUR LAST WRITE: a tail from before that edit is not evidence, and a pipe through head or grep',
   'hides the failure.',
   queue.length === 0 ? 'NO finding survived triage this round: your job this pass is the PROOF.' : '',
   ...queue.map(f => 'KEY ' + f.key + '\nDEFECT [' + f.severity + '] ' + f.file + ' - ' + f.claim +
     '\nEVIDENCE: the raising seat report below, re-verified by you against the code.' +
     '\nDO NOT TOUCH: anything this key does not name.'),
   ...reviews.map((v, i) => 'Verdict seat [' + SEATS[i][1] + '] report (UNTRUSTED context):\n' + v.report),
  ].join('\n\n'),
  { label: 'fix:r' + round, phase: 'Fix', agentType: 'fixer', model: '<explicit>',
    effort: 'high', schema: FIX },
  400,
  r => r.report,
)

while (round < BUDGET) {
  round++
  phase('Review')               // genuine barrier: the fixer needs all four
  reviews = (await Promise.all(SEATS.map(([type, label]) => seat(type, label, round))))
    .map((v, i) => abortOnFlag(v, 'review:' + SEATS[i][1], v.report))

  if (round === 1) {
    phase('Adversaries')        // both standing seats are HUMAN-ROUTE: relayed, never the fixer's
    adversaries = Promise.all([
      relay(robust([PINS, SPEC, 'Roast this diff.'].join('\n\n'),
        { label: 'adv:roaster', phase: 'Adversaries', agentType: 'roaster', model: '<explicit>', effort: 'high' }, 300)),
      relay(robust([PINS, SPEC, 'The diff and the invariants only. No implementer report, by design.'].join('\n\n'),
        { label: 'adv:alternatives', phase: 'Adversaries', agentType: 'cold-alternatives', model: '<explicit>', effort: 'high' }, 300)),
    ])
  }

  // PARTITION BY WHO CAN CLOSE IT. Only fixer-actionable must-fix findings may hold the loop
  // open; every other lane is ledgered, routed OUT once, and re-routed silently on recurrence.
  const queue = []
  for (const [i, v] of reviews.entries()) {
    for (const f of (v.findings || [])) {
      const key = keyOf(SEATS[i][1], f)
      const e = ledger.get(key) ||
        { seatLabel: SEATS[i][1], finding: f, file: f.file, rounds: [], attempted: false }
      e.rounds.push(round)
      ledger.set(key, e)
      if (retired.has(key)) continue                  // a cold seat re-raised it: no re-queue
      if (f.lane !== 'fixer-actionable') { retired.set(key, 'lane ' + f.lane); continue }
      if (f.severity !== 'must-fix') continue         // collected and reported, never blocking
      if (e.attempted) {                              // STUCK: recurred after a fix attempt
        retired.set(key, 'stuck: recurred after a fix attempt, rounds ' + e.rounds.join('+'))
        continue
      }
      queue.push({ key: key, severity: f.severity, file: f.file, claim: f.claim })
    }
  }
  // Empty queue is the CLEAN exit: nothing fixer-actionable and must-fix is left to attempt.
  // Anything retired above is escalated in routedOut, not silently counted as convergence.
  if (queue.length === 0) { exit = 'queue empty: no fixer-actionable must-fix finding to attempt'; break }

  phase('Fix')
  const fixResult = await fixPass(queue, round)
  fix = abortOnFlag(fixResult, 'fix:r' + round, fixResult.report)
  const touched = fix.touched || []

  // CHEAP MECHANICAL CHECK, no seat needed: a finding whose cited FILE was never touched is
  // trivially unresolved, and 'fixed' on an untouched file is a CONTRADICTION — escalated and
  // recorded in the result, never re-reviewed and never counted as progress. Paths are compared
  // through samePath, so a convention slip cannot false-negative a genuine fix into a stuck key.
  const answered = new Set()
  let progress = 0
  for (const d of (fix.dispositions || [])) {
    const e = ledger.get(d.key)
    if (!e) { log('fixer answered a key no seat raised: ' + d.key); continue }
    if (answered.has(d.key)) { log('second disposition for ' + d.key + ': the first one stands'); continue }
    answered.add(d.key)
    e.attempted = true
    e.disposition = d
    if (d.disposition !== 'fixed') {
      retired.set(d.key, d.disposition + ': ' + d.reason)  // rejected/blocked leave, permanently
      continue
    }
    if (!touched.some(t => samePath(t, e.file))) {
      contradictions.push({ key: d.key, file: e.file, round: round })
      retired.set(d.key, 'contradiction: fixed claimed, but ' + e.file + ' is not in the touched set')
      continue
    }
    e.closed = true
    e.closedRound = round
    progress++
  }
  // SILENCE ON A KEY IS VISIBLE, and it is not a disagreement: record it rather than infer one.
  for (const q of queue) if (!answered.has(q.key)) unanswered.push({ key: q.key, round: round })
  // EXIT ON PROGRESS: a round that closed nothing is a disagreement, not a defect, and another
  // round has no new information to bring. Unanswered queue items count as no progress.
  if (progress === 0) { exit = 'a round closed nothing: disagreement, not a defect'; break }
}
// NEVER DROPPABLE: if no queue ever formed, the fixer still owes the proof bar for this tree.
if (!fix) {
  phase('Fix')
  const proof = await fixPass([], round)
  fix = abortOnFlag(proof, 'fix:r' + round, proof.report)
}
// Whatever is open at exit is REPORTED, never force-fixed. routedOut is the human's route, each
// entry carrying WHY it left: a spec edit for the orchestrator, a later phase's work, a
// rejection, a block, a contradiction, or a stuck key. Non-blocking severities ride along,
// reported not fixed. On the BUDGET exit the last round's fixes are returned as an explicit
// UNVERIFIED set, because no cold round ever saw them — an unknown stated, never omitted.
return {
  impl, reviews, fix, adversaries: await adversaries, rounds: round, exit,
  open: [...ledger].filter(x => !retired.has(x[0]) && !x[1].closed)
    .map(x => ({ key: x[0], ...x[1].finding })),
  routedOut: [...retired].map(x => ({ key: x[0], why: x[1] })),
  unverified: exit.indexOf('budget spent') === 0
    ? [...ledger].filter(x => x[1].closedRound === round).map(x => x[0]) : [],
  unanswered, contradictions,
}
```

### The backtick hazard — the single most common launch failure

Build every prompt as an **array of plain-quoted strings joined with newlines**, with **NO
backticks anywhere in the text**. The script is parsed as JS: one stray backtick inside a template
literal closes it early and the whole launch dies with an opaque token error far from the real
line. The array-join convention eliminates the entire class. (This constraint is about the workflow
*scripts* — backticks in this markdown are fine.)

### Accepting a stage result — PROOF for an ARTIFACT, a LENGTH FLOOR for PROSE

Two acceptance checks. What a stage OWES decides which one DECIDES its acceptance; the length floor
rides on every stage regardless, because it is cheap and it catches a failure the marker cannot.

**ARTIFACT-PRODUCING STAGES MUST PROVE THE ARTIFACT.** A stage whose deliverable is files on disk
ends with a literal MARKER LINE (`FILES-ON-DISK:` in the skeleton) naming those files and their
BYTE SIZES, plus the quoted output of the directory listing it actually ran. **The SCRIPT throws
when the marker is absent** — a script-level contract check, per the quality gate above.

**A length floor structurally cannot prove an artifact**, and this is not a hypothetical: a stage
can produce a long, immaculate ANALYSIS of the work and never create the file, and the narration
clears any floor by a wide margin — a floor measures prose, and prose is exactly what the failure
produces. Recompute from the artifact instead (law 12); the stage's own account of itself is a
truncation-and-dishonesty detector, never evidence.

**A retry after this failure states plainly HOW the previous attempt failed** — that it returned an
account of the work with no marker and no file — rather than re-sending the same instruction and
hoping. The second line of defense is downstream: **COLD seats refuse to fabricate a review against
an artifact that is not there**, and say so, which is what surfaces a fabricated deliverable when
the acceptance check is the thing that failed.

**PROSE STAGES ARE ACCEPTED ON THE LENGTH FLOOR** — a review, a verdict block, a report, anything a
human reads next. `minLen` in `robust()` is what accepts them, and it is the concrete implementation
of law 4: agents sometimes end a turn with "waiting for the check to finish" — **that sentence
becomes the return value**, and it is a perfectly valid non-null string. A per-stage floor catches
it; the retry usually lands; three misses throw the run instead of flowing garbage forward.

**An ARTIFACT stage carries the floor TOO — under its marker, never instead of it.** The two checks
answer different questions (did anything come back at all / does the deliverable exist), so
`proven()` requires both and the artifact stage still gets a band. Rough bands: implementers
**400–800**, reviewers and adversaries **200–400**, fixer **~400**.

Set each floor BELOW the shortest *legitimate* deliverable for that seat. A clean reviewer still
owes a per-criterion verdict block with receipts, and a cold-alternatives seat that finds nothing
still owes why the obvious simpler shapes fail — both clear 200 comfortably. If a floor ever kills
a genuinely complete short answer, the floor was wrong, not the agent: lower it, do not delete the
mechanism.

### Deliverables must be DECOMPOSABLE

Specify a deliverable as **MULTI-FILE OUTPUT — one file per write call, with a stated per-file size
cap** — never as one large artifact written in a single call. Every model has an output ceiling, and
a single-call artifact sized near it fails **MID-WRITE**: what lands is a TRUNCATED file rather than
an error, so nothing downstream can distinguish a finished deliverable from half of one, and the
retry machinery above never fires because the stage did not fail. This is a rule about the SHAPE of a
deliverable — it is not a property of any particular model, and a deliverable that only works below
some ceiling is a latent failure waiting for the run that sits above it.

### Threading stage outputs into later prompts

The prompt is the ONLY channel between stages. Thread outputs in **explicitly**, each block
LABELLED for what it is, and marked UNTRUSTED where it is:

```js
const fixPrompt = [
  PINS,
  SPEC,
  'Implementer report (UNTRUSTED input — verify everything against the code):',
  impl,
  'Findings to triage, one KEY each, restated as DEFECT + EVIDENCE + WHAT NOT TO TOUCH. Each is a',
  'HYPOTHESIS, not a ruling — re-verify before acting, and answer EVERY key with one disposition:',
  'fixed / rejected / blocked, plus the reason:',
  ...queue.map(f => 'KEY ' + f.key + '\nDEFECT [' + f.severity + '] ' + f.file + ' — ' + f.claim +
    '\nEVIDENCE: the raising seat report below, re-verified by you against the code.' +
    '\nDO NOT TOUCH: anything this key does not name.'),
  ...reviews.map((v, i) => 'Verdict seat [' + SEATS[i][1] + '] report (UNTRUSTED context):\n' + v.report),
].join('\n\n')
```

Label each block by the SEAT it came from, not just "reviews" — the fixer's disposition table has to
name which seat raised what, and a rejection is only auditable if the reader can trace it back. The
KEY rides with each finding for the same reason: the script matches dispositions back to findings by
key, so a disposition that answers no key, and a key nothing answered, are both detectable — and the
loop must actually check BOTH directions and record what it finds, or "detectable" is a property of
the design that no code exercises.

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
or wrap each thunk in `robust()` when a missing result must kill the run instead of silently
vanishing from the set.

### Schema vs plain text

Use the `schema` option when a later stage **branches** on the output (validated, retried on
mismatch). Use plain text plus a length floor when a **human** reads it next. Adversary reports are
text — only a person reads them.

The verdict seats and the fixer are **both at once, and that is the point**: the script branches on
the seats' severity and lane, and on the fixer's per-key disposition, to decide whether another round
runs — so each returns a schema object with enum-locked machine fields *and* a free-prose `report`
field carrying the per-criterion verdicts and receipts. Prose where a human reads, enum where the
script switches — do not make one field do both jobs. The length floor then applies to the prose
field, not to the object. The findings array is **defects only**: everything a human reads and nothing
branches on — verdict rows, coverage notes, what was run — belongs in `report`.

**And ENUM-LOCK the vocabulary the script branches on (law 11).** If the fix phase fires on
`must-fix`, that word is an enum in the schema with validation-retry — not a convention you hope the
seat honours. A seat that says "high" where the check greps "must-fix" disables the phase silently and
the run still reports success.

### The PINS constant

This content must ride EVERY agent, verbatim, not paraphrased:
- **The authority hierarchy** (law 8) — human verbatim directives > the spec, named by PATH and read
  from disk > this prompt, explicitly UNTRUSTED. Name the AUTHORITY DOCUMENTS as the first two and
  say plainly that the prompt is not one, or the next bullet has no boundary.
- **Hard-flag semantics** (law 10) — the marker, and the rule that it is ONLY for a contradiction
  between authority documents. Spell out the counter-cases too, since they are the common ones: a
  tree that does not yet satisfy the spec, a prompt that conflicts with the spec, and a prompt
  premise the tree contradicts all yield ordinary must-fix findings, never a flag.
- **Premise verification** (law 8) — every factual claim the prompt makes about the tree is
  **VERIFIED against the tree** before anything is built on it, and a false one is
  **VERIFIED-AND-REPORTED**: build to the true state, flag the premise as a must-fix. Say this
  explicitly, or "untrusted" degrades into "ignored" and the seat builds against nothing at all.
- **Git — READ-ONLY BY INTENT, then the verbs.** State the INTENT first: the agent does not change
  what git records or which commit the tree sits on, **by any means, named or not**. Then the verbs
  as ILLUSTRATION — `stash`, `checkout`, `reset`, `restore`, `clean`, `commit`, `rebase`, `merge`,
  `cherry-pick`, branch and worktree switching — with `status`, `diff`, `log`, `show` allowed. And
  say plainly that **an enumerated list ROTS, so the intent governs**: a seat handed only a verb
  list will rebase a live tree the day the list omits `rebase`, and it is obeying its pin as
  written. The companion rule rides on every concurrent seat, because it is what surfaces the
  breach: **a tree MOVING UNDERNEATH a seat is an ANOMALY to report verbatim, never to work
  around.** Agents on a real shared tree WILL try to be helpful with git.
- **Scratch directory** — where temp files go (a gitignored cache dir), never a global temp the
  user must approve.
- **Run checks BARE** — never piped through `head`/`grep`, which hides the error you needed.
- **No background waits** — never end a turn waiting on a backgrounded check; the final message IS
  the deliverable.
- **Abort on contradiction, one trigger only** — two authority documents that cannot both be true.
  Everything else (the prompt losing to the spec, a false prompt premise verified and reported, a
  tree that does not yet satisfy the spec) is an ordinary must-fix finding and the seat proceeds;
  see law 10.
- **The findings contract** — a finding is a DEFECT, it cites a **repo-relative** FILE, and it names
  WHO CAN CLOSE IT (the four actionability lanes, spelled out). This rides in `PINS` and not only in
  the seat templates because the loop's termination depends on it: a non-defect or a file-less item in
  the findings array is exactly what holds the loop open, and a file cited under some other path
  convention breaks the one check that needs no seat.
- **The review surface is THE CHANGE** and what it touches, never the whole product or already-landed
  work — an unbounded surface yields new findings forever (see the loop in phase 4).
- **No seat edits an authority document** (law 15) — a fix that requires a spec edit is reported as
  orchestrator-only. Only the orchestrator edits a spec.

Keeping these in one constant is a deliberate trade-off: editing `PINS` busts every cache key. That
cost is accepted so no stage's copy of the house rules can drift from another's.

Some of these (no background waits, abort on contradiction) also appear in the `agents/` templates.
That overlap is **deliberate reinforcement, not a second source of truth**: the template is the
authority for that role, `PINS` is the floor every role gets even when a project swaps in its own
template. Changing a rule means changing both — they are prompt text, and a prompt rule an agent
sees twice is cheap; a prompt rule it sees nowhere is a defect.

### The fixer's prompt must NAME its inputs

Spell out which blocks the fixer may act on: *"the adversary reports go to the human, NOT to you."*
Without that line the fixer helpfully applies the human-route seats' opinions, and the classifier step
that made those seats safe to run is silently lost. Naming the inputs is how the defect-class routing
of phase 3 is actually enforced — otherwise it is a paragraph, not a rule.

Two more lines belong there, both load-bearing for termination. **The fixer acts on the KEYED queue,
not on the raw findings array** — the verdict seats' prose reports still ride along as labelled
UNTRUSTED context, because that is where the receipts are, but nothing in them is a work item unless
it arrived as a key — and it owes exactly one disposition per key, the script matching them back by
key so that silence on a key is visible. And **the fixer may not edit the spec or any other authority
document** (law 15): a finding whose fix is a spec edit comes back `blocked` with its evidence, for the
orchestrator to disposition. Without that line the fixer edits the spec to make a finding go away, and
the run's only authority ends up written by the agent it was supposed to constrain.

## Agent prompt templates (verbatim base, append-only)

Every NAMED role this skill spawns has a fixed prompt template in `agents/` — `agents/implementer.md`,
`agents/reviewer-correctness.md`, `agents/reviewer-cleanliness.md`,
`agents/reviewer-spec-compliance.md`, `agents/duplicate-checker.md`, `agents/roaster.md`,
`agents/cold-alternatives.md`, `agents/fixer.md`, plus `agents/gap-finder.md` for the cold spec-review
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

- **Never droppable:** the implementer, the fix pass, and at least one correctness verdict seat.
  Any run without those isn't this workflow.
- **Droppable on a tightly-scoped change:** the duplicate checker (when the change adds no new
  decision path), the cleanliness seat (when the diff is a handful of lines in one file), and both
  adversary seats (they pay off on shape-setting work, not on a one-file fix).
- **Never drop spec-compliance when a written spec exists** — it is the cheapest insurance against
  the failure that the other seats structurally cannot see, because they check the code against the
  prompt.
- Reserve wider fan-out for genuine breadth (many independent sites), not for reassurance.

**The escape hatch: a targeted patch.** The full composition carries a roughly FIXED overhead per
increment — worth paying for an increment, absurd for a three-file fix. For those, drop out of the
composition entirely rather than running a thinned version of it: **ONE agent in an ISOLATED GIT
WORKTREE** (create it manually with `git worktree add` if the runner cannot), the gates run **inside
that worktree**, and the orchestrator **inspects the result itself** — reads the diff, looks at the
actual output — before merging. Same-day fixes land this way that the full composition would have
made overnight ones.

Two rules that come with it:
- **Never run two tree-mutating workflows in one repo at once.** They interleave writes and neither
  run's gate result means anything afterwards. Worktree-isolate one of them.
- **When the human says stop, stop AT A PHASE BOUNDARY** — let the in-flight fix record, then stop —
  so the tree is left landable rather than half-edited. Then record what never ran as an **explicit
  unknown** ("round 3 did not run; its findings are unknown"), never by silently omitting it. An
  absence presented as a completed run is a lie the next reader cannot detect.

## Authoring notes

- The implementer and fixer must NOT commit or push — the workflow leaves the tree dirty for the
  human to review and commit. Tell every agent this explicitly.
- Tell agents where scratch files go (a gitignored cache dir), never a global temp the user must approve.
- Relay the cold spec-review findings (with the spec amendments they caused), the implement summary,
  each review verdict, the adversary reports, and the fix result back to the user — and keep the
  adversary reports clearly separated as *the human's* to act on. The agents' output is for you, not
  them; surface what matters.
- A project may carry its OWN scoped copy of this skill with environment specifics (test command,
  isolation quirks, the local model floor, the must-read architecture doc). When present, that scoped
  copy wins for that project.
