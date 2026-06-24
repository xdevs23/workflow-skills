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

All consolidation into `AUDIT.md` — reading it, deduplicating, appending — is handled by a **dedicated
record agent inside the round's own Record phase**, so the **root agent never has to touch the file**.
It only receives a one-line summary back and stays focused on steering implementation. `AUDIT.md` is a
side effect that accumulates in the background, tackled later.

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
6. **Explicit models on every agent.** Lens auditors, verifiers, and the record agent are all
   **sonnet** (review/research floor; the record agent does mechanical dedup/append, not coding, so
   sonnet is right). Never haiku. Never rely on an inherited/default model. (There is no fix stage; if
   you later add one, that stage is opus.)
7. **Read-only on source; one writer for the log.** No agent edits source code. The only write is the
   append to `AUDIT.md`, performed by exactly one record agent in the Record phase — never by the root
   agent and never by a lens/verifier agent.

## The eight lenses (bundled subagents)

Use these `agentType`s — they ship with this plugin, each model-pinned to sonnet:

`separation-of-concerns`, `abstraction-quality`, `code-smell`, `type-safety`, `code-cleanliness`,
`missing-gaps`, `domain-leakage`, `type-smearing`.

## One round (the Workflow)

Each round is a single Workflow with **three phases**: fan out the 8 lenses over the full tree (Audit),
verify each finding as soon as its lens returns (Verify, pipeline not barrier), then hand the confirmed
set to a **single record agent** that owns all `AUDIT.md` consolidation (Record). The dedup-and-append
work runs **inside the Workflow, in its own phase — not in the root agent's context**. This is the whole
point: the root agent stays free to steer implementation and only ever receives a one-line summary back.

```js
export const meta = {
  name: 'audit-loop-round',
  description: 'One round: 8 lenses over the full tree, adversarially verify, record into AUDIT.md',
  phases: [{ title: 'Audit' }, { title: 'Verify' }, { title: 'Record' }],
}

const LENSES = [
  'separation-of-concerns', 'abstraction-quality', 'code-smell', 'type-safety',
  'code-cleanliness', 'missing-gaps', 'domain-leakage', 'type-smearing',
];

// Resolve before the run; agents can't compute the current date (see Record below).
const AUDIT_PATH = './.claude/workflow-skills/AUDIT.md'; // project-local default
const ROUND_DATE = args?.date ?? 'undated'; // pass today's date in via Workflow args

const FINDINGS_SCHEMA = { /* { findings: [{ lens, file, line, claim, evidence, severity }] } */ };
const VERDICT_SCHEMA  = { /* { real: boolean, reason, evidence } */ };
const SUMMARY_SCHEMA  = { /* { new_count, dup_count, total, by_lens: {lens: n} } */ };

const auditPrompt = lens =>
  `Audit the ENTIRE codebase as-is through your single lens only. Do NOT skip files as "work in ` +
  `progress" — audit reality. Every finding needs a real file:line and quoted code. Return structured ` +
  `findings; return an empty list if the tree is clean on your lens. Read-only.`;

// Phases 1+2: audit then verify, per-lens pipeline (no barrier).
const verified = (await pipeline(
  LENSES,
  lens => agent(auditPrompt(lens), { agentType: lens, model: 'sonnet', label: `audit:${lens}`, phase: 'Audit', schema: FINDINGS_SCHEMA }),
  (review, lens) => parallel((review?.findings ?? []).map(f => () =>
    agent(
      `Adversarially verify this ${lens} finding. Default to real=false unless the evidence clearly ` +
      `holds against the actual code. Finding: ${f.claim} @ ${f.file}:${f.line}. Evidence: ${f.evidence}`,
      { agentType: lens, model: 'sonnet', label: `verify:${f.file}:${f.line}`, phase: 'Verify', schema: VERDICT_SCHEMA }
    ).then(v => ({ ...f, verdict: v }))
  ))
)).flat().filter(Boolean).filter(f => f.verdict?.real);

// Phase 3: ONE record agent owns AUDIT.md. It reads the file, dedups against
// what's already there, appends only the genuinely-new findings, and returns
// just a summary. The root agent never touches AUDIT.md, never sees findings.
const summary = await agent(
  `You are the AUDIT recorder — the SOLE writer of the audit log. Consolidate this round's confirmed ` +
  `findings into \`${AUDIT_PATH}\` (relative to the project root — NEVER ~/.claude). Steps, exactly:\n` +
  `1. Read ${AUDIT_PATH} (create it with an "# Audit Log" header, making parent dirs, if absent).\n` +
  `2. Build the set of already-recorded findings keyed on lens + file + normalized-claim ` +
  `(normalize: lowercase, collapse whitespace, ignore line-number drift within the same symbol).\n` +
  `3. Drop this round's findings already present. If a previously recorded finding's file:line no ` +
  `longer exists, mark it \`~~resolved?~~\` in place — never delete or rewrite history.\n` +
  `4. APPEND only the genuinely-new findings under a dated heading "## Round — ${ROUND_DATE}", grouped ` +
  `by lens, each as: - [SEVERITY] \`file:line\` — claim. Evidence: \`quoted code\`.\n` +
  `5. Return ONLY the structured summary (counts), no prose.\n\n` +
  `Confirmed findings this round (JSON): ${JSON.stringify(verified)}`,
  { model: 'sonnet', label: 'record:AUDIT.md', phase: 'Record', schema: SUMMARY_SCHEMA }
);

return summary; // one-line-summary material; root surfaces it and moves on
```

## After the Workflow — just report (root agent)

The record agent has already done all consolidation **inside** the Workflow. The root agent's only job
is to surface the returned summary as **one line** and get straight back to whatever it was steering:

```
→ audit round: <new_count> new (<by_lens>), <dup_count> dup skipped, <total> total in AUDIT.md
```

Do **not** read, dedup, or append to `AUDIT.md` from the root agent — that is the record agent's
exclusive responsibility, and keeping it out of root context is the entire reason this phase exists. The
file is the artifact; the root stays focused on implementation.

> **Date note:** agents can't compute the current date. Pass it into the Workflow via `args` (e.g.
> `Workflow({ name, args: { date: '<today>' } })`) so the Record heading is correctly dated. Without it
> the heading falls back to `undated`.

> **Single-writer invariant:** exactly one record agent writes `AUDIT.md` per round, and rounds run
> sequentially (the loop fires the next round only after this one returns), so appends never race. If
> you ever parallelize rounds, serialize the Record phase or the append will corrupt the file.

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
