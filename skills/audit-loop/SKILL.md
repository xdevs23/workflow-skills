---
name: audit-loop
description: Continuously audits a codebase without applying fixes.
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

It is **read-only and append-only**: each round may only *add* to `AUDIT.md` — new verified
non-duplicate findings as entries, and the claims the verifier killed as one-line entries in a
separate `## Refuted` ledger so they are never rediscovered. It never edits source, and never
rewrites or deletes existing AUDIT entries — the ONE permitted in-place edit is marking a stale
entry `~~resolved?~~` when its `file:line` no longer exists. It does not fix anything — fixing is
a separate, explicit step.

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
   independently verified (refute-by-default) before it may enter `AUDIT.md` as a finding.
   Unconfirmed findings never become entries — they go to the Refuted ledger instead (principle 5).
4. **Append-only, deduplicated against everything SEEN.** Confirmed findings are *appended* to
   `AUDIT.md` (default `./.claude/workflow-skills/AUDIT.md`, project-local; elsewhere only on
   explicit request). Before appending, read the existing `AUDIT.md` and drop any finding already
   present under the dedupe key — **same lens + same file (line-number drift within a symbol is
   ignored) + same normalized claim** — checking that key against **both the confirmed entries AND
   the Refuted ledger**. The file only grows with genuinely new findings; it is never overwritten.
   The record agent owns this check and is authoritative; the lenses get the same file as an
   advisory pre-filter (below) purely to save verification cost.
5. **Refuted findings are recorded, not forgotten.** A finding the verifier killed goes into a
   separate, clearly-marked **`## Refuted`** ledger in `AUDIT.md` (lens + file + normalized claim).
   Dedupe against SEEN, not against CONFIRMED — otherwise every judge-rejected finding is
   rediscovered, re-verified and re-rejected every single round, forever, and the audit never
   converges. The ledger is append-only like everything else. Because a lens that never sees the
   ledger keeps *rediscovering* what it stops *re-recording*, each lens is also told to read
   `AUDIT.md` and skip claims already adjudicated under its own lens — an advisory pre-filter that
   spends the ledger where the cost actually is (verification), with the record agent's check still
   the authority. It does not narrow the sweep: the lens still reads the whole tree (principle 1),
   it just declines to re-report a claim already judged.
6. **Evidence mandatory.** Every recorded finding carries a real `file:line` and quoted code. No bare
   assertions.
7. **Explicit models on every agent.** Lens auditors, verifiers, and the record agent are all
   **sonnet** (review/research floor; the record agent does mechanical dedup/append, not coding, so
   sonnet is right). Never haiku. Never rely on an inherited/default model. (There is no fix stage; if
   you later add one, that stage is opus.)
8. **FAIL-FAST.** An agent returning null or a structurally sub-minimal result retries the SAME agent
   (3 attempts total), then the WORKFLOW THROWS. This binds EVERY stage, verification included: a
   verdict that silently vanishes is an unaudited finding. Never let an empty result flow on — a record
   agent handed an empty verified set "succeeds" vacuously and the round silently audits nothing. An
   *empty findings list from a clean lens* is a valid result and is not a failure; a null or malformed
   return is.
9. **Read-only on source; one writer for the log.** No agent edits source code. The only write is the
   append to `AUDIT.md`, performed by exactly one record agent in the Record phase — never by the root
   agent and never by a lens/verifier agent. Lenses may READ the log (the pre-filter above); reading
   is not writing, and there is still exactly one writer.

## The eight lenses (bundled subagents)

Use these `agentType`s — they ship with this plugin without model defaults.
Select an explicit model and effort for each stage under the applicable project policy:

`separation-of-concerns`, `abstraction-quality`, `code-smell`, `type-safety`, `code-cleanliness`,
`missing-gaps`, `domain-leakage`, `type-smearing`.

The Record phase uses `agentType:'record'` (`agents/record.md`).

**Agent prompt templates (verbatim base, append-only):** each `agentType` above has its rules in
`agents/<role>.md`, used VERBATIM as the start of the agent's prompt. The string passed to `agent()`
is ONLY the task context APPENDED after that base (the tree to audit, the findings to record). Do NOT
modify the base rules inline — append only. (A lens verifies its OWN findings in the Verify phase, so
the verifier reuses the lens `agentType`.)

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
const SUMMARY_SCHEMA  = { /* { new_count, dup_count, refuted_count, total, by_lens: {lens: n} } */ };

