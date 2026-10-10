---
name: resume-interrupted-run
description: Resumes a workflow run interrupted after agents did substantial work but before they returned results. Not for completed agents with bad results.
---

# Resume an Interrupted Run: hand each mid-flight seat its own transcript back

**Load the `workflow-skills:writing-style` skill first.** It binds every comment, document, commit
message and reply this skill produces, and it is not optional when working with this plugin.

A run's journal holds the result of every `agent()` call that finished, and a resume replays those
results as far as the next section describes. An agent that was still working when the run stopped
has **no journaled result**, so the resume starts it from an empty context: every file it read,
every finding it had already established, gone, re-derived from scratch on the resumed run's
budget. Meanwhile its transcript is sitting on disk, complete up to the moment of the stop.

This skill is that one move: **give each interrupted seat its own prior transcript back, inside its own
prompt, before resuming.** Everything else here exists to keep that move from damaging the run it is
rescuing.

## What a resume runs again

- Expect the journal key of a call to come from its prompt, from its options `schema`, `model`,
  `effort`, `isolation`, `agentType`, `disallowedTools` and `bashCommandClamp`, and from the key of
  the call the script made just before it. A new key for one call therefore gives every call the
  script makes after it a new key as well.
- Expect an edit of a call's prompt, a word or a space, or of one of those options, a resume note
  or a switched model alike, to give that call a new key. An edit of any other option, such as
  `label`, `phase` or `stallMs`, leaves the key as it was.
- Expect a resume to replay journaled results, in the order the script makes its calls, up to the
  first call that has no journaled result and was not interrupted. The journal shows an interrupted
  call as started, with no failure recorded for it. From that call on, every call runs live, also
  one whose key the journal holds with a result.
- Expect each of these calls to end the replay: a call whose key the journal does not hold, such as
  an edited one, a call that failed or returned no result, such as an attempt that died on an API
  error before its stage retried it, and a call that had not started when the run stopped. An
  attempt that returned an object the script's check then refused holds a journaled result, so it
  replays and does not end the replay. After an edited call this means, for example, that the
  reviewers listed after an edited reviewer run again.
- Expect an interrupted call whose prompt and options you leave unchanged to run live without
  ending the replay, so the finished calls made after it replay until one of the calls above ends
  the replay.
- Expect a call the script makes only once an earlier result arrives, such as a retry, to take its
  place in the order from when that result arrived. A resume can hand replayed results back in
  another order than the live run received them, so such a call can get a key the journal does not
  hold and end the replay, even when nothing was edited.
- Expect a later resume of the same run to replay the calls an earlier resume ran live only when it
  makes them in the same order with the same keys and no call before them ends the replay. The
  order depends on when results arrive, so one resume does not settle it for the next.
- Expect a call that runs live again to receive other input than its earlier attempt saw whenever a
  call before it returned something new, such as a later stage reading reviewer reports that were
  written again.

## When to reach for it

- A run was stopped, killed, or crashed while one or more agents were **still working**, and those
  agents had done real work you do not want repaid twice.
- The persisted script file and the run's transcript directory still exist on disk.

## When NOT to

- The run died **before any agent produced substantial work**. There is nothing to carry forward;
  resume plainly.
- **Every agent completed** and the run failed after them (an error in the workflow script, a throw
  between phases). Their results are journaled; a plain resume replays them as far as the section
  above describes, and this procedure buys nothing.
- An agent **completed with a bad result**. That is the opposite problem. See the boundary section
  at the end.
- The run **ended on its own**, whatever its exit. This skill is never a way to run a finished run
  again.

## The procedure

### 1. Locate the run transcript directory

- Find the run transcript directory at the path returned at launch, under the session's
  `subagents/workflows/<runId>/`. It holds `journal.jsonl` (the cached results, one result line
  per completed agent) plus, per spawned agent, an `agent-<id>.jsonl` transcript and a matching
  `agent-<id>.meta.json`. The meta file carries the agent type, the model and a spawn depth.
