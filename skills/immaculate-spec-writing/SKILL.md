---
name: immaculate-spec-writing
description: Prepares a thoroughly researched spec or design document checked for both factual accuracy and completeness before implementation.
---

# Immaculate Spec Writing — research, complete it, prove it, until it converges

**Load the `writing-style` skill first.** It binds every comment, document, commit message and
reply this skill produces, and it is not optional when working with this plugin.

The conductor skill. It **orchestrates three independently-usable sub-skills** into a single loop
that drives an artifact to the only standard that prevents downstream bug-hunting: **everything
stated is true, and nothing required is missing.**

- **research-loop** — discovers the answer and drafts the doc (triangulated, evidence-tagged).
- **find-gaps** — the sins-of-omission audit: what *should* be in the doc but isn't.
- **verify-loop** — proves every claim that *is* in the doc is true against ground truth.

Each is invocable on its own. This skill chains them and closes the loop between the last two so the
artifact converges on **factual ∧ complete**, not just one of the two.

Use when the user asks for the maximum: "make this spec immaculate", "100% factual and complete",
"I don't want to bug-hunt this later", "research it fully and prove it", before relying on or
implementing the result. It is **read-only / documentation-producing** — it writes and proves the
spec; it never implements. Implementation is always a separate, explicitly-approved step.

## The two orthogonal axes (why three skills, not one)

A spec can fail two independent ways:

- **Incorrect** — a claim that is present but wrong. Caught by **verify-loop**.
- **Incomplete** — a requirement that is absent entirely. Caught by **find-gaps**.

