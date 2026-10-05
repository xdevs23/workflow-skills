---
name: resume-interrupted-run
description: Resumes a workflow run interrupted after agents did substantial work but before they returned results. Not for completed agents with bad results.
---

# Resume an Interrupted Run — hand each mid-flight seat its own transcript back

**Load the `workflow-skills:writing-style` skill first.** It binds every comment, document, commit
message and reply this skill produces, and it is not optional when working with this plugin.

A run's journal records every `agent()` call under a key made from its prompt, its options and the
calls the script made before it, in the order it made them, and holds the result of every call that
finished. A resume replays each call whose key the journal holds with a result and runs every other
call live. An agent that was still working when the run stopped has **no journaled result**, so the
resume starts it from an empty context: every file it read, every finding it had already
established, gone, re-derived from scratch on the resumed run's budget. Meanwhile its transcript is
sitting on disk, complete up to the moment of the stop.

This skill is that one move: **give each interrupted seat its own prior transcript back, inside its own
prompt, before resuming.** Everything else here exists to keep that move from damaging the run it is
rescuing.

## What a resume runs again

- Expect an interrupted call whose prompt and options you leave unchanged to keep its key: it runs
  live, and every finished call replays, also one the script made after it.
- Expect any edit of a call's prompt or options, a resume note or a switched model alike, to give
  that call and every call the script makes after it a new key. All of them run live, the finished
  ones included, such as the roaster that starts beside the fixer or the reviewers listed after an
  edited reviewer.
- Expect a call the script makes only once an earlier result arrives, such as a retry, to take its
  place in that order from when the result arrived. A resume can hand replayed results back in
  another order than the live run received them, so such a call can get a new key and run live
  together with every call after it, even when nothing was edited. A later resume of the same run
  replays them, because the journal then holds the order the earlier resume produced.
- Expect a call that runs live again to receive other input than its earlier attempt saw whenever a
  call before it returned something new, such as a verifier reading reviewer reports that were
  written again.

## When to reach for it

- A run was stopped, killed, or crashed while one or more agents were **still working**, and those
  agents had done real work you do not want repaid twice.
- The persisted script file and the run's transcript directory still exist on disk.

## When NOT to

- The run died **before any agent produced substantial work**. There is nothing to carry forward;
  resume plainly.
- **Every agent completed** and the run failed after them (an error in the workflow script, a throw
  between phases). Their results are journaled; a plain resume replays them, apart from calls whose
  order changes as the section above describes, and this procedure buys nothing.
- An agent **completed with a bad result**. That is the opposite problem — see the boundary section
  at the end.
- The run **ended on its own**, whatever its exit. Its remaining items are recorded, and a new run
  starts only for what must be fixed. This skill is never a way to run the same spec again.

## The procedure

### 1. Locate the run transcript directory

- Find the run transcript directory at the path returned at launch, under the session's
  `subagents/workflows/<runId>/`. It holds `journal.jsonl` (the cached results — one result line
  per completed agent) plus, per spawned agent, an `agent-<id>.jsonl` transcript and a matching
  `agent-<id>.meta.json`. The meta file carries the agent type, the model and a spawn depth.
- Read the journal first: it is the evidence of which seats completed, so a seat holding a
  transcript with no result line against it is the one to treat as interrupted.
- Treat a result line that is itself EMPTY as a different case: that seat COMPLETED, and no prompt
  edit will make it replay as anything else — see the boundary section at the end of this file.

### 2. Map transcripts to seats — meta narrows, the transcript head decides

- Do not guess from filenames. The mapping is a two-stage discrimination, because the meta file
  holds a type, a model and a depth and nothing finer — no seat label, no prompt hash, no attempt
  marker.
- **Narrow a transcript to a seat TYPE with its meta.** Where every seat in the phase has a
  *distinct* agent type, that is the whole answer and the meta file alone maps it.
- **Settle same-type ties by reading the transcript's HEAD.** Two seats sharing an agent type *and*
  a model within the same attempt are indistinguishable in their metas. Open each transcript and
  read the **prompt at its head** — the seat brief sits verbatim at the top, and it is the thing
  that actually tells the seats apart. There is no cheaper discriminator; do not substitute one.
- **Use size and mtime only as a WEAK FIRST SORT across ATTEMPTS — never siblings, never
  conclusive.** A stopped-then-resumed run **reuses the same run id and the same transcript
  directory**, appending the new agents' files beside the old ones — which is why one seat can end
  up owning several transcripts. Size and mtime are good enough to pull those candidates out of the
  directory and order them, and no further: they do not establish which attempt holds the work.
  That is settled by rule 2's content test — open the transcript and look for findings, verdicts,
  intermediate conclusions. And between two same-type *siblings* they say nothing whatever.

Get this mapping wrong and you hand a seat someone else's work, which is the damage rule 1 exists to
prevent.

### 3. Append a resume note to the INTERRUPTED prompts only

- List the finished calls the script makes after the first interrupted call you would edit, before
  you edit it. Each of them runs live again, so a note saves the interrupted agent's work at the
  price of theirs. Add the notes only when the interrupted work they save outweighs the finished
  work they re-run, and resume plainly otherwise.
- Edit **the persisted script file**, whose path is also returned at launch, and append the resume
  note to the prompts of the interrupted agents and nothing else.
