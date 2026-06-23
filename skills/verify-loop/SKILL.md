---
name: verify-loop
description: Run an adversarial claim-verification loop on a target artifact (design doc, spec, plan, set of claims) until EVERY claim is independently proven true against ground truth with evidence. Spawns N identical unbiased verifiers, reconciles to unanimous-or-defect, then research → fix → re-verify, looping until immaculate. Use when the user demands 100% certainty / "verify everything" / "truth only" / "no guessing" on a document or set of claims before relying on or implementing it.
---

# Verify Loop — prove every claim, loop until immaculate

A reusable, project-agnostic loop that drives a target artifact (a design doc, spec, plan, or any
set of factual claims) to **100% verified-true with evidence**. The standard is zero-tolerance:
nothing "acceptable", no hedging, no load-bearing-only shortcuts — **every claim, every byte** is
independently re-derived from ground truth, and the loop repeats until a full pass comes back
unanimously immaculate.

Use this whenever the user wants certainty before relying on or implementing something: "verify
everything", "truth only", "100% certain", "no guessing", "prove every claim". It is VERIFICATION
ONLY — it never implements; implementation requires a separate explicit go from the user.

## Inputs to establish first (ask only if not obvious from the request)

- **Target artifact**: the file/doc/claim-set to verify (absolute path, or the claims pasted inline).
- **Ground truth**: what claims are verified against (the codebase + specific dirs, a reference doc,
  external sources). Point verifiers at the real source, not memory.
- **Verifier fleet**: default **5 sonnet + 1 opus** (6 total). Never haiku. Scale up for larger/
  higher-stakes artifacts. All verifiers get the **identical** prompt — no claim-splitting, no
  per-agent bias.
- **On-defect policy**: default **halt → report → fix the artifact → re-verify** (zero tolerance).

## Non-negotiable principles (bake these into every run)

1. **Identical, unbiased verifiers.** Every agent gets the same prompt and verifies the *whole*
   artifact independently. Do NOT split claims across agents (splitting biases coverage and lets a
   wrong claim through if its one assigned checker misses it). Redundant full coverage is the point.
2. **Every claim, every byte.** Not just load-bearing claims. Every file:line citation, every
   signature/type/annotation, every "set in X", every "is per-thread", every numeric/enum value, and
   **every prose statement presented as fact**. Missing a claim is itself a review failure.
3. **Evidence mandatory — for passes too.** Each claim's verdict must carry concrete evidence (real
   file:line + quoted code/signature, or quoted source). No bare "looks right".
4. **Hedging is a defect.** "acceptable", "in practice", "typically", "should be", "doesn't occur",
   "probably" = automatic defect. Facts are exact or they are wrong.
5. **Citations must be exact.** A correct fact with a wrong line number / slightly-off signature is
   IMPRECISE (a defect), not immaculate.
6. **Explicit models on every agent.** sonnet floor for verify/research; opus for the hardest
   reasoning/synthesis. NEVER haiku. Never rely on an inherited/default model.
7. **Read-only.** Verifiers and researchers do not edit or implement. The human (or you, with
   approval) edits the source-of-truth artifact based on researched evidence.
8. **Loop to convergence.** Keep cycling verify → research → fix → re-verify until one FULL
   independent pass is unanimously immaculate with zero hedges. Do not declare done early.
9. **A recurring CATEGORY of flag means the doc is shaped wrong — restructure, don't keep patching.**
   If the same *type* of finding comes back cycle after cycle (same section, same kind of statement),
   that recurrence is the diagnostic: the artifact is written the wrong way, and patching instances
   will never converge — it just relocates the symptom. After ~2-3 cycles, look at the SHAPE of what
   recurs, not the individual items. Then either **restructure** (e.g. move design-judgment / narrative
   / non-normative content into a clearly-labeled appendix so the normative claim-body is 100% sourced
   and nothing is left to flag) or **research** the contested premise to ground so it becomes a sourced,
   PROVEN claim instead of a perpetually-flagged unsourced one. Do NOT sanitize a doc into pretending it
   has no design judgments — separate them structurally so the verifiable body can reach immaculate.
   ~10 cycles is plenty; if it hasn't converged by then, the structure is the problem, not the wording.

