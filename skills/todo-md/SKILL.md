---
name: todo-md
description: Track work of project. See what's in progress and what should be done next.
---

`TODO.md` is record of where project stands. Anyone picking up project, such as new session, new
contributor or agent without history, reads that file first. Then knows where things stand. File
is not authority about state outside itself. Read code and git state first before trusting
anything in this file.

# Purpose

- Keep local status of project in `TODO.md`.
- Record in `TODO.md` every fact about how far project has progressed that is recorded nowhere
  else. Do not use it as diary, for internal facts or for decisions that do not need to be recorded.
  You can use notes from `workflow-skills:implement` to write down decisions of user for a unit.
- Use `TODO.md` as tracker of units of work, like an issue tracker would be used for.
- Write entry only for work asked for by user, work planned with user, and work being done.
- Do not write entry for task that changes nothing in project.
- Treat state in `TODO.md` as last state written down by someone. Before you report state or act on
  it, check work against branches, history of main branch, pull requests and deployment where it
  would show up. Correct entry first. Ask user for what you cannot check yourself before making
  claim about which user would get upset.

`TODO.md` is **gitignored and untracked**: working file on one machine, kept out of repository.
Fresh clone does not contain it.

- When item finished, code represents **design** and **diff** is in git. Then delete entry for
  item from `TODO.md`. Item finished once `VERIFIED`, or `PUSHED` in project that is not deployed.
- Delete entry also when user says so, or when it is fix of older defect and fix is merged. Never
  delete entry for any other reason.
- Remove deleted entry from every `Builds on:` line that lists it.
- Do not explain again in `TODO.md` what is already tracked somewhere else, even if uncommitted.

# Layout of the file

- Write entries in order of their numbers, so newest entry is last one in file.
- Write nothing else into file. File is neither diary nor your personal scratchpad.

# Anatomy of an entry

```
### #142 - Reaction emoji support - RECORDED
<body: what it is, where it stands and what is owed>
```

- **`### #<number> - <title>`**: number is id in tracker and never changes. Write in title what
  item *is*. Leave state to state marker. If project uses separate convention for ids, keep
  internal numbering as it is and add project id on top, for example:
  `#142 - GH #73 - Reaction emoji support - RECORDED`
  `#165 - ABC-210 - User type 'editor' - IN PROGRESS`
- **`- <STATE>`**: state marker, in uppercase, after separator dash used by format.
- **Date**: do not add date. Commit messages and time at which file was last changed already give
  date.
- **Body**: prose with what item is, where it stands, what is still to be done. Put run logs and
  history of work into local storage defined by `workflow-skills:local-cache`, never into entry.
- **Origin pointer**: `<transcript>.jsonl:<line>:<promptId or uuid>`. Session transcript and line
  with first message of conversation that raised item. Give every entry one. To find line, search
  directory with session transcripts of project for promptId or uuid, or read given line directly.
- **`Builds on:`**: line with every entry that has to be built first. Write dependency between
  entries in this line and nowhere else.
- When you report on several entries, show chains of `Builds on:` lines that concern them in
  message.

## One behavior to a unit

- Give unit one behavior: something stated in one sentence, such as "the profile page shows the
  avatar".
- Split feature, or anything bigger than small patch, into sub-units, each covering one aspect.
  Such as one behavior or one module.
- Add sub-units of unit once its draft approved, as `workflow-skills:implement` describes, before
  building of unit starts. Never write sub-units in advance.
- Word unit that removes violations of rule by what rule is for, such as "a value sent by the
  server and unknown to this build becomes an explicit unknown value where it arrives". Never word
  it as check to make pass, such as "make the lint pass".
- Give each sub-unit fourth-level entry in dot notation under entry to which it belongs, in shape of
  any other entry, and `Builds on:` line listing sub-units needed by it first. Nest sub-units deeper
  in dot notation, such as `#383.1.1` under `#383.1`:

  ```
  ### #383 - Profile avatars - IN PROGRESS
  #### #383.1 - The profile page shows the avatar - BUILT
  <body>
  Origin: <pointer>
  #### #383.2 - The avatar can be replaced - IN PROGRESS
  Builds on: #383.1
  <body>
  Origin: <pointer>
  #### #383.3 - A replaced avatar is resized to the sizes used on the page - QUEUED
  Builds on: #383.2
  <body>
  Origin: <pointer>
  ```

- Give every entry that has sub-units state of least advanced sub-unit under it.
- Build each sub-unit without sub-units of its own as separate unit, in separate worktree and on
  separate branch, with one or more workflow runs. You may start building on whatever base suits
  work.
- Deliver each sub-unit separately, such as through separate pull request against main branch of
  project. Only once every sub-unit listed in its `Builds on:` line is merged there. Pull request
  is request that can be rejected.
- When delivery of sub-unit rejected, deliver none of sub-units that build on it. Ask user how to go
  on as section `Questions to the user` describes.

## Findings raised while building a unit

- Fix finding about code added or edited by unit in unit itself. Never record it.
- Put finding, also one about older code, to user as question when fixing it needs decision by
  user, as section `Questions to the user` describes.
- Record work left over from unit as sub-unit of entry for that unit, never as new entry. Its
  origin pointer: message that asked for unit.
- Record work left over from unit whose entry was deleted as finished as new entry. Name finished
  unit in its body.
- Fix defect in older code outside unit, such as flaky test harness, as separate unit in parallel
  with unit.
- Start fix of older defect without asking user. It is the one unit started by you without user's
  word.
- Build fix of older defect by `workflow-skills:implement`, with defect and its evidence in place of
  notes and without draft, in worktree and on branch of its own.
- Deliver fix of older defect on its own, through pull request or review of its own.
- Record fix of older defect as `IN PROGRESS` entry while it runs. Its origin pointer: message that
  asked for unit that found defect. Delete entry once fix merged.
