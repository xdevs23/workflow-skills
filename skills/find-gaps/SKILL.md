---
name: find-gaps
description: Audit an artifact (design doc, spec, plan, set of claims) for SINS OF OMISSION — things that SHOULD be present for it to be complete, implementable, and truthful but are MISSING, under-specified, or silently assumed. Distinct from verify-loop (which proves present claims true); this finds what isn't there at all. Spawns scope-bounded, evidence-backed gap-finders, severity-grades each gap, and returns a prioritized list. Use when the user wants a completeness check / "what's missing" / "is anything overlooked" / "is this a complete spec" before relying on or implementing an artifact.
---

# Find Gaps — the sins-of-omission audit

A reusable, project-agnostic completeness audit. It answers a question that claim-verification
*cannot*: **what should be in this artifact but isn't?** verify-loop proves every claim that is
*present* is true; it is blind to a claim that *should* be there and is absent. Those are orthogonal
failure modes — a present-but-wrong fact, and an absent-but-required one — and a spec that is 100%
correct can still be 50% complete. This skill hunts the second kind.

Use whenever the user wants a completeness check before relying on or implementing something:
"what's missing", "is anything overlooked", "is this a complete spec", "did we forget anything",
"will this actually be implementable end to end". Read-only — it reports gaps; it does not edit or
implement. It composes with **research-loop** (run after research drafts the doc) and **verify-loop**
(which proves the present claims while this finds the absent ones).

## Why omission is the expensive failure

A missing requirement does not announce itself — there is no wrong line to catch, just silence where
a decision should be. It is the gap that surfaces three sessions later as "the data never crosses the
binder" or "nobody specified what happens when the list is empty." Finding it up front, against
ground truth, is far cheaper than re-deriving it during a bug hunt. That is the whole value
proposition: spend tokens now to not lose sessions later.

## Inputs to establish first (ask only if not obvious from the request)

- **Target artifact**: the file/doc/claim-set to audit (absolute path, or pasted inline).
- **The artifact's OWN stated scope**: what it is *trying* to be a complete spec *of*. This is the
  fence. Gaps are judged **within** that scope — proposing things beyond it is noise, not a gap.
  Extract the scope from the artifact's problem/goal statement; if unstated, ask.
- **Ground truth**: the codebase + specific dirs, reference docs, the real interfaces/APIs the spec
  will be implemented against. Gap claims must cite this, not memory.
- **Gap-finder fleet**: default 1 thorough finder for a focused doc; fan out 3–5 (sonnet, one opus)
  for a large/high-stakes spec so different finders sweep different categories. Never haiku. Explicit
  `model` on every agent.

## Non-negotiable principles

0. **Verbatim agent template, append-only.** The gap-finder's rules live in `agents/gap-finder.md` and
   are used VERBATIM via `agentType:'gap-finder'`. The string passed to `agent()` is ONLY the task
   context (artifact, scope fence, category sweep) APPENDED after that base. Never modify the base inline.
1. **Scope-bounded.** A gap is something missing **within the artifact's own stated scope**. Flagging
   out-of-scope additions ("could also mention X" where X is a different feature) is noise and
   actively harmful — it buries the real gaps. Fence every finder to the stated scope explicitly.
2. **Evidence-backed, same as verify-loop.** Every gap must cite **ground-truth evidence that it is a
   real gap** — file:line + quoted code/source where the overlooked thing actually lives, or the
   concrete promise in the artifact that is left unspecified. A vague "could mention X" with no source
   is not a finding; discard it. "The doc promises Y in its goals (line N) but no section delivers Y"
   is a finding.
