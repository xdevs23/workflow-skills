---
name: resume-interrupted-run
description: Resume a workflow run that was interrupted after agents did substantial work but before they returned results, and prepare a running workflow for the moment the machine shuts down. Not for agents that completed with bad results.
---

# Resume an interrupted run

**Load the `workflow-skills:writing-style` skill first.** The rules in it apply to every comment,
document, commit message and reply you write while you follow this skill. Load it whenever you work
with this plugin.

## What a resume runs again

- Expect the key of a call in the journal to come from the prompt of that call, from the options
  `schema`, `model`, `effort`, `isolation`, `agentType`, `disallowedTools` and `bashCommandClamp`
  set on that call, and from the key of the call made by the script just before it. A new key for
  one call therefore gives every later call made by the script a new key as well.
- Expect an edit of the prompt of a call, a word or a space, or of one of those options, a resume
  note or a switched model alike, to give that call a new key. An edit of any other option, such as
  `label`, `phase` or `stallMs`, does not change the key.
- Expect a resume to replay journaled results, in the order in which the script makes its calls, up
  to the first call that does not have a journaled result and was not interrupted. The journal shows
  an interrupted call as started, without a recorded failure. From that call on, every call runs
  live, also a call whose key and result are in the journal.
- Expect each of these calls to end the replay: a call whose key is not in the journal, such as an
  edited one; a call that failed or did not return a result, such as an attempt that died on an API
  error before its stage retried it; and a call that had not started when the run stopped. An
  attempt whose returned object then failed a check in the script has a journaled result, so it
  replays and does not end the replay. For example, the reviewers listed after an edited reviewer
  run again.
- Expect an interrupted call whose prompt and options you leave unchanged to run live without
  ending the replay, so the finished calls made after it replay until one of the calls above ends
  the replay.
- Expect a call made by the script only once an earlier result arrives, such as a retry, to take
  its place in the order from when that result arrived. A resume can return replayed results in
  another order than the order in which they arrived in the live run. Such a call can then get a key
  that is not in the journal and end the replay, even when nothing was edited.
- Expect a later resume of the same run to replay the calls run live by an earlier resume only when
  it makes them in the same order with the same keys, while none of the calls before them ends the
  replay. The order depends on when results arrive, so it can differ from one resume to the next.
- Expect a call that runs live again to receive other input than in its earlier attempt whenever a
  call before it returned something new, such as a later stage reading reports written again by the
  reviewers.

## A shutdown while a workflow runs

- When the user is about to shut down or reboot while a workflow runs, check that the files of the
  run are on a persistent disk: the script file, `journal.jsonl` and the `*.jsonl` transcripts of
  the agents.
- Parse every line of the journal, since a resume replays from it.
- Check with `pgrep` that no build or test process is writing, so the shutdown cannot leave a file
  half written.
- Write a resume note to `RESUME-<workflow>.md` in the local storage defined by
  `workflow-skills:local-cache`: the run ID, what is done and replays from the journal, what has
  not started, the exact call that resumes the run, the environment to bring up first, such as a
  database stack, and the uncommitted or untracked work left on disk.
- Tell the user that it is safe to power off, and name the two steps for the return.
- On the return, first bring up the environment that the agents need, with the safety checks of
  the project.
- Then resume with `Workflow({ scriptPath, resumeFromRunId })` from the script file on disk, and
  never send the script again. A resume needs only the script file and the journal, so any session
  can run it.
- Expect the finished agents to replay at once. Expect an agent that was interrupted while it ran
  to run again.

## When to use it

- Use this skill when a run was stopped, killed or crashed while one or more agents were **still
  working**, and you do not want to pay twice for the real work done by those agents.
- Use it also to prepare a running workflow before the machine shuts down, as the section on a
  shutdown while a workflow runs describes.
- Use it only while the persisted script file and the directory with the transcripts of the run
  still exist on disk.

## When not to use it

- Resume plainly when the run died **before any agent produced substantial work**, since there is
  nothing to carry forward.
- Resume plainly when **every agent completed** and the run failed after them, such as on an error
  in the workflow script or a throw between phases. The journal contains the results returned by
  those agents, and a plain resume replays them as far as the section on what a resume runs again
  describes. This procedure gains nothing there.