- Read the journal first: it is the evidence of which seats completed, so a seat holding a
  transcript with no result line against it is the one to treat as interrupted.
- Treat a result line that is itself EMPTY as a different case: that seat COMPLETED, and no prompt
  edit will make it replay as anything else. See the boundary section at the end of this file.

### 2. Map transcripts to seats: meta narrows, the transcript head decides

- Do not guess from filenames. The mapping is a two-stage discrimination, because the meta file
  holds a type, a model and a depth and nothing finer: no seat label, no prompt hash, no attempt
  marker.
- **Narrow a transcript to a seat TYPE with its meta.** Where every seat in the phase has a
  *distinct* agent type, that is the whole answer and the meta file alone maps it.
- **Settle same-type ties by reading the transcript's HEAD.** Two seats sharing an agent type *and*
  a model within the same attempt are indistinguishable in their metas. Open each transcript and
  read the **prompt at its head**: the seat brief sits verbatim at the top, and it is the thing
  that actually tells the seats apart. There is no cheaper discriminator; do not substitute one.
- **Use size and mtime only as a WEAK FIRST SORT across ATTEMPTS, never siblings, never
  conclusive.** A stopped-then-resumed run **reuses the same run id and the same transcript
  directory**, appending the new agents' files beside the old ones, which is why one seat can end
  up owning several transcripts. Size and mtime are good enough to pull those candidates out of the
  directory and order them, and no further: they do not establish which attempt holds the work.
  That is settled by rule 2's content test: open the transcript and look for findings, verdicts,
  intermediate conclusions. And between two same-type *siblings* they say nothing whatever.

Get this mapping wrong and you hand a seat someone else's work, which is the damage rule 1 exists to
prevent.

### 3. Append a resume note to the INTERRUPTED prompts only

- List the finished calls the script makes after the first interrupted call you would edit, before
  you edit it. Each of them runs live again, so a note saves the interrupted agent's work at the
  price of theirs.
- Add the notes only when the interrupted work they save outweighs the finished work they re-run,
  and resume plainly otherwise.
- Edit **the persisted script file**, whose path is also returned at launch, and append the resume
  note to the prompts of the interrupted agents and nothing else.
- Make the note tell the interrupted agent all seven things:
  - an earlier attempt **of this exact seat** was interrupted **through no fault of its own**,
    because the seat has to know the transcript is its own sound work, not output handed to it
    under suspicion;
  - its complete transcript is at `<absolute path>`;
  - **read it first**, then pick up where it left off;
  - its prompt is the authority on its input, where an input differs from what the transcript
    shows;
  - **re-verify only what the code or an input that differs from the transcript changed
    underneath**, the findings that rest on it included (rule 4, not optional);
  - carry every other finding it already made **forward verbatim**;
  - do not redo any other investigation it already completed; spend the effort on what it had **not
    yet covered**.

### 4. Leave every COMPLETED stage prompt byte-identical

- Leave every completed stage's prompt byte-identical, and leave the options its key covers
  unchanged. **Any** edit of either, a word or a space, gives that call a new key and ends the
  replay there, as the first section describes, and its own result is thrown away as well. One
  stray edit early in the script can re-execute most of the run you were trying to salvage.
- Never reach a single seat by editing a shared constant either. A constant such as `RULES`
  goes into the prompt of every stage built from it, so an edit of it edits the completed prompts
  among them as well.

### 5. Re-invoke

- Re-invoke the workflow with the persisted script path and the **prior run id**. Finished calls
  replay from the journal up to the first call that ends the replay, as the first section
  describes. That call and every call after it run live, the interrupted ones with their own
  transcript in hand.

## The resume note: where it goes in a prompt

Append the resume note last, after the shared blocks, on that seat's prompt alone:

