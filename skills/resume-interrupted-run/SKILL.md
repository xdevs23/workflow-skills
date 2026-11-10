---
name: resume-interrupted-run
description: Resume workflow run interrupted after agents did substantial work but before they returned results, and prepare running workflow for machine shutdown. Not for agents that completed with bad results
---

## What a resume runs again

- Expect key of a call in journal to come from: prompt of that call; options `schema`, `model`,
  `effort`, `isolation`, `agentType`, `disallowedTools` and `bashCommandClamp` set on that call;
  key of call made by script just before it. Any edit of prompt or one of those options, even a
  word or a space, resume note or switched model alike, gives that call new key. Edit of any other
  option, e.g. `label`, `phase` or `stallMs`, does not change key. New key for one call gives every
  later call made by script a new key as well
- Expect resume to replay journaled results, in order in which script makes its calls, up to first
  call that does not have a journaled result and was not interrupted: call whose key is not in
  journal, e.g. an edited one; call that failed or did not return a result, e.g. attempt that died
  on API error before its stage retried it; call not yet started when run stopped. Journal shows
  interrupted call as started, without recorded failure. Attempt whose returned object then failed
  a check in script has journaled result, so it replays and does not end replay. From first call
  that ends replay on, every call runs live, also a call whose key and result are in journal.
  Example: reviewers listed after an edited reviewer run again
- Expect interrupted call whose prompt and options are left unchanged to run live without ending
  replay, so finished calls made after it replay until one of calls above ends replay
- Expect call made by script only once an earlier result arrives, e.g. a retry, to take its place
  in order from when that result arrived. Resume can return replayed results in another order than
  order in which they arrived during live run. Such a call can then get a key not in journal and end
  replay, even when nothing was edited
- Expect later resume of same run to replay calls run live by earlier resume only when it makes
  them in same order with same keys, while none of calls before them ends replay. Order depends on
  when results arrive, so it can differ from one resume to next
- Expect call that runs live again to receive other input than in its earlier attempt whenever a
  call before it returned something new, e.g. later stage reading reports written again by
  reviewers

## A shutdown while a workflow runs

- When user is about to shut down or reboot while workflow runs, check files of run are on
  persistent disk: script file, `journal.jsonl` and `*.jsonl` transcripts of agents
- Parse every line of journal, since resume replays from it
- Check with `pgrep` that build and test processes are not writing, so shutdown cannot leave a file
  half written
- Write resume note to `RESUME-<workflow>.md` in local storage defined by
  `workflow-skills:local-cache`: run ID, what is done and replays from journal, what has not
  started, exact call that resumes run, environment to bring up first (e.g. database stack),
  uncommitted or untracked work left on disk
- Tell user it is safe to power off. Name the two steps for return
- On return, first bring up environment needed by agents, with safety checks of project
- Then resume with `Workflow({ scriptPath, resumeFromRunId })` from script file on disk. Never send
  script again. Resume needs only script file and journal, so any session can run it

## When to use it

- Use this skill when run was stopped, killed or crashed while one or more agents were **still
  working**, and you do not want to pay twice for real work done by those agents
- Use it also to prepare running workflow before machine shuts down, as section on a shutdown while
  a workflow runs describes
- Use it only while persisted script file and directory with transcripts of run still exist on
  disk

## When not to use it

- Resume plainly when run died **before any agent produced substantial work**: nothing to carry
  forward
- Resume plainly when **every agent completed** and run failed after them, e.g. on error in
  workflow script or throw between phases. Journal contains results returned by those agents, and
  plain resume replays them as far as section on what a resume runs again describes. This
  procedure gains nothing there
- Do not use this skill when an agent **completed with a bad result**, the opposite problem. Last
  section of this file describes that case
- Never use this skill to run again a run that **ended without being stopped**, whatever its exit

## The procedure

### Find the transcripts of the run

- Find directory with transcripts of run at path returned at launch, under
  `subagents/workflows/<runId>/` in directory of session. It contains `journal.jsonl`, with cached
  results one line per completed agent, and, per spawned agent, an `agent-<id>.jsonl` transcript
  and matching `agent-<id>.meta.json`. Meta file contains agent type, model and depth at which
  agent was spawned
- Read journal first, since it shows which agents completed. Treat agent as interrupted when it has
  transcript but not a result line in journal
- Treat EMPTY result line as different case. That agent COMPLETED, and edit of prompt written for
  it cannot make it replay as anything else. Last section of this file describes that case

### Match each transcript to an agent

- Do not guess from filenames. Match in two steps, because meta file contains neither label of
  agent, hash of prompt nor number of attempt
- **First narrow a transcript down to an agent TYPE with the meta file beside it.** Where every
  agent in phase has *distinct* agent type, meta file alone is enough to match it
- **Tell agents of the same type apart by the start of each transcript.** Two agents with same
  agent type *and* same model in same attempt have identical meta files. Open each transcript, read
  the **prompt at the start of the transcript**. Brief given to agent is there verbatim, and only
  that brief differs between agents