- Do not use this skill when an agent **completed with a bad result**, which is the opposite
  problem. The last section of this file describes that case.
- Never use this skill to run a run again that **ended without being stopped**, whatever its exit.

## The procedure

### Find the transcripts of the run

- Find the directory with the transcripts of the run at the path returned at launch, under
  `subagents/workflows/<runId>/` in the directory of the session. It contains `journal.jsonl`, with
  the cached results in one line per completed agent, and, for each spawned agent, an
  `agent-<id>.jsonl` transcript and a matching `agent-<id>.meta.json`. The meta file contains the
  agent type, the model and the depth at which the agent was spawned.
- Read the journal first, since it shows which agents completed. Treat an agent as interrupted when
  it has a transcript but no result line in the journal.
- Treat an EMPTY result line as a different case. That agent COMPLETED, and an edit of the prompt
  written for that agent cannot make it replay as anything else. The last section of this file
  describes that case.

### Match each transcript to an agent

- Do not guess from filenames. Match in two steps, because the meta file contains only a type, a
  model and a depth. It does not contain the label of the agent, a hash of the prompt or the number
  of the attempt.
- **First narrow a transcript down to an agent TYPE with the meta file beside it.** Where every
  agent in the phase has a *distinct* agent type, the meta file alone is enough to match it.
- **Tell agents of the same type apart by the start of each transcript.** Two agents with the same
  agent type *and* the same model in the same attempt have identical meta files. Open each
  transcript and read the **prompt at the start of the transcript**. The brief given to the agent is
  there verbatim, and only that brief differs between the agents. Use nothing cheaper in its place,
  since nothing cheaper works.
- **Use size and mtime only to sort the transcripts of several ATTEMPTS roughly, never to tell
  siblings apart and never as proof.** A run that was stopped and resumed **uses the same run id
  and the same directory of transcripts again**, and the files of the new agents are added beside
  the old ones. One agent can therefore have several transcripts. Size and mtime are good enough to
  pick those candidates out of the directory and order them, and no further. Decide which attempt
  contains the work by the content test of rule 2: open the transcript and look for findings,
  verdicts and intermediate conclusions. Between two *siblings* of the same type, size and mtime
  show nothing at all.
- Get the mapping right before you go on. With a wrong mapping you hand an agent the work of
  another agent, which is the damage prevented by rule 1.

### Append a resume note to the prompts of the INTERRUPTED agents only

- Before you edit anything, list the finished calls made by the script after the first interrupted
  call to edit. Each of them runs live again, so a note saves the work of the interrupted agent at
  the price of running those finished calls again.
- Add the notes only when the interrupted work saved by them outweighs the finished work run again
  because of them. Resume plainly otherwise.
- Edit **the persisted script file**, whose path is also returned at launch.
- Append the resume note to the prompts of the interrupted agents and to nothing else.
- Tell the interrupted agent all seven of these things in the note:
  - an earlier attempt **by this exact agent** was interrupted **through no fault of the agent**,
    because the agent has to know that the transcript contains sound work done by this agent and
    can be trusted;
  - the complete transcript of that attempt is at `<absolute path>`;
  - **read it first**, then pick up where it left off;
  - where an input in the prompt of the agent differs from what the transcript shows, the prompt
    is the authority on that input;
  - **verify again only what the code or an input that differs from the transcript changed
    underneath**, the findings based on it included (rule 4, not optional);
  - carry every other finding it already made **forward verbatim**;
  - do not redo any other investigation it already completed, and spend the effort on what it had
    **not yet covered**.

### Leave the prompt of every COMPLETED stage byte-identical

- Leave the prompt of every completed stage byte-identical, together with the options that make up
  its key. **Any** edit of either, a word or a space, gives that call a new key and ends the replay
  there, as the section on what a resume runs again describes. The result of that call is thrown
  away as well. One stray edit early in the script can make most of the run execute again.
- Never change the prompt of a single agent by editing a shared constant either. A constant such as
  `RULES` is part of the prompt of every stage built from it, so editing it also edits the
  completed prompts among them.

### Invoke the workflow again

- Invoke the workflow again with the persisted script path and the **earlier run id**. Finished
  calls replay from the journal up to the first call that ends the replay, as the section on what a
  resume runs again describes. That call and every call after it run live, the interrupted ones
  with the transcripts of their earlier attempts in hand.