```js
// ONE seat's note. Built per seat - the path is that seat's own transcript, nobody else's.
const RESUME_NOTE = [
  'RESUME NOTE. An earlier attempt at THIS EXACT SEAT was interrupted mid-flight, through no',
  'fault of its own. Its complete transcript is at <ABS>/agent-<id>.jsonl.',
  'READ IT FIRST and pick up where it left off. Where an input in this prompt differs from what',
  'the transcript shows, this prompt is the authority on that input. RE-VERIFY ONLY WHAT THE CODE',
  'OR SUCH A DIFFERING INPUT CHANGED UNDERNEATH, the findings that rest on it included. Carry',
  'every other finding it already made forward VERBATIM. Do not redo any other investigation it',
  'already completed - spend your effort on what it had not yet covered.',
].join('\n')

// Editing this call also changes every later call's key.
const correctnessPrompt = [RULES, SEAT_BRIEF, RESUME_NOTE].join('\n\n')
// Replays only when made before the first call that ends the replay.
const scopePrompt = [RULES, SEAT_BRIEF].join('\n\n')
```

## The rules

1. **SEAT ISOLATION: give each seat ONLY its own prior transcript.** Handing a seat another seat's
   transcript destroys the independence the whole review design rests on: seats are split by concern
   and kept unbriefed on purpose, and one that has read a peer's reasoning is no longer an
   independent verdict. An unbriefed seat that has been shown someone else's findings is not
   unbriefed any more.
2. **Reference a transcript only if it CARRIES FINDINGS, otherwise re-run the seat clean.** The
   test is content, not size: open the transcript and look for a finding, a verdict, an intermediate
   conclusion. One that holds only orientation work, such as tools loading or a first file read or
   two, has nothing to carry forward and will anchor a fresh agent on a half-formed direction; that
   seat gets **no resume note at all** and runs clean, like any seat with no prior attempt. Byte
   size is a weak first sort for picking candidates out of a directory and nothing more, never a
   threshold, because transcripts include harness echo and any figure stated in bytes rots the
   moment that volume changes. Where a seat does own several transcripts, point at the one bearing
   the findings and only that one: naming the others adds nothing to recover, dilutes the
   instruction, and the agent has no way to know which one you meant it to trust.
3. **Edit only the INTERRUPTED prompts, and count what each edit re-runs.** An interrupted agent has
   no result to throw away, so its own call costs nothing extra, but its new key gives every call
   made after it a new key too, and the finished calls among them run live. Editing a COMPLETED
   prompt throws away its result on top of that. Never edit prompts as a batch; edit exactly the
   interrupted set.
4. **Always include the re-verify-only-if-the-code-or-input-changed clause.** Without it, a resumed
   seat treats its own prior findings as unproven and burns its budget re-proving what was already
   established, which is the exact cost this procedure exists to avoid. With it, the seat re-checks
   what the tree or a differing input changed underneath it, the findings that rest on that
   included, and spends the rest of its effort on what it had not yet covered.

## What to expect

A seat that had effectively finished before the stop reads its transcript and re-emits its findings
almost immediately, instead of redoing the work. A partially-done seat continues from where it was.
The recovery is near-lossless, not lossless: the note is an instruction to the resumed agent, not a
restored context, so treat a resumed seat's output as its own work product and hold it to the same
contract as any other seat. The finished calls after the first call that ends the replay run again
as well, and their results can differ from the ones they returned before the stop.

## Boundary: this is NOT the poisoned-result case

An interrupted run and a poisoned result are two different failures with two different fixes:

- **Interrupted** (this skill): no cached result exists for the interrupted call, so its edit costs
  no result of its own, only the re-run of the calls made after it. The fix is a resume note.
- **Completed with a bad result, an EMPTY journaled result included**: the bad result **is cached**
  and will replay verbatim on resume, so fixing the underlying cause and re-invoking changes nothing.
  Editing its prompt to make it run again is the edit of a completed prompt that step 4 forbids.
  The run treats the replayed result like any other result it receives, and you fix what the result
  leaves wrong once the run has ended, the way you fix any other wrong result of the run.