3. **Severity-graded.** Each gap is tagged:
   - `MUST-FIX` — the artifact is incomplete/misleading enough to mislead the implementation (a
     promised datum with no accessor; a contract that can't be implemented as written; a data path
     that doesn't connect end to end).
   - `SHOULD-ADD` — a real gap; the omission should be made explicit (an unhandled edge case the spec
     is silent on; a known divergence not called out).
   - `NICE` — would improve completeness but nothing breaks without it.
4. **Read-only.** Finders never edit or implement. They report. The human (or you, with approval)
   folds gaps into the artifact — and anything folded in becomes new content that **must then be
   verified** (hand to verify-loop).
5. **Explicit models, sonnet floor, never haiku.** Set `model` on every agent.

## The gap categories (sweep all that apply)

These are the recurring shapes of omission. Give finders these as a checklist; "I checked category X
and found no gaps" is a valid, valuable result — say it explicitly.

1. **Enumeration completeness.** Does a claimed-complete set actually cover every case? Every type in
   the enum, every subclass, every branch, every state? Find the member the enumeration silently
   skips. (Cite where each missed case is defined.)
2. **Promised-but-unspecified data.** The artifact's own problem/goal/overview promises X. Does a
   later section actually specify *how* X is obtained/produced/transmitted? Find the promised datum
   with no accessor / no field / no algorithm behind it.
3. **End-to-end connectivity.** Does the data actually flow from source to consumer? A native accessor
   that has no transport field; a producer with no matching consumer contract; a value computed but
   never plumbed across the boundary (binder/API/serialization). This is where the most expensive
   gaps hide — each layer looks complete in isolation, but they don't connect.
4. **Edge cases & honest-omission gaps.** Empty collection, zero count, uninitialized/pre-patch state,
   not-yet-ready, a shared/moving resource, a "can't determine" case. Does the spec say what to do, or
   is it silent? Silence on a reachable edge case is a gap.
5. **Lifecycle / consistency / atomicity.** Snapshot consistency across a multi-step read; TOCTOU;
   ordering guarantees; what's held across a loop. Is correctness stated, or assumed? (Even if the
   behavior IS correct, an unstated assumption a reader must re-derive is a SHOULD-ADD.)
6. **Divergent / dropped behavior.** Does the new model silently DROP something the existing
   implementation computes, or compute it DIFFERENTLY on one path vs another, without saying so? Find
   the field that means different things on path A vs path B with no caveat.

## The workflow

### 1. Establish scope + ground truth (you)
Read the artifact. Extract its stated scope verbatim — this is the fence you hand every finder. Identify
the ground-truth sources finders must cite against.

### 2. Fan out gap-finders (parallel, scope-fenced, identical or category-split)
Spawn finder(s). For a focused artifact, one thorough finder over all categories. For a large/
high-stakes spec, fan out — either identical (redundant breadth) or split by category (each finder
owns 1–2 categories deeply). Force structured output. Suggested shape:

```js
The gap-finder's RULES live VERBATIM in `agents/gap-finder.md` (applied via
`agentType:'gap-finder'`). The string passed to `agent()` is ONLY the APPENDED task
context — the artifact, the scope fence, the per-run category sweep.

```js
const SCOPE = `<<the artifact's own stated scope, verbatim — the fence>>`;
// APPEND-ONLY: task context after the gap-finder's verbatim base prompt.
const APPEND = `Artifact: <ARTIFACT>. SCOPE FENCE (stay inside it): ${SCOPE}.
Ground truth to cite: <GROUND_TRUTH>. Sweep these categories and say which have NO
gaps: enumeration completeness, promised-but-unspecified data, end-to-end
connectivity, edge cases, lifecycle/atomicity, divergent/dropped behavior.`;
const finders = [ {l:'gap-all', m:'sonnet'} ];                 // or split by category / add an opus
const raw = await parallel(finders.map(f => () =>
  agent(APPEND, { label:f.l, model:f.m, agentType:'gap-finder', schema:GAP_SCHEMA, phase:'FindGaps' })));
```

`GAP_SCHEMA` per gap: `{category, what, why, evidence (file:line + quote), severity}` plus a
`categoriesWithNoGaps: string[]` so "checked, clean" is explicit.

### 3. Reconcile (you, not an agent)
Merge finders' lists; dedup. **Verify the load-bearing citations yourself** — a finder's gap is a
*claim*, and like any claim its evidence can be wrong; confirm the cited file:line actually says what
the finder reports before treating the gap as real. Drop any "gap" that is actually out of scope, or
whose evidence doesn't hold up, or that the artifact already handles (a finder missed it). Sort by
severity.

### 4. Report
Return a prioritized gap list (MUST-FIX first) with evidence and a summary table. This is the
deliverable. **Do not edit the artifact in this skill** — folding gaps in is the caller's step
(and each folded-in gap then needs verify-loop).

## Exit / handoff
The output is a vetted, evidence-backed, scope-bounded gap list. The caller folds MUST-FIX (and chosen
SHOULD-ADD) gaps into the artifact — turning silence into an explicit decision or an honest "cannot
determine → omit" — and then hands the now-expanded artifact to **verify-loop**, because every byte
added to close a gap is itself a new claim that must be proven. find-gaps discovers absence;
verify-loop proves presence. In a full convergence loop (see **immaculate-spec-writing**) the two
alternate until a pass finds zero new gaps AND zero defects.

## Reporting
Report the gap count by severity and each MUST-FIX with its evidence, so the user can make the
scope/fold-in decisions. Surface explicitly which categories came back clean — "no enumeration gaps,
no atomicity gaps" is real signal that the audit was thorough, not a no-op.
