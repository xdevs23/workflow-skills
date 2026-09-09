---
name: resume-interrupted-run
description: Resumes a workflow run interrupted after agents did substantial work but before they returned results. Not for completed agents with bad results.
---

# Resume an Interrupted Run — hand each mid-flight seat its own transcript back

A run's journal caches results keyed by the *completed* `agent()` call. A resume replays every
completed key instantly and re-runs everything else — and "everything else" is the whole problem. An
agent that was still working when the run stopped has **no journaled result**, so the resume starts it
from an empty context: every file it read, every finding it had already established, gone, re-derived
from scratch on the resumed run's budget. Meanwhile its transcript is sitting on disk, complete up to
the moment of the stop.

This skill is that one move: **give each interrupted seat its own prior transcript back, inside its own
prompt, before resuming.** Everything else here exists to keep that move from damaging the run it is
rescuing.

## When to reach for it

- A run was stopped, killed, or crashed while one or more agents were **still working**, and those
  agents had done real work you do not want repaid twice.
- The persisted script file and the run's transcript directory still exist on disk.

## When NOT to

- The run died **before any agent produced substantial work**. There is nothing to carry forward;
  resume plainly.
- **Every agent completed** and the run failed after them (an orchestrator error, a throw between
  phases). Their results are journaled; a plain resume replays them for free and this procedure buys
  nothing.
- An agent **completed with a bad result**. That is the opposite problem — see the boundary section
  at the end.
- A **re-verification round** after a fix pass. Those seats stay cold by design and re-run on their
  same original prompt (see `implement-review-verify`); this procedure is only for a seat that was cut
  off before it ever returned a verdict.

## The procedure

### 1. Locate the run transcript directory

Its path is returned at launch, under the session's `subagents/workflows/<runId>/`. It holds
`journal.jsonl` (the cached results — one result line per completed agent) plus, per spawned agent,
an `agent-<id>.jsonl` transcript and a matching `agent-<id>.meta.json`. The meta file carries the agent
type, the model and a spawn depth. Read the journal first: it is the evidence of which seats completed,
so a seat holding a transcript with no result line against it is the one to treat as interrupted. A
result line that is itself EMPTY is a different case: that seat COMPLETED, and no prompt edit will make
it replay as anything else — see the boundary section at the end of this file.

### 2. Map transcripts to seats — meta narrows, the transcript head decides

Do not guess from filenames. The mapping is a two-stage discrimination, because the meta file holds a
type, a model and a depth and nothing finer — no seat label, no prompt hash, no attempt marker:

- **The meta narrows a transcript to a seat TYPE.** Where every seat in the phase has a *distinct*
  agent type, that is the whole answer and the meta file alone maps it.
- **A read of the transcript's HEAD settles same-type ties.** Two seats sharing an agent type *and* a
  model within the same attempt are indistinguishable in their metas. Open each transcript and read the
  **prompt at its head** — the seat brief sits verbatim at the top, and it is the thing that actually
  tells the seats apart. There is no cheaper discriminator; do not substitute one.
- **Size and mtime are a WEAK FIRST SORT across ATTEMPTS — never siblings, never conclusive.** A
  stopped-then-resumed run **reuses the same run id and the same transcript directory**, appending the
  new agents' files beside the old ones — which is why one seat can end up owning several transcripts.
  Size and mtime are good enough to pull those candidates out of the directory and order them, and no
  further: they do not establish which attempt holds the work. That is settled by rule 2's content
  test — open the transcript and look for findings, verdicts, intermediate conclusions. And between
  two same-type *siblings* they say nothing whatever.

Get this mapping wrong and you hand a seat someone else's work, which is the damage rule 1 exists to
prevent.

### 3. Append a resume note to the INTERRUPTED prompts only

The script file is persisted and its path is also returned at launch. Edit **that file**, appending the
resume note to the prompts of the interrupted agents and nothing else. The note must tell the agent all
six things:

- an earlier attempt **of this exact seat** was interrupted **through no fault of its own** — the seat
  has to know the transcript is its own sound work, not output handed to it under suspicion;
- its complete transcript is at `<absolute path>`;
- **read it first**, then pick up where it left off;
- carry every finding it already made **forward verbatim**;
- **re-verify only if the code changed underneath** (rule 4 — not optional);
- do not redo investigation it already completed; spend the effort on what it had **not yet covered**.

### 4. Leave every COMPLETED stage prompt byte-identical