## Where the resume note goes in a prompt

- Append the resume note last, after the shared blocks, to the prompt of that one agent alone:

```js
// The note for ONE agent. Build one per agent: the path points at the transcript of that agent.
const RESUME_NOTE = [
  'RESUME NOTE. An earlier attempt by THIS EXACT AGENT was interrupted mid-flight, through no',
  'fault of that attempt. Its complete transcript is at <ABS>/agent-<id>.jsonl.',
  'READ IT FIRST and pick up where it left off. Where an input in this prompt differs from what',
  'the transcript shows, this prompt is the authority on that input. VERIFY AGAIN ONLY WHAT THE',
  'CODE OR SUCH A DIFFERING INPUT CHANGED UNDERNEATH, the findings based on it included. Carry',
  'every other finding it already made forward VERBATIM. Do not redo any other investigation it',
  'already completed. Spend your effort on what it had not yet covered.',
].join('\n')

// Editing this call also changes the key of every later call.
const correctnessPrompt = [RULES, SEAT_BRIEF, RESUME_NOTE].join('\n\n')
// Replays only when made before the first call that ends the replay.
const scopePrompt = [RULES, SEAT_BRIEF].join('\n\n')
```

## The rules

1. **Give each agent ONLY the transcript of the earlier attempt by that same agent.** Never hand an
   agent the transcript of another agent.
2. **Point at a transcript only if it CONTAINS FINDINGS. Otherwise run the agent again from a clean
   start.** Judge by the content of the transcript: open it and look for a finding, a verdict or an
   intermediate conclusion. A transcript with only orientation work, such as tools loading or a
   first file read or two, has nothing to carry forward and pulls a fresh agent toward a half-formed
   direction. Do not give that agent a resume note at all, and let it run from a clean start, like
   any agent without an earlier attempt. Use byte size only to sort candidates roughly as you pick
   them out of a directory, never as a threshold, because transcripts include output echoed by the
   harness and any figure in bytes goes stale the moment that output grows or shrinks. Where an
   agent does have several transcripts, point at the one with the findings and only that one.
   Naming the others adds nothing to recover and weakens the instruction. The agent also cannot
   know which one you meant it to trust.
3. **Edit only the prompts of the INTERRUPTED agents, and count what each edit runs again.** An
   interrupted agent does not have a result to throw away, so its call costs nothing extra. Its new
   key still gives every call made after it a new key too, and the finished calls among them run
   live. Editing the prompt of a COMPLETED agent throws away the result returned by that agent on
   top of that. Never edit prompts as a batch. Edit exactly the prompts of the interrupted agents.
4. **Always include the clause on verifying again only what the code or a differing input changed.**
   Without it, a resumed agent treats the findings made in the earlier attempt as unproven and
   spends its budget proving again what was already established.  With the clause, the agent checks
   again what the tree or a differing input changed underneath it, the findings based on that
   included, and spends the rest of its effort on what it had not yet covered.

## What to expect

- Expect an agent that had effectively finished before the stop to read the transcript of that
  attempt and return the findings in it again almost at once, instead of redoing the work.
- Expect an agent that was partly done to continue from where it was.
- Treat the output of a resumed agent as work done by that agent, and hold it to the same contract
  as the output of any other agent. The note instructs the resumed agent but does not bring back the
  context of the earlier attempt. The recovery therefore loses very little of the earlier work, yet
  more than nothing.
- Expect the finished calls after the first call that ends the replay to run again as well. The
  results of those calls can differ from the results returned before the stop.

## Interrupted runs and bad results

An interrupted run and an agent that completed with a bad result are different failures with
different fixes.

- **Interrupted**, the case of this skill: the journal does not contain a cached result for the
  interrupted call, so editing it costs only the new run of the calls made after it. The fix is a
  resume note.
- **Completed with a bad result, an EMPTY journaled result included**: the bad result **is cached**
  and replays verbatim on resume, so fixing the underlying cause and invoking the workflow again
  changes nothing. Do not edit the prompt of that agent to make it run again. It is a completed
  prompt, so leave it byte-identical. The run treats the replayed result like any other result.
  Once the run has ended, fix what is wrong in the result the way you fix any other wrong result of
  the run.
