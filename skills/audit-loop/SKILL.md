---
name: audit-loop
description: Continuously audit a codebase through a fixed library of independent lenses (separation of concerns, abstraction quality, code smell, type safety, cleanliness, missing gaps, domain leakage, type smearing), adversarially verify each finding, and append confirmed findings to a living AUDIT.md — deduplicated, never overwritten. Designed to run forever via /loop so the audit accumulates in the background while implementation and discussion happen, then everything can be fixed in one sweep. Read-only; it finds and records, it never fixes.
---

# Audit Loop — never-ending, lens-based, append-only audit into AUDIT.md

A reusable, project-agnostic background audit. It runs **all the time** — one round after another, no
matter what else is happening — so that while features are being implemented or discussed, an
independent fleet of single-lens auditors keeps sweeping the codebase and recording confirmed problems
into a single living **`AUDIT.md`**. By default this file is the project-local
**`./.claude/workflow-skills/AUDIT.md`** (relative to the audited project's root — NOT `~/.claude`),
durable plugin-owned tool-state; write it elsewhere only on explicit request. Whether to commit or
gitignore it is the user's choice — do not assume either. The point is to decouple *finding* from
*fixing*: the audit
accumulates continuously, and you fix everything in one deliberate sweep when you choose to.

It is **read-only and append-only**: each round may only *add* new, verified, non-duplicate findings to
`AUDIT.md`. It never edits source, and never rewrites or deletes existing AUDIT entries (except to mark
them, see Reconciliation). It does not fix anything — fixing is a separate, explicit step.

## How it runs continuously

This skill is meant to be driven by **`/loop`** so it re-fires forever, in a **tight loop with no
interval**:

```
/loop audit-loop
```

Each firing runs exactly **one round** (the Workflow below) and returns; `/loop` then re-invokes the
**next round immediately**. There is deliberately **no delay, sleep, or interval** between rounds — the
round's own runtime is the spacing. A full-tree, 8-lens, verified pass typically takes **~30+ minutes**,
and that is exactly enough time for new code to accumulate, so the moment one round finishes the next
should start over the now-changed tree. Do **not** insert a wait, do **not** let the loop self-pace into
idle delays, and do not stop early — the loop is supposed to run back-to-back and outlive any single
task.

## Non-negotiable principles

1. **Full tree, every round.** Audit the codebase **as-is**, the entire tree, every round. Do NOT diff
   against a baseline and do NOT skip files as "work in progress" — lenses must see reality without
   being told what's finished. Excluding in-progress code biases the audit and lets real problems hide
   behind "they're probably still working on it".
2. **One lens per agent, fixed library.** Spawn the eight lens subagents below, each auditing the whole
   tree through ONLY its lens. No agent does general review; redundant single-lens depth is the point.
3. **Adversarially verify before recording.** A raw lens finding is a hypothesis. Each finding is
   independently verified (refute-by-default) before it may enter `AUDIT.md`. Unconfirmed findings are
   dropped, not recorded.
4. **Append-only, deduplicated.** Confirmed findings are *appended* to `AUDIT.md` (default
   `./.claude/workflow-skills/AUDIT.md`, project-local; elsewhere only on explicit request). Before appending, read the existing
   `AUDIT.md` and drop any finding already present (same lens + same location + same normalized claim).
   The file only grows with genuinely new findings; it is never overwritten.
5. **Evidence mandatory.** Every recorded finding carries a real `file:line` and quoted code. No bare
   assertions.
6. **Explicit models on every agent.** Lens auditors and verifiers are **sonnet** (review/research
   floor). Never haiku. Never rely on an inherited/default model. (There is no fix stage; if you later
   add one, that stage is opus.)
7. **Read-only.** No agent edits source. The only write is the append to `AUDIT.md`.

## The eight lenses (bundled subagents)

Use these `agentType`s — they ship with this plugin, each model-pinned to sonnet:

`separation-of-concerns`, `abstraction-quality`, `code-smell`, `type-safety`, `code-cleanliness`,
`missing-gaps`, `domain-leakage`, `type-smearing`.

## One round (the Workflow)

Each round is a single Workflow: fan out the 8 lenses over the full tree, verify each finding as soon as
its lens returns (pipeline, not barrier), then hand the confirmed, deduplicated set back for appending.

```js
export const meta = {
  name: 'audit-loop-round',
  description: 'One round: 8 lenses over the full tree, adversarially verify, return confirmed findings',
  phases: [{ title: 'Audit' }, { title: 'Verify' }],
}

const LENSES = [
  'separation-of-concerns', 'abstraction-quality', 'code-smell', 'type-safety',
  'code-cleanliness', 'missing-gaps', 'domain-leakage', 'type-smearing',
];

const FINDINGS_SCHEMA = { /* { findings: [{ lens, file, line, claim, evidence, severity }] } */ };
const VERDICT_SCHEMA  = { /* { real: boolean, reason, evidence } */ };

const auditPrompt = lens =>
  `Audit the ENTIRE codebase as-is through your single lens only. Do NOT skip files as "work in ` +
  `progress" — audit reality. Every finding needs a real file:line and quoted code. Return structured ` +
  `findings; return an empty list if the tree is clean on your lens. Read-only.`;

const results = await pipeline(
  LENSES,
  lens => agent(auditPrompt(lens), { agentType: lens, model: 'sonnet', label: `audit:${lens}`, phase: 'Audit', schema: FINDINGS_SCHEMA }),
  (review, lens) => parallel((review?.findings ?? []).map(f => () =>
    agent(
      `Adversarially verify this ${lens} finding. Default to real=false unless the evidence clearly ` +
      `holds against the actual code. Finding: ${f.claim} @ ${f.file}:${f.line}. Evidence: ${f.evidence}`,
      { agentType: lens, model: 'sonnet', label: `verify:${f.file}:${f.line}`, phase: 'Verify', schema: VERDICT_SCHEMA }
    ).then(v => ({ ...f, verdict: v }))
  ))
);

return results.flat().filter(Boolean).filter(f => f.verdict?.real);
```

## After the Workflow — dedup & append (you, not an agent)

1. **Read the existing `AUDIT.md`** (default `./.claude/workflow-skills/AUDIT.md`, relative to the
   audited project root — never `~/.claude`; create it with a header if absent, making the directory if
   needed). Build the set of already-recorded
   findings keyed on `lens + file + normalized-claim` (normalize: lowercase, collapse whitespace, ignore
   line-number drift within the same symbol).
2. **Drop duplicates** from this round's confirmed set against that key. Optionally, if a previously
   recorded finding's location no longer exists (code changed), mark it `~~resolved?~~` in place rather
   than deleting — never silently rewrite history.
3. **Append** the genuinely-new confirmed findings under a dated round heading, grouped by lens, each as:
   `` - [SEVERITY] `file:line` — claim. Evidence: `quoted code`. ``
4. **Report** to the user a one-line round summary: N new findings appended (by lens), M duplicates
   skipped, AUDIT.md total. Keep it short — the file is the artifact.

## AUDIT.md shape

(default path `./.claude/workflow-skills/AUDIT.md`, project-local)

```markdown
# Audit Log
Living, append-only. Findings are verified before entry and deduplicated across rounds. Read-only audit;
fixing is a separate, deliberate sweep.

## Round — <date>
### separation-of-concerns
- [HIGH] `src/foo.ts:42` — Persistence mixed into domain handler. Evidence: `db.query(...)` inside `placeOrder`.
### type-smearing
- [MED] `src/dispatch.ts:88` — Generic `handle(x)` does `instanceof Order`. Evidence: `if (x instanceof Order)`.
```

## Exit criteria

There is no natural exit — that's the design. The loop runs until the user stops it. Each round simply
leaves `AUDIT.md` a little more complete. When the user wants to act, they fix everything in `AUDIT.md`
in one sweep (a separate step — `implement-review-verify` pairs well for that), then can clear or archive
the file.