// FAIL-FAST: retry the same agent on a null/malformed result (3 attempts), then throw.
// An empty findings list is a VALID result and must not trigger this.
async function robust(prompt, opts, ok) {
  for (let i = 0; i < 3; i++) {
    const r = await agent(prompt, opts);
    if (r && ok(r)) return r;
    log('sub-minimal result from ' + opts.label + ', retry ' + (i + 1));
  }
  throw new Error('FAIL-FAST: ' + opts.label + ' returned no usable result after 3 attempts');
}

const auditPrompt = lens =>
  `Audit the ENTIRE codebase as-is through your single lens only. Do NOT skip files as "work in ` +
  `progress" — audit reality. Every finding needs a real file:line and quoted code. Return structured ` +
  `findings; return an empty list if the tree is clean on your lens. Read-only.\n` +
  `Pre-filter: read \`${AUDIT_PATH}\` if it exists and do NOT re-report a claim already recorded ` +
  `under your lens — in a round entry OR in the "## Refuted" ledger. Still read the whole tree; ` +
  `you are only declining to re-raise a claim already judged. The record agent's dedupe is the ` +
  `authority — this only saves you and the verifier the round-trip.`;

// Phases 1+2: audit then verify, per-lens pipeline (no barrier).
// FAIL-FAST binds verification too: parallel() turns a thrown robust() into null,
// so re-raise on any null rather than filtering it away — a vanished verdict is an
// unaudited finding, and the round would otherwise "succeed" having judged nothing.
const judged = (await pipeline(
  LENSES,
  lens => robust(auditPrompt(lens), { agentType: lens, model: 'sonnet', label: `audit:${lens}`, phase: 'Audit', schema: FINDINGS_SCHEMA }, r => Array.isArray(r.findings)),
  (review, lens) => parallel((review?.findings ?? []).map(f => () =>
    robust(
      `Adversarially verify this ${lens} finding. Default to real=false unless the evidence clearly ` +
      `holds against the actual code. Finding: ${f.claim} @ ${f.file}:${f.line}. Evidence: ${f.evidence}`,
      { agentType: lens, model: 'sonnet', label: `verify:${f.file}:${f.line}`, phase: 'Verify', schema: VERDICT_SCHEMA },
      v => typeof v.real === 'boolean'
    ).then(v => ({ ...f, lens, verdict: v })) // stamp the lens here; the auditor is not asked to fill it
  )).then(vs => {
    if (vs.some(v => !v)) throw new Error(`FAIL-FAST: lost a ${lens} verdict`);
    return vs;
  })
)).flat();

// Both halves are recorded: confirmed findings become entries, refuted ones become
// ledger lines. Dedupe is against SEEN (entries + ledger), never against CONFIRMED
// alone — otherwise a judge-rejected finding is rediscovered every round forever.
const verified = judged.filter(f => f.verdict.real);
const refuted  = judged.filter(f => !f.verdict.real)
  .map(f => ({ lens: f.lens, file: f.file, claim: f.claim, reason: f.verdict.reason }));