verify-loop is blind to absence (it only checks what's written); find-gaps is blind to incorrectness
(it only checks what's missing). You need both, and you need them to *interact*: closing a gap adds new
prose, which is new claims, which must then be verified — and verifying can expose that a "fact" was
actually an unstated assumption, which is a gap. So the two are looped together until neither finds
anything new. research-loop seeds the loop with a drafted, already-evidence-tagged starting artifact so
the loop converges fast instead of building from nothing.

## The token-cost rationale (state it to the user)

This skill is deliberately expensive — multiple fan-out workflows, looped. That is the point: the
alternative is shipping a spec with a silent gap or a wrong fact and paying for it in **multiple
sessions of bugfixing**, re-deriving the same fact under worse conditions (mid-incident, in
implementation, with a half-built system). Front-loading the tokens into a proven, complete spec is
the cheaper path for anything that will actually be built. Use it when the artifact is load-bearing;
for a throwaway note, just use the sub-skills directly.

## Inputs to establish first

- **The question/goal** and the **output doc path** (research-loop's inputs).
- **The private directive record** — the user's verbatim decisions the spec must describe, with
  their surrounding qualifications and context, since those give a directive its meaning. Point
  the loop at it the same way ground truth is pointed at; never copy it into the tracked artifact.
  A necessary directive cannot be omitted from that record because it seems minor; keep factual
  research findings distinct from the decisions the record actually establishes. It vetoes the
  draft: a directive it contradicts is a conflict to flag to the user, not evidence for a different
  decision. If no such record applies, say so explicitly rather than silently treating none as
  none needed.
- **What the tree already says about the work** — five answers established before any drafting
  starts: whether the thing is already implemented; what already exists that the work can build
  on; what needs refactoring before the work can sit on it; what the work conflicts with; and how
  the applicable rules shape it. Every answer comes from reading the codebase and the rules. An
  answer from memory is the one that makes a spec describe a system nobody has.
- **The artifact's stated scope** — the fence for find-gaps (extracted from the draft once it exists).
- **Ground truth** — codebase + dirs, reference docs, external sources; what both find-gaps and
  verify-loop cite against. Point every agent at the real source, never memory.
- **Fleet sizing & models** — sonnet floor for research/find/verify, opus for synthesis and the
  hardest reasoning. NEVER haiku. Explicit `model` on every agent in every sub-skill.
- **Implementation is OUT of scope** and gated — confirm the user knows this produces a spec, not code.

## Output format — one authored YAML spec

Write the unit spec to `.cache/specs/<unit>.yaml`, ignored and untracked because it contains
verbatim user words. The tracked document under `docs/` is generated from that YAML. Edit the YAML
and regenerate after every amendment, keeping the source and its rendering together.

`tools/check-spec.ts` defines the validation contract; the committed, synthetic example at
`tests/fixtures/spec-provenance/valid.yaml` is exercised by the tests. The top-level mapping has
`unit`, `summary` (Markdown, the preamble of the generated document) and a non-empty `items` list. Each item has a unique kebab-case `id`, a `kind` (requirement,
criterion, rejected or boundary), non-empty Markdown `content` stating one decision or requirement,
and `source`. A rejected item also has `reason`. Use exactly the fields of its source kind:

- **transcript:** `evidence`, a non-empty list of `{ file, line, uuid }` pointing to user records in
  the supplied session directory, and `user_words`, verbatim text in at least one resolved message.
- **rule:** `rule: { file, line }` and `quote`, matching the rule's words across hard-wrapped lines.
- **observation:** `observation: { command, exit, output, date }`, recording a fact observed here.
  Use a read-only command that the provenance reader can repeat and compare against output and exit.
- **derivation:** `parents`, a non-empty list of item ids whose chains reach a sourced item.

An assertion that a condition, failure mode or risk exists needs source transcript or observation.
A hypothetical hazard stays a finding until an observation establishes it in this environment.
A derivation that mandates a mechanism states the simpler alternative it rules out in content,
and its parents include the transcript item asking for it or the observation showing that simpler
route failing. Trace ordinary derivations to existing decisions; new decisions remain the user's.

Run `bun tools/check-spec.ts .cache/specs/<unit>.yaml --transcripts <session-dir> --render docs/<unit>.md --json`.
It validates references and renders technical content, omitting private quotations and evidence.
Keep each criterion as a criterion item: the tool numbers them from one in file order and supplies
`{ ordinal, id }` plus `counts.kind.criterion` for the implementation workflow's integer ordinals and
`args.criteriaCount`. Before either spec review or implementation, validation must pass. Before
implementation use `--check-render docs/<unit>.md` to fail on a stale rendering. The provenance reader
judges whether the sources authorize the items before implementation.

## The convergence loop

### Phase 0 — Research & draft (run `research-loop`)
Invoke **research-loop** on the question. It triangulates (context-free decomposition + same-prompt
breadth), you synthesize, it does its single doc-review pass. Output: a drafted, evidence-tagged
artifact at the output path. This is the loop's seed — already sourced, not a blank page.

### Phase 1 — Find gaps (run `find-gaps`)
Invoke **find-gaps** on the draft, fenced to its stated scope. Output: a prioritized, evidence-backed,
severity-graded gap list (MUST-FIX / SHOULD-ADD / NICE).

### Phase 2 — Fold gaps in (you, with the user's scope decisions)
For each MUST-FIX gap and each accepted SHOULD-ADD: edit the artifact to **close the gap** — add the
missing spec, or convert silence into an explicit, honest "cannot determine → omit / label honestly".
Some gaps expand scope (new API, new contract); those are **user decisions** — surface them and let the
user choose how far to extend (don't silently grow the spec). The user owns the artifact; you edit it
informed by the evidence. A fold you make unilaterally must be an ordinary derivation from an
existing decision, never a new product, architecture, persistence, security or operational choice —
those, and any point where the draft or a proposed fold would contradict a recorded user directive,
are surfaced to the user instead of resolved by editing around them.

### Phase 3 — Verify everything (run `verify-loop`)
Invoke **verify-loop** on the now-expanded artifact. It proves **every** claim — including every byte
you just added to close a gap — against ground truth with an identical-prompt fleet, reconciles to
unanimous-or-defect, researches defects, you fix, it re-verifies. verify-loop has its own internal
loop to its own convergence (unanimous ALL_IMMACULATE, zero hedges, agreeing evidence).

### Phase 4 — Close the outer loop (the convergence test)
A single pass of (find-gaps → fold → verify-loop) almost always surfaces *new* material: closing a gap
introduced claims that needed proving; proving claims exposed an assumption that is itself a gap. So
**repeat Phases 1–3**. The outer loop exits **only** when one complete pass satisfies BOTH:

- **find-gaps returns zero new MUST-FIX/SHOULD-ADD gaps** (only NICE or clean), AND
- **verify-loop returns unanimous ALL_IMMACULATE** with zero hedges and agreeing evidence.

If either finds something, fold/fix it and loop again. Both-clean-in-one-pass is the bar. Do not
declare done because one axis is clean while the other still moves — that is exactly the
incorrect-XOR-incomplete failure this skill exists to prevent.

**When a CATEGORY of finding recurs, fix the doc's SHAPE — don't keep looping the same patch.** If the
same *type* of gap or defect keeps surfacing across outer passes (same section, same kind of
statement), the recurrence is telling you the doc is structured wrong, not that you need another cycle.
The default instinct must be **restructure the doc or do more research** — not "one more pass." E.g.
design-judgment / incident-narrative content that verify-loop keeps flagging as "unsourced" should be
moved into a clearly non-normative appendix so the normative body is fully sourced; an UNCERTAIN
premise that keeps re-surfacing should be researched to a PROVEN, sourced claim. ~10 outer iterations
is plenty; if it hasn't converged by then, change the doc's structure rather than grinding more cycles.

```
research-loop ──▶ [ find-gaps ──▶ fold gaps ──▶ verify-loop ──▶ fix ] ◀─loop─┐
                         │                                          │         │
                         └──── any new gap OR any defect ───────────┴─────────┘
                                            │
                          zero new gaps AND zero defects in one full pass
                                            ▼
                                   immaculate spec (factual ∧ complete)
```

## Non-negotiable principles (inherited from the sub-skills, enforced here)

1. **Both axes must converge in the SAME pass.** Factual-but-incomplete and complete-but-wrong are
   both failures. Exit only when one pass is clean on both.
2. **Every folded-in byte is re-verified.** Gaps closed in Phase 2 are new claims; Phase 3 proves them.
   Never fold-in-and-ship without the following verify pass.
3. **Evidence-tagged / evidence-backed throughout.** research-loop tags findings; find-gaps cites
   gap-evidence; verify-loop cites per-claim evidence — for passes too. No hedging as fact anywhere.
4. **Scope decisions are the user's.** When a gap implies expanding scope (new API/field/contract),
   surface it and let the user choose; don't grow the spec unilaterally.
5. **You orchestrate; agents don't decide.** You read sub-skill outputs, make the synthesis/fold
   judgments, and own the artifact. Sub-agents return findings/verdicts, not decisions. A synthesis
   or fold judgment may only describe an existing user decision or an ordinary derivation from
   one; it never installs a new product, architecture, persistence, security or operational choice
   as settled scope, and a draft or fold that contradicts a recorded directive is flagged to the
   user rather than written around.
6. **Read-only; implementation is separate and gated.** This produces a proven, complete spec. Writing
   code against it requires a distinct explicit go from the user.
7. **Explicit models, sonnet floor, never haiku** — in every sub-skill, every stage.

## Reporting each outer cycle
After each outer pass report: gaps found this pass (by severity) and how each was folded in or
deferred; verify-loop's per-claim result (immaculate count + each defect and its fix); and the
convergence state — "find-gaps: clean; verify-loop: 2 defects → fixed → re-verifying" — so the user
sees both axes moving toward the joint exit bar, not just a final verdict.

## Relationship to the sub-skills
This skill **invokes** `research-loop`, `find-gaps`, and `verify-loop` — keep them as separate skills;
this one only sequences and loops them. If the user wants just one axis (just prove it / just find
what's missing / just research it), use the sub-skill directly. Reach for immaculate-spec-writing only
when the user wants the full, looped, both-axes-converged standard and accepts the cost.
