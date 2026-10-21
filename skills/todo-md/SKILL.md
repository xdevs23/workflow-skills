---
name: todo-md
description: Applies when you track the state of work in a project, add units of work to the todo list or record feature requests for the project.
---

- When the session has a skill named `todo-md` without the plugin prefix, follow that skill and
  leave this one aside. Follow `workflow-skills:todo-md` only when it is the only `todo-md` skill
  available.
- Follow every rule by what it is for. Getting a result forbidden by a rule through another route,
  such as a cast hidden in a helper, a type widened until a value fits or a term redefined until
  the work passes, breaks the rule just as the forbidden form does. When a rule stands in the way
  of your work, name it where you report your work, and never go around it.

`TODO.md` is the durable record of where a project stands. Anyone picking up a project, such as a
new session, a new contributor or an agent without history, reads that file first and then knows
where things stand.

- Where a project defines a different convention for recording the state of runs, or a different
  location for the file, follow the convention of the project.

# 1. What it is, and what it is not

`TODO.md` contains **the work left to do, and where each item currently stands**.

- Keep the local status of the project in `TODO.md` and nowhere else. A task list inside the
  session disappears when the session ends. Private notes are invisible to everyone else. Never
  write status into either one.
- Record in `TODO.md` every fact about how far the project has progressed that is recorded nowhere
  else.
- Use `TODO.md` as a tracker of units of work, like an issue tracker. Never use it as a diary or a
  scratchpad.
- Write an entry only for work the user asked for, work that is planned with the user, and work
  being done.
- Write no entry for a task that changes nothing in the project.

`TODO.md` is **gitignored and untracked**: it is a working file on one machine and is not part of
the repository. A fresh clone does not contain it.

The work of keeping track is split across four records:

| Record | Contains |
|---|---|
| `TODO.md` | Open work, its order, its current state, and the decisions still owed |
| git history | What changed, and when it was committed |
| design documents, wherever the project has them | The durable design for a change |
| task list inside the session | Only the steps of this session, thrown away when it ends |

- When an item is finished, leave the **design** in the design documents and the **diff** in git,
  and delete the entry for the item from `TODO.md`. An item is finished once it is `VERIFIED`, or
  `PUSHED` in a project that is not deployed.
- Delete an entry also when the user says so, or when it is the fix of an older defect that §3.2
  describes and the fix is merged. Never delete an entry for any other reason.
- Remove a deleted entry from every `Builds on:` line that names it.
- Do not explain again in `TODO.md` a design already written in a design document.

# 2. Layout of the file

- Write the entries in the order of their numbers, so the newest entry is the last one in the
  file.
- Put the reference material, such as the header and the conventions, first and the record after
  it, in the order of the ids, in these sections:

1. **Header**: what the file is, and the conventions that apply to every entry, with a reference to
   this skill.
2. **Incidents**: recorded failures, written down verbatim so they do not repeat. Write in each one
   what happened, the cost and the sharper instruction learned from it. Once code, tests or the way
   the system is built prevent the incident by structure, remove the entry, and explain in the
   change that resolves it which type of incident the change addresses.
3. **Current queue**: the active order of work, with the deployment state that comes before it.
   Rewrite the queue when the order changes.
   - When new work sets other work aside, add a line to the queue before you start the new work.
   - Write into that line the entry set aside, the entry that has to finish first, and where to go
     back to once that entry is done.
   - Remove the line when the work is resumed or finished.
4. **Deploy state**: what is live where, with commit hashes and the evidence for `SHIPPED` and
   `VERIFIED`.
5. **Open sections by area**: the entries for single items, grouped by area of the project.

# 3. Anatomy of an entry

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
  See §4.
- **Date**: do not add a date. Commit messages and the time the file was last changed already give
  the date.
- **Body**: prose with what the item is, where it stands and what is still to be done. Put run
  logs and the history of the work into the project cache, never into the entry. The evidence for
  `SHIPPED` and `VERIFIED` goes into the deploy state section.
- **Origin pointer**: `<transcript>.jsonl:<line>:<promptId or uuid>`, the session transcript and
  the line with the first message of the conversation that raised the item. Give every entry one.
  To find the line, search the directory with the session transcripts of the project for the
  promptId or uuid, or read the given line directly.
- **`Builds on:`**: a line with every entry that has to be built first. Write a dependency between
  entries in this line and nowhere else.