// Phase 3: ONE record agent (agentType:'record') owns AUDIT.md. Its append-only /
// dedupe / never-rewrite RULES live VERBATIM in agents/record.md; the string below
// is ONLY the appended task context (the path, the round heading, the findings).
// The root agent never touches AUDIT.md, never sees findings.
const summary = await robust(
  `Audit log path: \`${AUDIT_PATH}\` (relative to the project root — NEVER ~/.claude); ` +
  `create it with an "# Audit Log" header plus an empty "## Refuted" section, making parent ` +
  `dirs, if absent.\n` +
  `Dedupe key: lens + file + normalized-claim (lowercase, collapse whitespace, ignore ` +
  `line-number drift within the same symbol). Check that key against EVERYTHING SEEN — the ` +
  `recorded round entries AND the "## Refuted" ledger — not just the confirmed entries. A ` +
  `finding already in the ledger is a duplicate and is dropped silently.\n` +
  `If a previously recorded finding's file:line no longer exists, mark that entry ` +
  `\`~~resolved?~~\` in place — the ONE permitted in-place edit, and never on a ledger line. ` +
  `Nothing is ever deleted or reworded.\n` +
  `Add genuinely-new CONFIRMED findings under a dated heading "## Round — ${ROUND_DATE}", ` +
  `grouped by lens, each as: - [SEVERITY] \`file:line\` — claim. Evidence: \`quoted code\`. ` +
  `INSERT that heading ABOVE the "## Refuted" ledger, not at end-of-file.\n` +
  `Append genuinely-new REFUTED findings to the "## Refuted" ledger, which stays the LAST ` +
  `section, each as: - <lens> \`file\` — normalized claim (refuted ${ROUND_DATE}: reason). The ` +
  `ledger exists so a judge-rejected finding is not rediscovered; it is append-only too.\n` +
  `Return ONLY the structured summary (counts).\n\n` +
  `Confirmed findings this round (JSON): ${JSON.stringify(verified)}\n` +
  `Refuted findings this round (JSON): ${JSON.stringify(refuted)}`,
  { model: 'sonnet', agentType: 'record', label: 'record:AUDIT.md', phase: 'Record', schema: SUMMARY_SCHEMA },
  r => typeof r.total === 'number'
);

return summary; // one-line-summary material; root surfaces it and moves on
```

## After the Workflow — just report (root agent)

The record agent has already done all consolidation **inside** the Workflow. The root agent's only job
is to surface the returned summary as **one line** and get straight back to whatever it was steering:

```
→ audit round: <new_count> new (<by_lens>), <dup_count> dup skipped, <refuted_count> refuted, <total> total in AUDIT.md
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
Living, append-only. Findings are verified before entry and deduplicated across rounds against
EVERYTHING SEEN — the round entries below AND the Refuted ledger at the end. Read-only audit;
fixing is a separate, deliberate sweep.

## Round — <date>
### separation-of-concerns
- [HIGH] `src/foo.ts:42` — Persistence mixed into domain handler. Evidence: `db.query(...)` inside `placeOrder`.
### type-smearing
- [MED] `src/dispatch.ts:88` — Generic `handle(x)` does `instanceof Order`. Evidence: `if (x instanceof Order)`.

## Refuted
Findings the verifier killed. Recorded ONLY so they are not rediscovered every round — they are not
problems. Append-only; never promoted, never deleted.
- code-smell `src/foo.ts` — placeOrder is too long (refuted <date>: 31 lines, within house limit).
- type-safety `src/dispatch.ts` — handle() takes any (refuted <date>: signature is generic, not any).
```

The `## Refuted` section is always the LAST section and grows in place; each new round heading is
inserted ABOVE it, never at end-of-file — otherwise the round lands inside the ledger and the next
round's dedupe cannot parse either half. Both halves share one dedupe key (lens + file + normalized
claim, line-number drift ignored), so a claim that appears in either is a duplicate. Entries carry
`file:line` and ledger lines carry `file` alone; the key deliberately matches on `file` so the two
halves cross-match.

## Exit criteria

There is no natural exit — that's the design. The loop runs until the user stops it. Each round simply
leaves `AUDIT.md` a little more complete. When the user wants to act, they fix everything in `AUDIT.md`
in one sweep (a separate step — `implement-review-verify` pairs well for that), then can clear or archive
the file.

**Loop-until-dry (the principle behind the dedupe rule).** A bounded discovery loop stops after K
consecutive rounds with ZERO NEW findings. It converges only because dedupe is against everything
SEEN: if refuted findings are dropped rather than recorded, every round rediscovers them, "new
findings" never hits zero, and the loop cannot terminate. This audit is deliberately never-ending, so
it has no K — but the same dedupe rule is what stops it re-recording, and (via the lens pre-filter)
re-verifying, the same dead claims forever, and it is why the Refuted ledger exists. Use
loop-until-dry when you want a *bounded* audit of a fixed scope; use this skill as-is when you want
a standing background sweep.

> **Cache-busting on resume:** a resumed run replays cached results for identical (prompt, opts). To
> re-run one poisoned stage, edit only that stage's prompt or label; never edit a shared constant to
> fix one stage — it is embedded in every prompt, so every key busts and the whole round re-executes.