## The loop

### 1. Verify (parallel fleet, identical prompt)
Spawn the fleet via a Workflow. Each agent: read the target artifact in full, then for EVERY claim,
locate the real ground-truth source and confirm/refute WITH EVIDENCE. Force structured output so
verdicts are per-claim and machine-reconcilable. Verdict enum per claim:
`IMMACULATE` (confirmed exactly, with evidence) / `WRONG` (contradicted) / `IMPRECISE` (partially
true, wrong line, off signature, overstated) / `UNVERIFIABLE` (no evidence either way). Plus a list
of any hedged/unsourced statements (all defects). Overall verdict is `ALL_IMMACULATE` only if every
claim is IMMACULATE.

Use a JSON `schema` on each `agent()` call so results are structured. Pin `model` explicitly per
agent. Suggested workflow shape (adapt counts/paths):

```js
const PROMPT = `Verify EVERY claim in <ARTIFACT_PATH> against <GROUND_TRUTH>. ZERO-TOLERANCE,
truth-only: a single wrong claim is a failure. For every factual assertion — every file:line, every
signature/type/annotation, every prose fact — independently locate the real source and confirm or
refute WITH EVIDENCE (real file:line + quoted code). Wrong line number or off signature = IMPRECISE.
Hedging words (acceptable/in practice/typically/should be/doesn't occur) = defects. Read-only; do not
edit or implement. Return per-claim verdicts with evidence for EVERY claim including passes; missing
a claim is a failure.`;
const verifiers = [ {l:'v1',m:'sonnet'},{l:'v2',m:'sonnet'},{l:'v3',m:'sonnet'},
                    {l:'v4',m:'sonnet'},{l:'v5',m:'sonnet'},{l:'v6',m:'opus'} ];
const results = await parallel(verifiers.map(v => () =>
  agent(PROMPT, { label:v.l, model:v.m, schema:CLAIM_SCHEMA, agentType:'Explore', phase:'Verify' })));
```

### 2. Reconcile (you, not an agent)
A claim is immaculate ONLY IF **all** verifiers independently rate it IMMACULATE **and their evidence
agrees** (same file:line / same signature). Treat as a DEFECT: any non-IMMACULATE verdict from any
agent; any disagreement between agents (e.g. two different cited lines for one claim — chase it down
yourself); any hedge flagged by any agent; any claim some agents didn't cover. Don't just trust the
verdicts — cross-read the evidence.

### 3. Research (only the defects)
For each defect, spawn a focused researcher (sonnet, or opus if subtle) to establish the *actual*
truth from ground truth with evidence — the real signature, the real line, whether the asserted thing
is even possible. If a claim is UNVERIFIABLE because the needed fact isn't exposed/available, the
truthful resolution is often "omit / label honestly", not "assume".

### 4. Fix the artifact (you, with the user's approval for the source of truth)
Edit the target artifact to match proven reality — correct the citation/signature, replace a hedge
with an exact fact, or convert an unprovable claim into an explicit "cannot determine → omit". The
human owns the source-of-truth artifact; make edits informed by researcher evidence, and surface
substantive changes to the user.

### 5. Re-verify (full pass, not a spot-check)
Re-run step 1 over the corrected artifact in full — a fix can shift line numbers or expose adjacent
claims. Loop 1→5 until a full pass is unanimously IMMACULATE with zero hedges and agreeing evidence.

## Exit criteria
Stop only when one complete independent fleet pass returns ALL_IMMACULATE, every claim carries
agreeing evidence, and there are zero hedged/unsourced statements. Report the final per-claim
evidence summary. Implementation (if any) is a SEPARATE step requiring explicit user approval — this
skill never implements.

## Reporting each cycle
After each cycle, give the user a short per-claim status (immaculate count, and each defect with its
evidence + the fix made), so they have visibility into convergence — not just a final verdict.