- When you report on several entries, show in the message the chains of `Builds on:` lines and the
  lines in the queue about work set aside that concern them.

## 3.1. One behavior to a unit

- Give a unit one behavior: something stated in one sentence, such as "the profile page shows the
  avatar".
- Split a request with several behaviors into sub-units, one per behavior, when you write the entry
  for the request.
- Word a unit that removes violations of a rule by what the rule is for, such as "a value sent by
  the server and unknown to this build becomes an explicit unknown value where it arrives". Never
  word it by the check it should make pass, such as "make the lint pass".
- Give each sub-unit a fourth-level entry in dot notation under the entry for the request, in the
  shape of any other entry, and a `Builds on:` line listing the sub-units it needs first:

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

- Give the entry for the request the state of the least advanced sub-unit under it.
- Build each sub-unit as a separate unit, in a separate worktree and on a separate branch, with one
  or more workflow runs. You may start building on whatever base suits the work.
- Deliver each sub-unit separately, such as through a separate pull request against the main
  branch of the project, and only once every sub-unit listed in its `Builds on:` line is merged
  there. A pull request is a request that can be rejected.
- When the delivery of a sub-unit is rejected, deliver none of the sub-units that build on it, and
  ask the user how to go on.

## 3.2. Findings raised while building a unit

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

# 4. The states an entry can take

The state is a fixed enum: either no marker or one of the markers listed here, grouped by where the
item stands.

**Recorded**

- `RECORDED`: captured so it is not lost, and deliberately left out of the queue.

**Waiting on a decision**

- `NEEDS DECISION`: the work cannot go on until a question is answered or the theory is defined.
  Write into the entry, in plain terms, the question and the options, or that the theory is
  missing, which would start a discussion thread about the feature.
- **A decision still owed blocks only the item it concerns.** Skip and mark the item, and move the
  work on to the next one.
- Never stop the whole queue on an open question: doing so is a recorded incident.

**Ready to build**

- `READY`: the design is agreed and written down. Name the design document in the entry. Work does
  not start yet.
- `TODO`/`QUEUED`: the unit can be built at any time, even if the session is wiped and started
  fresh.

Whether a unit is ready to build follows from the words of the user alone, except for the fix of
an older defect that §3.2 describes.

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
- `VERIFIED`: observed working in production. This is a stronger claim than `LIVE` and needs an
  observation to back it: a log line, a count, a screenshot reference. Reading the code is not
  verification.

**Stopped**

- `PARKED`: deliberately not being done. State why, so the reason can be examined again instead of
  derived again.

**Held**

An item can be finished but deliberately withheld.

- Mark it `HELD CHANGE` inside the entry it belongs to.
- State exactly what must happen first, and state what would go wrong if it shipped early.
- Never commit it: a held change is the one case where a correct, passing change must not be
  committed.

## 5. Writing style

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

## 6. What never goes in

- **Never write absolute local paths, machine names or personal details.** Use paths relative to
  the repository only.
- **Never write credentials, endpoints with secrets, or internal identifiers not needed to act.**
- **Never narrate the session**, such as "I then asked..." or "after the model replied...". Record
  the decision and its date, and leave out the conversation that produced it.
- **Never write credentials of any kind**, even though the file is local. They leak by being
  copied.
- Record in `TODO.md`, where it helps, operational detail that must never enter a commit, such as
  which models or accounts ran a step and details specific to the local machine.
- Never let any of that detail cross into a tracked file, a document or a commit message. Which rule
  applies depends on the destination.

## 7. When to write

- Write into `TODO.md` without being asked, at any moment during and after turns, at each of these
  moments:
  - When `TODO.md` does not exist: record whatever work is currently in flight, or create an empty
    file.
  - The user asks for a unit of work or approves one. Write it in the same turn, with its status
    marker and its origin pointer.
  - You start the fix of an older defect, as §3.2 describes.
  - A state changes: something starts, finishes, gets committed or deployed, or gets held.
  - A decision is made, or a new one becomes owed.
  - The order changes.
  - Something is deployed. Record the commit, the run, and what the boot logs showed.
  - Something is owed to whoever operates production: a manual step, an index to drop, a backfill
    to run. These are easy to lose and expensive to forget.
  - An item turns out to be already done, or wrongly described.
- Put an idea of your own for a unit of work to the user as a question, and write it down only once
  the user asks for it or approves it.
- Test whether an update is needed by asking: **if the session ended right now, would the next
  reader know what to do?** If not, the file is stale.
