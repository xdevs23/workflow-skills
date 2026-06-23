---
name: research-loop
description: Answer an open research question with maximum certainty by triangulating from two independent angles (context-free decomposed expert fan-out + same-prompt breadth fan-out), synthesizing your own conclusion into a doc, then looping a 1:1 doc-vs-result review until the doc faithfully represents every source. Every finding evidence-tagged proven/uncertain/not-determinable. Use when the user wants deep, certain research on "how does X actually work" / "what is the authoritative way to do Y" before relying on or documenting it. Pairs with verify-loop (research produces the doc; verify-loop proves it).
---

# Research Loop — triangulate, synthesize, review-loop to a trustworthy doc

A reusable, project-agnostic workflow for answering an OPEN research question (not proving a known
claim — that's verify-loop) with high certainty. It fights three failure modes at once:
**framing bias** (Angle 1 runs context-free so researchers aren't steered toward expected answers),
**incompleteness** (Angle 2 runs same-prompt breadth so nothing obvious is missed), and **your own
synthesis errors** (a 1:1 doc-vs-result review loop checks your written conclusion against each raw
result). Every finding is evidence-tagged; nothing is stated as fact without a source.

Use when the user wants depth + certainty on an open question — "how does X really work", "what's the
authoritative way to read/do Y", "research Z thoroughly" — especially before documenting or
implementing against the answer. Read-only research; it produces a doc, it does not implement.

Composes with **verify-loop**: this skill produces the design/answer doc; verify-loop then proves
every claim in it. (verify-loop's defect-research step may invoke this skill.)

## Inputs to establish first

- **The question Q** (the open question/topic to research).
- **Ground truth** (codebase + dirs / reference docs / external sources to research against).
- **Project/task context** — needed for Angle 2 (precise), withheld from Angle 1 (context-free).
- **Output doc path** (where the synthesized conclusion is written).
- Models: sonnet floor, opus for synthesis/deep reasoning. NEVER haiku. Explicit `model` on every agent.

## Non-negotiable principles

1. **Every finding evidence-tagged.** Each finding carries concrete evidence (file:line + quoted
   code, or quoted source) AND a confidence tag: `PROVEN` (authoritative source quoted) /
   `UNCERTAIN` (suggested but not conclusively shown) / `NOT-DETERMINABLE` (cannot be established →
   the truthful resolution is "omit / label honestly", never assume).
2. **No hedging as fact.** "acceptable", "in practice", "typically", "should be", "doesn't occur" are
   defects. State the proven fact, or tag it UNCERTAIN/NOT-DETERMINABLE — don't smuggle a guess.
3. **YOU synthesize, agents don't decide.** Agents return findings; you read all results and derive
   your own conclusion into the doc. Don't outsource the judgment to one agent.
4. **The doc is checked against raw results, verbatim.** The review loop passes each raw result
   verbatim to its paired reviewer — the doc is validated against the actual evidence, not a summary.
5. **Read-only.** Researchers/reviewers never edit or implement. You write/fix the doc. Implementation
   is a separate, explicitly-approved step.

## The workflow

### Angle 1 — context-free decomposed expert fan-out (fights framing bias)
- You decompose Q into its natural sub-questions / angles / "expert" facets. **N = number of angles**
  (typically 3–6), not a fixed count.
- Spawn one researcher per angle, each **WITHOUT project/task context** — each gets only its distinct
  sub-question/angle/expert framing, so it investigates cold and isn't steered toward expected answers.
  Different questions, different angles, different experts.
- **Adversarially verify each finding**: a refute pass that actively tries to disprove each finding
  before it's accepted.
- **Opus synthesis** of the surviving, verified findings → **Result A** (evidence-tagged).

### Angle 2 — same-prompt breadth fan-out (fights incompleteness)
- **3 sonnet + 1 opus**, all the **same** broad research prompt — Q stated with **precise project/task
  context** — instructed to "return everything found", evidence-tagged.
- The **3 sonnet outputs → consolidated by a separate sonnet agent** → **Result B**.
- The **opus output passes through untouched (raw)** → **Result C**.

### Converge (you)
You now hold **3 results**: A (Angle-1 opus deep synthesis), B (Angle-2 consolidated sonnet),
C (Angle-2 raw opus). Read all three, reconcile, derive **your own** conclusion, and **write the doc**
— every claim evidence-tagged proven/uncertain/not-determinable.

### Doc review — 1:1 reviewer↔result pairing, SINGLE pass (fights your synthesis errors)
Spawn 3 sonnet reviewers, each paired with ONE result verbatim:
- reviewer 1 ← Result A (Angle-1 opus synthesis)
- reviewer 2 ← Result B (Angle-2 consolidated sonnet)
- reviewer 3 ← Result C (Angle-2 raw opus)

Each reviewer independently checks the doc **against its assigned result**: what does the doc state
that this result contradicts? what is in this result that the doc misrepresents or omits? Each
reports discrepancies with evidence. **You fix the doc.**

This is a **single review pass**, not a loop — its only job is to catch synthesis/transcription
errors against the raw results before handoff. Do NOT loop it here.

### Exit / handoff
After the single review pass and your fixes, the doc is a vetted research conclusion (every claim
evidence-tagged, zero hedges). Hand it to **verify-loop**, which runs the exhaustive claim-by-claim
prove-everything loop to convergence. Research-loop discovers + drafts; verify-loop proves. Keep the
two responsibilities separate — one review pass here, the full loop there.

## Workflow shape (adapt counts/paths; pin every model)

```js
// Angle 1: one context-free researcher per decomposed sub-question, then refute, then opus synth.
phase('Angle1');
const subQs = [ /* you decompose Q into these distinct angle prompts (NO project context) */ ];
const a1 = await pipeline(subQs,
  sq => agent(sq.contextFreePrompt, {label:`a1:${sq.key}`, model:'sonnet', schema:FINDINGS, phase:'Angle1'}),
  f  => agent(`Adversarially refute each finding; keep only what survives with evidence:\n${JSON.stringify(f)}`,
             {label:`refute:${sq.key}`, model:'sonnet', schema:FINDINGS, phase:'Angle1'}));
const resultA = await agent(`Synthesize, evidence-tagged proven/uncertain/not-determinable:\n${JSON.stringify(a1)}`,
             {label:'a1-synth', model:'opus', schema:SYNTH, phase:'Angle1'});

// Angle 2: same broad prompt (WITH precise context) x (3 sonnet + 1 opus); consolidate sonnets; opus raw.
phase('Angle2');
const broad = `<<Q with precise project/task context>> Return everything found, evidence-tagged.`;
const a2s = await parallel([0,1,2].map(i => () =>
  agent(broad, {label:`a2-sonnet${i}`, model:'sonnet', schema:FINDINGS, phase:'Angle2'})));
const a2opus = await agent(broad, {label:'a2-opus', model:'opus', schema:FINDINGS, phase:'Angle2'});
const resultB = await agent(`Consolidate these 3 research outputs verbatim-faithfully:\n${JSON.stringify(a2s)}`,
             {label:'a2-consolidate', model:'sonnet', schema:SYNTH, phase:'Angle2'});
const resultC = a2opus; // raw, untouched
return { resultA, resultB, resultC };
// THEN (you): read A/B/C -> write the doc -> spawn the 1:1 doc-review loop (reviewer1<-A, 2<-B, 3<-C)
// -> fix -> re-review -> loop until zero discrepancies from all three.
```

## Reporting
After Angle 1+2, report the 3 results' headline findings + your synthesized conclusion. After each
doc-review cycle, report each reviewer's discrepancies and the fix made, so the user sees convergence.
