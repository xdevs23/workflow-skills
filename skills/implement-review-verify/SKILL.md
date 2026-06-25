---
name: implement-review-verify
description: Implement a CODE change (not a doc) through a structured workflow — one sequential implementer, then independent adversarial reviewers split by concern, then a fix pass that triages findings and proves the suite green (verifying is how it knows what to fix; fixing is the outcome). Use when a code change is coupled/risky enough to warrant review before committing (touches shared infra, has subtle invariants/ordering/concurrency, or the user asks to "use a workflow" / "with reviewers"). Pairs with verify-loop (this implements + reviews code; verify-loop proves a document's claims). NOT for one-off mechanical edits or pure research.
---

# Implement → Review → Fix — a workflow for code changes

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

## The shape

Three phases. **Settle the design BEFORE phase 1** — the implementer builds against a decided
design, it does not invent scope. If the design isn't settled, stop and settle it with the user
(or run a design/research loop) first.

### Phase 1 — Implement (1 agent, sequential)

ONE implementer, working sequentially on the real tree. One agent — not a fan-out — because a
coupled change mutates shared files and parallel writers collide. Brief it with:
- **what is already on disk** (if part of the work exists), file by file, told to REUSE not rebuild;
- the **settled design** and its decisions, stated as authoritative;
- the **invariants** in plain language (the ordering rule, the idempotency rule, …);
- a **self-check**: run the relevant test subset before reporting done, and FIX what it added that fails.

It reports what changed, file by file, plus the test result.

### Phase 2 — Review (N agents, parallel, split BY CONCERN)

Independent reviewers, run in parallel, each owning a DISTINCT lens so they don't overlap. The
default split that pays off:
- **Correctness** — bugs, races, broken invariants, the failure modes the change introduces.
  Prompt it to hunt the specific hazards (the dedup race, the ordering guarantee, the retry path)
  AND to say plainly "I found nothing" rather than invent issues.
- **Separation of concerns / cleanliness** — does logic sit in the right layer? Did a special-case
  leak into shared/generic code? Dead code left by the rework? Naming. (NOT bugs — that's the
  other reviewer's job.)

Two sharp, non-overlapping reviewers beat five that all re-scan the whole codebase looking for the
same things. Add a third lens (security, performance) only when the change actually has that
surface. Each reviewer returns concrete `file:line` findings, each rated **must-fix / should-fix / nit**.

### Phase 3 — Fix (1 agent)

ONE agent that receives both reviews, **triages every finding** (applies the ones it agrees with;
for any it rejects, says *why* — a finding can be wrong), then **proves the result**: runs the FULL
test suite and any build, and reports the real numbers. It must be honest — if something still
fails, it says so with the output, it does not paper over it.

This phase is where the review earns its keep: a good correctness reviewer often finds a bug whose
*correct* fix is broader than the original spec (e.g. "re-run on any terminal state", not just
"on completed"). The fixer is trusted to make that call and document it.

## Why this shape (the rationale that makes it work)

- **Sequential implement, parallel review.** Implementation has write-conflicts; review is
  read-only and independent — so the parallelism goes in the review phase, not the build.
- **Reviewers split by concern, not by file.** A correctness lens and a cleanliness lens find
  different classes of problem; pointing both at "review everything" wastes them on overlap.
- **Adversarial correctness review is the point.** Brief the correctness reviewer to *try to break*
  the change — name the hazards and ask "is this actually wrong?". That's what catches the
  plausible-but-broken implementation that tests written by the implementer won't.
- **The fix phase triages, doesn't rubber-stamp.** A finding is a hypothesis, not a verdict. The
  fixer decides, applies the fix, and re-proves — closing the loop with real suite output, not a claim.

## Model assignment

Set an EXPLICIT model on EVERY agent/stage — never inherit or default (a custom agentType or a
resume can silently resolve to the cheapest tier). General rule unless a project overrides it:
**implementation/coding → the strongest available coding model; review/research/explore → a mid
tier is fine; never the cheapest tier.** Match the project's own stated model policy if it has one.

## Don't over-fan

Scale to the change. A tightly-scoped fix: 1 implement + 1 correctness review + 1 fix. A broad,
risky change: 1 implement + 2 reviewers + 1 fix (the default above). Reserve wider fan-out for
genuine breadth (many independent sites). More agents re-reading the same code is cost, not rigor.

## Authoring notes

- The implementer must NOT commit or push — the workflow leaves the tree dirty for the human to
  review and commit. Tell every agent this explicitly.
- Tell agents where scratch files go (a gitignored cache dir), never a global temp the user must approve.
- Relay the implement summary + each review + the fix result back to the user; the agents' output
  is for you, not them — surface what matters.
- A project may carry its OWN scoped copy of this skill with environment specifics (test command,
  isolation quirks, the local model floor, the must-read architecture doc). When present, that scoped
  copy wins for that project.
