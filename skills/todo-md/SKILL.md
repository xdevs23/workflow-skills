---
name: todo-md
description: Track the work of the project, see what's in progress and what should be done next.
---

`TODO.md` is the record of where a project stands. Anyone picking up a project, such as a
new session, a new contributor or an agent without history, reads that file first and then knows
where things stand. The file is not authority about state outside itself – read the code and git state first before trusting anything in this file.

# Purpose

- Keep the local status of the project in `TODO.md`.
- Record in `TODO.md` every fact about how far the project has progressed that is recorded nowhere
  else. Do not use it as a diary, for internal facts or for decisions that don't need to be recorded.
  You can use the notes from `workflow-skills:implement` to write down user decisions for a unit.
- Use `TODO.md` as a tracker of units of work, like an issue tracker would be used for.
- Write an entry only for work the user asked for, work that is planned with the user, and work
  being done.
- Do not write an entry for a task that changes nothing in the project.
- Treat a state in `TODO.md` as the last state someone wrote down. Before you report a state or
  act on it, check the work against the branches, the history of the main branch, the pull
  requests and the deployment where it would show up, and correct the entry first. Ask the user
  for what you cannot check yourself before making a claim the user would get upset about.

`TODO.md` is **gitignored and untracked**: it is a working file on one machine and is not part of
the repository. A fresh clone does not contain it.

- When an item is finished, the code represents the **design** and the **diff** is in git.
  Then delete the entry for the item from `TODO.md`. An item is finished once it is `VERIFIED`, or
  `PUSHED` in a project that is not deployed.
- Delete an entry also when the user says so, or when it is the fix of an older defect and the fix is merged.
  Never delete an entry for any other reason.
- Remove a deleted entry from every `Builds on:` line that names the deleted entry.
- Do not explain again in `TODO.md` what is already tracked somewhere else, even if uncommitted.

# Layout of the file

- Write the entries in the order of their numbers, so the newest entry is the last one in the file.
- Write nothing else into the file. The file is neither a diary, nor your personal scratchpad.

# Anatomy of an entry

```
### #142 - Reaction emoji support - RECORDED
<body: what it is, where it stands and what is owed>
```

- **`### #<number> - <title>`**: the number is the id in the tracker and never changes. Write in
  the title what the item *is*, and leave the state to the state marker. If the project uses a
  separate convention for ids, keep the internal numbering as it is and add the project id on top,
  for example:
  `#142 - GH #73 - Reaction emoji support - RECORDED`
  `#165 - ABC-210 - User type 'editor' - IN PROGRESS`
- **`- <STATE>`**: the state marker, in uppercase, after the separator dash used by the format.
- **Date**: do not add a date. Commit messages and the time the file was last changed already give
  the date.
- **Body**: prose with what the item is, where it stands and what is still to be done. Put run
  logs and the history of the work into the project cache, never into the entry.
- **Origin pointer**: `<transcript>.jsonl:<line>:<promptId or uuid>`, the session transcript and
  the line with the first message of the conversation that raised the item. Give every entry one.
  To find the line, search the directory with the session transcripts of the project for the
  promptId or uuid, or read the given line directly.
- **`Builds on:`**: a line with every entry that has to be built first. Write a dependency between
  entries in this line and nowhere else.
- When you report on several entries, show in the message the chains of `Builds on:` lines that
  concern them.

## One behavior to a unit

- Give a unit one behavior: something stated in one sentence, such as "the profile page shows the
  avatar".
- Split a feature, or anything bigger than a small patch, into sub-units, each covering one aspect,
  such as one behavior or one module.
- Add the sub-units of a unit once its draft is approved, as `workflow-skills:implement` describes,
  before building of the unit starts. Never write sub-units in advance.
- Word a unit that removes violations of a rule by what the rule is for, such as "a value sent by
  the server and unknown to this build becomes an explicit unknown value where it arrives". Never
  word it by the check it should make pass, such as "make the lint pass".
- Give each sub-unit a fourth-level entry in dot notation under the entry it belongs to, in the
  shape of any other entry, and a `Builds on:` line listing the sub-units it needs first. Nest
  sub-units deeper in the dot notation, such as `#383.1.1` under `#383.1`:

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

- Give every entry that has sub-units the state of the least advanced sub-unit under it.
- Build each sub-unit without sub-units of its own as a separate unit, in a separate worktree and
  on a separate branch, with one or more workflow runs. You may start building on whatever base
  suits the work.
- Deliver each sub-unit separately, such as through a separate pull request against the main
  branch of the project, and only once every sub-unit listed in its `Builds on:` line is merged
  there. A pull request is a request that can be rejected.
- When the delivery of a sub-unit is rejected, deliver none of the sub-units that build on it, and
  ask the user how to go on.

## Findings raised while building a unit

- Fix a finding about code the unit adds or edits in the unit itself, and never record it.
- Put a finding, also one about older code, to the user as a question when fixing it needs a
  decision by the user.
- Record work left over from a unit as a sub-unit of the entry for that unit, never as a new entry.
  Its origin pointer is the message that asked for the unit.
- Record work left over from a unit whose entry was deleted as finished as a new entry, and name
  the finished unit in its body.
- Fix a defect in older code outside the unit, such as a flaky test harness, as a separate unit in
  parallel with the unit.
- Start the fix of an older defect without asking the user. It is the one unit you start without
  the user's word.
- Build the fix of an older defect by `workflow-skills:implement`, with the defect and its evidence
  in place of the notes and without a draft, in its own worktree and on its own branch.