- **Use size and mtime only to pick the transcripts of several ATTEMPTS out of directory and sort
  them roughly, never to tell siblings apart, never as proof and never as threshold.** Run stopped
  and resumed **uses the same run id and the same directory of transcripts again**. Files of new
  agents get added beside old ones. So one agent can have several transcripts. Transcripts include
  output echoed by harness, and any figure in bytes goes stale the moment that output grows or
  shrinks. Decide which attempt contains the work by content test of rule 2
- Get mapping right before going on. With wrong mapping you hand an agent work of another agent:
  the damage prevented by rule 1

### Append a resume note to the prompts of the INTERRUPTED agents only

- Before editing anything, list finished calls made by script after first interrupted call to
  edit. Each of them runs live again, so a note saves work of interrupted agent at price of running
  those finished calls again
- Add notes only when interrupted work saved by them outweighs finished work run again because of
  them.
  Otherwise resume plainly
- Edit **the persisted script file**, whose path is also returned at launch
- Tell interrupted agent all eight of these things in note:
  - earlier attempt **by this exact agent** was interrupted **through no fault of the agent**,
    because agent must know transcript contains sound work by this agent and can be trusted;
  - complete transcript of that attempt is at `<absolute path>`;
  - **read it first**, then pick up where it left off;
  - **leave out content blocks of type `thinking` and `redacted_thinking`** while reading it. The
    API refuses request that contains thinking of another request;
  - where an input in prompt of agent differs from what transcript shows, prompt is authority on
    that input;
  - **verify again only what the code or an input that differs from the transcript changed
    underneath**, findings based on it included (required by rule 4);
  - carry every other finding already made by it **forward verbatim**;
  - do not redo any other investigation already completed by it, and spend effort on what it had
    **not yet covered**

### Leave the prompt of every COMPLETED stage byte-identical

- Leave prompt of every completed stage byte-identical, with options that make up its key. **Any**
  edit of either, a word or a space, throws away result of that call and ends replay there, as
  section on what a resume runs again describes. One stray edit early in script can make most of run
  execute again
- Never change prompt of single agent by editing shared constant either. Constant such as `RULES`
  is part of prompt of every stage built from it, so editing it also edits completed prompts among
  them

### Invoke the workflow again

- Invoke workflow again with persisted script path and **earlier run id**. Interrupted agents run
  live with transcripts of their earlier attempts in hand

## Where the resume note goes in a prompt

- Append resume note last, after shared blocks, to prompt of that one agent alone:

```js
// The note for ONE agent. Build one per agent: the path points at the transcript of that agent.
const RESUME_NOTE = [
  'RESUME NOTE. An earlier attempt by THIS EXACT AGENT was interrupted mid-flight, through no',
  'fault of that attempt. Its complete transcript is at <ABS>/agent-<id>.jsonl.',
  'READ IT FIRST and pick up where it left off. Filter out its content blocks of type thinking',
  'and redacted_thinking before reading it: the API refuses a request that contains them.',
  'Where an input in this prompt differs from what',
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
   agent transcript of another agent
2. **Point at a transcript only if it CONTAINS FINDINGS. Otherwise run the agent again from a clean
   start.** Judge by content of transcript: open it, look for a finding, verdict or intermediate
   conclusion. Transcript with only orientation work, e.g. tools loading or first file read or two,
   has nothing to carry forward and pulls fresh agent toward half-formed direction. Do not give that
   agent a resume note at all. Let it run from clean start, like any agent without earlier attempt.
   Where agent does have several transcripts, point at the one with findings and only that one.
   Naming the others adds nothing to recover and weakens instruction. Agent also cannot know which
   one you meant it to trust
3. **Edit only the prompts of the INTERRUPTED agents, and count what each edit runs again.**
   Interrupted agent does not have a result to throw away, so its call costs nothing extra. Editing
   prompt of a COMPLETED agent throws away result returned by that agent on top of that. Never edit
   prompts as a batch
4. **Always include the clause on verifying again only what the code or a differing input changed.**
   Without it, resumed agent treats findings of earlier attempt as unproven and spends its budget
   proving again what was already established. With clause, agent checks again what tree or
   differing input changed underneath it, findings based on that included, and spends rest of its
   effort on what it had not yet covered

## What to expect

- Expect agent that had effectively finished before stop to read transcript of that attempt and
  return findings in it again almost at once, instead of redoing work
- Expect agent that was partly done to continue from where it was
- Treat output of resumed agent as work done by that agent. Hold it to same contract as output of
  any other agent. Note instructs resumed agent but does not bring back context of earlier attempt.
  So recovery loses very little of earlier work, yet more than nothing
- Results of finished calls run again after first call that ends replay can differ from results
  returned before stop

## Agents that completed with a bad result

- **Completed with a bad result, an EMPTY journaled result included**: bad result **is cached** and
  replays verbatim on resume, so fixing underlying cause and invoking workflow again changes
  nothing. Run treats replayed result like any other result. Once run has ended, fix what is wrong
  in result the way you fix any other wrong result of run