- Make the note tell the interrupted agent all six things:
  - an earlier attempt **of this exact seat** was interrupted **through no fault of its own** — the
    seat has to know the transcript is its own sound work, not output handed to it under suspicion;
  - its complete transcript is at `<absolute path>`;
  - **read it first**, then pick up where it left off;
  - carry every finding it already made **forward verbatim**;
  - **re-verify only if the code changed underneath** (rule 4 — not optional), and treat its
    prompt as the authority on its input: where an input differs from what the transcript shows,
    carry forward only the findings that input does not touch;
  - do not redo investigation it already completed; spend the effort on what it had **not yet
    covered**.

### 4. Leave every COMPLETED stage prompt byte-identical

- Leave every completed stage's prompt and options byte-identical. **Any** edit, a word or a space,
  gives that call and every call made after it a new key, so all of them run live, and its own
  result is thrown away as well. One stray edit early in the script can re-execute most of the run
  you were trying to salvage.
- Never reach a single seat by editing a shared constant either — see
  `workflow-skills:implement-review-verify`, law 3(a).

### 5. Re-invoke

- Re-invoke the workflow with the persisted script path and the **prior run id**. Finished calls
  made before the first edited or reordered call replay from the journal. That call and every call
  after it run live, the interrupted ones with their own transcript in hand.

## The resume note — where it goes in a prompt

Append the resume note last, after the shared blocks, on that seat's prompt alone:

```js
// ONE seat's note. Built per seat - the path is that seat's own transcript, nobody else's.
const RESUME_NOTE = [
  'RESUME NOTE. An earlier attempt at THIS EXACT SEAT was interrupted mid-flight, through no',
  'fault of its own. Its complete transcript is at <ABS>/agent-<id>.jsonl.',
  'READ IT FIRST and pick up where it left off. Carry every finding it already made forward',
  'VERBATIM, except where an input in this prompt differs from what the transcript shows: this',
  'prompt is the authority on its input. RE-VERIFY ONLY IF THE CODE CHANGED UNDERNEATH. Do not',
  'redo investigation it already completed - spend your effort on what it had not yet covered.',
].join('\n')

// Interrupted agent: note appended. Its key changes, and so do the keys of every later call.
const correctnessPrompt = [AUTHORITY, SPEC, SEAT_BRIEF, RESUME_NOTE].join('\n\n')
// Completed agent: untouched, byte for byte. Made before the first edited call, it replays.
const specCompliancePrompt = [AUTHORITY, SPEC, SEAT_BRIEF].join('\n\n')
```

## The rules

1. **SEAT ISOLATION — give each seat ONLY its own prior transcript.** Handing a seat another seat's
   transcript destroys the independence the whole review design rests on: seats are split by concern
   and kept unbriefed on purpose, and one that has read a peer's reasoning is no longer an
   independent verdict — a cold seat that has been shown someone else's findings is not cold any
   more.
2. **Reference a transcript only if it CARRIES FINDINGS — otherwise re-run the seat clean.** The
   test is content, not size: open the transcript and look for a finding, a verdict, an intermediate
   conclusion. One that holds only orientation work — tools loading, a first file read or two — has
   nothing to carry forward and will anchor a fresh agent on a half-formed direction; that seat gets
   **no resume note at all** and runs clean, like any seat with no prior attempt. Byte size is a
   weak first sort for picking candidates out of a directory and nothing more — never a threshold,
   because transcripts include harness echo and any figure stated in bytes rots the moment that
   volume changes. Where a seat does own several transcripts, point at the one bearing the findings
   and only that one: naming the others adds nothing to recover, dilutes the instruction, and the
   agent has no way to know which one you meant it to trust.
3. **Edit only the INTERRUPTED prompts, and count what each edit re-runs.** An interrupted agent has
   no result to throw away, so its own call costs nothing extra, but its new key gives every call
   made after it a new key too, and the finished calls among them run live. Editing a COMPLETED
   prompt throws away its result on top of that. Never edit prompts as a batch; edit exactly the
   interrupted set.
4. **Always include the re-verify-only-if-the-code-or-input-changed clause.** Without it, a resumed
   seat treats its own prior findings as unproven and burns its budget re-proving what was already
   established — which is the exact cost this procedure exists to avoid. With it, the seat re-checks
   only what the tree or its input changed underneath it and spends the rest of its effort on
   uncovered ground.

## What to expect

A seat that had effectively finished before the stop reads its transcript and re-emits its findings
almost immediately, instead of redoing the work. A partially-done seat continues from where it was.
The recovery is near-lossless, not lossless — the note is an instruction to the resumed agent, not a
restored context, so treat a resumed seat's output as its own work product and hold it to the same
contract as any other seat. The finished calls made after the first edited call run again as well,
and their results can differ from the ones they returned before the stop.

## Boundary — this is NOT the poisoned-result case

An interrupted run and a poisoned result are two different failures with two different fixes:

- **Interrupted** (this skill): no cached result exists for the interrupted call, so its edit costs
  no result of its own, only the re-run of the calls made after it. The fix is a resume note.
- **Completed with a bad result — an EMPTY journaled result included**: the bad result **is cached**
  and will replay verbatim on resume, so fixing the underlying cause and re-invoking changes nothing.
  The fix is a deliberate cache-bust of that single stage.

The cache-bust case is already covered — see `workflow-skills:implement-review-verify`, law 3
(*Cache-busting on resume*) and its *Resume corollaries*. Do not re-derive it here; the two paths
share only the journal mechanism, and each decision is recorded once.