This is load-bearing, not hygiene. The journal key is the prompt plus its options: an identical key
replays its result instantly, and **any** edit — a word, a space — changes the key, so that call
re-runs live and so does everything after it. One stray edit to a settled prompt can re-execute most
of the run you were trying to salvage. Never reach a single seat by editing a shared constant either —
see `implement-review-verify`, law 5(a).

### 5. Re-invoke

Re-invoke the workflow with the persisted script path and the **prior run id**. Completed seats replay
from the journal; the interrupted seats run live, now with their own transcript in hand.

## The resume note — where it goes in a prompt

Appended last, after the shared blocks, on that seat's prompt alone:

```js
// ONE seat's note. Built per seat - the path is that seat's own transcript, nobody else's.
const RESUME_NOTE = [
  'RESUME NOTE. An earlier attempt at THIS EXACT SEAT was interrupted mid-flight, through no',
  'fault of its own. Its complete transcript is at <ABS>/agent-<id>.jsonl.',
  'READ IT FIRST and pick up where it left off. Carry every finding it already made forward',
  'VERBATIM. RE-VERIFY ONLY IF THE CODE CHANGED UNDERNEATH. Do not redo investigation it',
  'already completed - spend your effort on what it had not yet covered.',
].join('\n')

// Interrupted seat: note appended. Its key changes, but it has no cached result to invalidate.
const correctnessPrompt = [PINS, SPEC, SEAT_BRIEF, RESUME_NOTE].join('\n\n')
// Completed seat: untouched, byte for byte. It replays.
const cleanlinessPrompt = [PINS, SPEC, SEAT_BRIEF].join('\n\n')
```

## The rules

1. **SEAT ISOLATION — each seat gets ONLY its own prior transcript.** Handing a seat another seat's
   transcript destroys the independence the whole review design rests on: seats are split by concern
   and kept unbriefed on purpose, and one that has read a peer's reasoning is no longer an independent
   verdict — a cold seat that has been shown someone else's findings is not cold any more.
2. **Reference a transcript only if it CARRIES FINDINGS — otherwise re-run the seat clean.** The test
   is content, not size: open the transcript and look for a finding, a verdict, an intermediate
   conclusion. One that holds only orientation work — tools loading, a first file read or two — has
   nothing to carry forward and will anchor a fresh agent on a half-formed direction; that seat gets
   **no resume note at all** and runs clean, like any seat with no prior attempt. Byte size is a weak
   first sort for picking candidates out of a directory and nothing more — never a threshold, because
   transcripts include harness echo and any figure stated in bytes rots the moment that volume changes.
   Where a seat does own several transcripts, point at the one bearing the findings and only that one:
   naming the others adds nothing to recover, dilutes the instruction, and the agent has no way to know
   which one you meant it to trust.
3. **Editing an INTERRUPTED prompt is free; editing a COMPLETED one re-runs it and everything after
   it.** The interrupted seat has no cached result, so there is no key to invalidate — its prompt is
   yours to change at no cost, which is precisely why this procedure is cheap. The completed seat's
   result is the thing you are trying to keep. Never edit prompts as a batch; edit exactly the
   interrupted set.
4. **The re-verify-only-if-the-code-changed clause is mandatory.** Without it, a resumed seat treats
   its own prior findings as unproven and burns its budget re-proving what was already established —
   which is the exact cost this procedure exists to avoid. With it, the seat re-checks only what the
   tree changed underneath it and spends the rest of its effort on uncovered ground.

## What to expect

A seat that had effectively finished before the stop reads its transcript and re-emits its findings
almost immediately, rather than redoing the work. A partially-done seat continues from where it was.
The recovery is near-lossless, not lossless — the note is an instruction to the resumed agent, not a
restored context, so treat a resumed seat's output as its own work product and hold it to the same
contract as any other seat.

## Boundary — this is NOT the poisoned-result case

Two different failures, two different fixes:

- **Interrupted** (this skill): no cached result exists, so the prompt may be edited freely and the
  edit costs nothing. The fix is a resume note.
- **Completed with a bad result — an EMPTY journaled result included**: the bad result **is cached**
  and will replay verbatim on resume, so fixing the underlying cause and re-invoking changes nothing.
  The fix is a deliberate cache-bust of that single stage.

The cache-bust case is already covered — see `implement-review-verify`, law 5 (*Cache-busting on
resume*) and its *Resume corollaries*. Do not re-derive it here; the two paths share only the journal
mechanism, and each decision is recorded once.