- Deliver the fix of an older defect on its own, through its own pull request or review.
- Record the fix of an older defect as an `IN PROGRESS` entry while it runs. Its origin pointer is
  the message that asked for the unit that found the defect. Delete the entry once the fix is
  merged.
- Add the fix of an older defect to the `Builds on:` line of the unit when the unit cannot work
  without it.

# The states an entry can take

The state is a fixed enum: either no marker or one of the markers listed here, grouped by where the
item stands.

**Recorded**

- `RECORDED`: captured so it is not lost, and deliberately not started.

**Waiting on a decision**

- `NEEDS DECISION`: the work cannot go on until a question is answered or the theory is defined.
  Write into the entry, in plain terms, the question and the options, or that the theory is
  missing, which would start a discussion thread about the feature.
- Mark a unit or sub-unit that does not have enough information to start `NEEDS DECISION`.
- **A decision still owed blocks only the item it concerns.** Skip and mark the item, and move the
  work on to the next one.

**Ready to build**

- `READY`: the design is agreed and written down, for example in the notes of `workflow-skills:implement`.
- Mark a sub-unit `READY` once everything it needs is clear.
- `QUEUED`: the unit can be built at any time, even if the session is wiped and started fresh.

Whether a unit is ready to build follows from the words of the user alone.

- Never decide it yourself.
- When you infer authorization from a prompt of the user because its words are ambiguous, state that
  plainly **in bold** and ask the user to confirm.

**Being built**

- `IN PROGRESS`: under construction. Name the workflow id if one is running, so a later reader can
  find the transcript.

**Built and not yet live**

- `BUILT`: the code exists and is committed, but has not been confirmed deployed or pushed.

**Live**

- `PUSHED`: pushed, but deployment is not confirmed. Ask the user if you need confirmation.
- `SHIPPED`: deployed to production, with the commit and the deployment receipt, if available.
- `VERIFIED`: observed working in production. This is a stronger claim than `SHIPPED` and needs an
  observation to back it: a log line, a count, a screenshot reference. Reading the code is not
  verification.

**Stopped**

- `PARKED`: deliberately not being done. State why, so the reason can be examined again instead of
  derived again.

## Writing style

- **Write for a reader who knows nothing of the context.** Every entry is read fresh. A reader who
  was not there must be able to act on it without asking anything.
- **Write dates as absolute dates.** Never "today", "last week", "recently". Write `2026-08-08`.
  Give timestamps `Z` with UTC when the hour matters.
- **Use uppercase sparingly.** Uppercase marks a state, a hard constraint, or something that costs
  money or data if missed. Uppercase everywhere reads as noise and hides the parts that matter.
- **Remove what is no longer true.** When a fact in an entry turns out wrong or out of date, change
  or delete it in place. A stale line misleads every reader who finds it by search and reads it
  without the rest of the entry.
- **Accept a limitation only when an EXTERNAL system imposes it**, and give it the official
  source, the date the source was checked and a sign-off with the model and the session that wrote
  it. Work left out of scope, a choice made by the project, a shortcut or a broken rule is never a
  limitation. Presenting a shortfall as a dated "decision" breaks the same rule one step further.
- **Write plain language.** Leave out filler openers and compressed jargon. Write enumerations as
  bullet lists, never as run-on sentences joined by dashes or semicolons. Do not use mannered
  speech.

## What never goes in

- **Never write absolute local paths, machine names or personal details.** Use paths relative to
  the repository only.
- **Never write credentials, endpoints with secrets, or internal identifiers not needed to act.**
- **Never narrate the session**, such as "I then asked..." or "after the model replied...". Record
  the decision and its date, and leave out the conversation that produced it.
- **Never write credentials of any kind**, even though the file is local. They leak by being
  copied.

## When to write

- Write into `TODO.md` without being asked, during and after turns, in the same turn as each of
  these moments:
  - When `TODO.md` does not exist: record whatever work is currently in flight, or create an empty
    file.
  - The user asks for a unit of work or approves one. Write it with its status marker and its origin
    pointer.
  - You start the fix of an older defect.
  - A state changes: something starts, finishes, gets committed, merged, pushed or deployed, gets
    a pull request opened or merged.
  - A decision is made, or a new one becomes owed.
  - Something is deployed. Record the commit, the run, and what the boot logs showed.
  - Something is owed to whoever operates production: a manual step, an index to drop, a backfill
    to run. These are easy to lose and expensive to forget.
  - An item turns out to be already done, or wrongly described.
- Put an idea of your own for a unit of work to the user as a question, and write it down only once
  the user asks for it or approves it.
- Test whether an update is needed by asking: **if the session ended right now, would the next
  reader know what to do?** If not, the file is stale.

## Your action

The first thing you do when you see this skill is check what work is currently running (workflows, background tasks),
then check the TODO.md for entries that are `IN PROGRESS` or `QUEUED`.

When reading through TODO.md, here's what to do for each status:

- `RECORDED` – Don't do anything about it. The user says something when they want to do anything about it.
- `QUEUED` – Start the work. Set it to `IN PROGRESS` after you launched the work (code edits, workflows, commands).
- `IN PROGRESS` – Check the current progress on the item, and resume the work if it is not running.
- `NEEDS DECISION` – Wait for the user to be ready and present, then bring the decision to them.
                     Use `workflow-skills:visual-decisions` when you can already draw a draft.
- `BUILT` – Verify the result, check its current state and update the status if it has progressed.
- `SHIPPED` – Check the current status, and update the status if it has progressed.
- `VERIFIED` – The unit is done and should be removed.