- Add fix of older defect to `Builds on:` line of unit when unit cannot work without it.

# Questions to the user

- Ask each question first as `workflow-skills:question` describes. Act on answer found by subagent.
- Put question to user only when subagent does not find an answer in project. Use tool
  `mcp__workflow-skills__ask_question`. Entry concerned by it waits for answer. Meanwhile go on with
  next entry.
- Name entry in each question by its number and title.
- Take answer that arrives with tool result, or as message, as user's own reply. Act on it as on
  any other reply of user.

# The states an entry can take

State is fixed enum: either no marker or one of markers listed here, grouped by where item stands.

**Recorded**

- `RECORDED`: captured so it is not lost. Deliberately not started.

**Waiting on a decision**

- `NEEDS DECISION`: work cannot go on until question answered or theory defined. Write into entry,
  in plain terms, question and options, or that theory is missing. That would start discussion
  thread about feature.
- Mark unit or sub-unit that does not have enough information to start `NEEDS DECISION`.
- **A decision still owed blocks only the item concerned by it.** Skip and mark item. Move work on
  to next one.
- Work on smallest change possible where answer from user does not change outcome.
- Ask question once, as section `Questions to the user` describes. Do not repeat it while user is
  away.

**Ready to build**

- `READY`: design agreed and written down, for example in notes of `workflow-skills:implement`.
- Mark sub-unit `READY` once everything needed by it is clear.
- `QUEUED`: unit can be built at any time, even if session is wiped and started fresh.

Whether unit is ready to build follows from words of user alone.

- Never decide it yourself.
- When you infer authorization from prompt of user because its words are ambiguous, state that
  plainly **in bold** and ask user to confirm.

**Being built**

- `IN PROGRESS`: under construction. Name workflow id if one is running, so later reader can find
  transcript.

**Built and not yet live**

- `BUILT`: code exists and is committed, but not confirmed deployed or pushed.

**Live**

- `PUSHED`: pushed, but deployment not confirmed. Ask user if you need confirmation.
- `SHIPPED`: deployed to production, with commit and deployment receipt, if available.
- `VERIFIED`: observed working in production. Stronger claim than `SHIPPED`. Needs observation to
  back it: log line, count, screenshot reference. Reading code is not verification.

**Stopped**

- `PARKED`: deliberately not being done. State why, so reason can be examined again instead of
  derived again.

## Writing style

- **Write for a reader who knows nothing of the context.** Every entry is read fresh. Reader who
  was not there must be able to act on it without asking anything.
- **Write dates as absolute dates.** Never "today", "last week", "recently". Write `2026-08-08`.
  Give timestamps `Z` with UTC when hour matters.
- **Use uppercase sparingly.** Uppercase marks state, hard constraint, or something that costs
  money or data if missed. Uppercase everywhere reads as noise and hides parts that matter.
- **Remove what is no longer true.** When fact in entry turns out wrong or out of date, change or
  delete it in place. Stale line misleads every reader who finds it by search and reads it without
  rest of entry.
- **Accept a limitation only when an EXTERNAL system imposes it**, and give it official source,
  date on which source was checked, and sign-off with model and session that wrote it. Work left out
  of scope, choice made by project, shortcut or broken rule is never limitation. Presenting
  shortfall as dated "decision" breaks same rule one step further.
- **Write plain language.** Leave out filler openers and compressed jargon. Write enumerations as
  bullet lists, never as run-on sentences joined by dashes or semicolons. Do not use mannered
  speech.

## What never goes in

- **Never write absolute local paths, machine names or personal details.** Use paths relative to
  repository only.
- **Never write credentials, endpoints with secrets, or internal identifiers not needed to act.**
- **Never narrate the session**, such as "I then asked..." or "after the model replied...". Record
  decision and its date. Leave out conversation that produced it.
- **Never write credentials of any kind**, even though file is local. They leak by being copied.

## When to write

- Write into `TODO.md` without being asked, during and after turns, in same turn as each of these
  moments:
  - When `TODO.md` does not exist: record whatever work is currently in flight, or create empty
    file.
  - User asks for unit of work or approves one. Write it with its status marker and origin pointer.
  - You start fix of older defect.
  - State changes: something starts, finishes, gets committed, merged, pushed or deployed, gets
    pull request opened or merged.
  - Decision is made, or new one becomes owed.
  - Something is deployed. Record commit, run, and what boot logs showed.
  - Something is owed to whoever operates production: manual step, index to drop, backfill to run.
    Easy to lose, expensive to forget.
  - Item turns out already done, or wrongly described.
- Put idea of your own for unit of work to user as question, as section `Questions to the user`
  describes. Write it down only once user asks for it or approves it.
- Test whether update needed by asking: **if the session ended right now, would the next reader
  know what to do?** If not, file is stale.

## Your action

First thing you do when you see this skill: check what work is currently running (workflows,
background tasks). Then check TODO.md for entries that are `IN PROGRESS` or `QUEUED`.

- `RECORDED`: Do not do anything about it. User says something when they want anything done about
  it.
- `QUEUED`: Start work right away, also while other work runs. Set it to `IN PROGRESS` after you
  launched work (code edits, workflows, commands).
- `IN PROGRESS`: Check current progress on item. Resume work if not running. Keep working until
  entry is `BUILT`.
- `NEEDS DECISION`: Put decision to user as section `Questions to the user` describes. Move on to
  next item. Draw draft by `workflow-skills:visual-decisions` first when you can already draw one.
  Name its page in question.
- `BUILT`: Verify result, check its current state, update status if it has progressed.
- `SHIPPED`: Check current status. Update status if it has progressed.
- `VERIFIED`: Unit done and should be removed.
