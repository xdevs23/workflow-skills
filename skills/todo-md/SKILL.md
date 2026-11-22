---
name: todo-md
description: Track work on project: what is in progress and what is next
---

`TODO.md` is record of where project stands. Anyone picking up project, such as new session, new
contributor or agent without history, reads that file first.

# Purpose

- Use `TODO.md` as tracker of units of work, like an issue tracker would be used for
- Write entry only for work asked for by user. Never write entry on your own decision. Only
  exceptions:
  - sub-unit that unit asked for by user cannot finish without;
  - fix of older defect, while it runs;
  - step owed to whoever operates production
- Do not write entry for task that changes nothing in project
- Treat state in `TODO.md` as last state written down by someone. Before you report state or act on
  it, check work against branches, history of main branch, pull requests and deployment where it
  would show up. Correct entry first

`TODO.md` is **gitignored and untracked**: working file on one machine, kept out of repository.

- Delete entry for unit from `TODO.md` once unit meets every condition of section `Done` of
  `workflow-skills:implement`, since code represents **design** and **diff** is in git
- Check each condition yourself, from output and commits. Claim by agent that check passed is not
  evidence
- Delete entry of unit merged into working branch before this session started, once code of unit is
  on working branch
- Delete entry also when user says so. Never delete entry for any other reason
- Delete user's words recorded for deleted entry with `mcp__workflow-skills__delete_ideas`, in same
  turn
- Remove deleted entry from every `Builds on:` line that lists it
- Read goals and entries attached to them with `mcp__workflow-skills__list_goals` when not in
  context. Goal is not satisfied yet until user clears it
- Attach each entry that serves goal not satisfied yet to that goal with
  `mcp__workflow-skills__attach_todo`, as `#<number> - <title>`, in same turn as writing entry or
  changing its title
- When user adds goal, attach every entry of `TODO.md` that serves new goal
- Detach entry from every goal not satisfied yet that lists it, with
  `mcp__workflow-skills__detach_todo`, as `#<number>`, in same turn as deleting entry or as entry
  stops serving goal
- Name goal as `G<number>` or `Goal <number>`, e.g. `G10` or `Goal 10`, never as `#<number>`. `#`
  stands for entry of `TODO.md` only

# Layout of the file

- Write entries in order of their numbers, so newest entry is last one in file. Write sub-units of
  one entry in order in which they are built
- Write nothing else into file

# Anatomy of an entry

```
### #142 - Reaction emoji support - IN PROGRESS
Builds on: #141
Draft: .cache/specs/reaction-emoji.html
```

- Write entry as heading, followed by `Builds on:` line and `Draft:` line where they apply. Write
  nothing else into entry: no description, history, reason, date or pointer to notes
- Record what user says about entry as `workflow-skills:implement` describes
- Write every heading strictly in format `### #<number> - <title> - <STATE>`. Write nothing after
  state marker
- **`### #<number> - <title>`**: number is id in tracker and never changes. Write in title what
  item *is*, in user's words where user named it. Leave state to state marker. If project uses
  separate convention for ids, keep internal numbering as it is and add project id at start of
  title, for example:
  `#142 - GH #73 - Reaction emoji support - RECORDED`
  `#165 - ABC-210 - User type 'editor' - IN PROGRESS`
- **`- <STATE>`**: state marker, in uppercase, after separator dash used by format
- **Date**: do not add date. Commit messages and time at which file was last changed already give
  date
- **`Builds on:`**: line with every entry that has to be built first. Write dependency between
  entries in this line and nowhere else
- **`Draft:`**: path of draft of unit, relative to repository
- When reporting on several entries, give glance by `workflow-skills:glance`. Show chains of
  `Builds on:` lines that concern them in message

## One behavior to a unit

- Give unit one behavior: something stated in one sentence, such as "the profile page shows the
  avatar"
- Split feature, or anything bigger than small patch, into sub-units, each covering one aspect.
  Such as one behavior or one module
- Add sub-units whenever unit needs them, each with own draft. Never draw one draft for all
  sub-units
- Word unit that removes violations of rule by what rule is for, such as "a value sent by the
  server and unknown to this build becomes an explicit unknown value where it arrives". Never word
  it as check to make pass, such as "make the lint pass"
- Give each sub-unit fourth-level entry in dot notation under entry to which it belongs, in shape of
  any other entry, and `Builds on:` line listing sub-units needed by it first
- Never nest sub-unit under sub-unit. Write part of sub-unit, or work needed by it first, as
  sub-unit of same entry, placed before sub-unit that needs it:

  ```
  ### #383 - Profile avatars - IN PROGRESS
  Draft: .cache/specs/profile-avatars.html
  #### #383.1 - The profile page shows the avatar - IN PROGRESS
  Draft: .cache/specs/profile-avatars-383.1.html
  #### #383.2 - The avatar can be replaced - READY
  Builds on: #383.1
  Draft: .cache/specs/profile-avatars-383.2.html
  #### #383.3 - A replaced avatar is resized to the sizes used on the page - READY
  Builds on: #383.2
  Draft: .cache/specs/profile-avatars-383.3.html
  ```

- Record shared code needed by several sub-units, e.g. new extension point of core, as sub-unit of
  its own, built together with its first consumer. List it in `Builds on:` line of every other
  sub-unit using it
- Chain by `Builds on:` sub-units that edit same lines of shared file that cannot be split, e.g.
  lockfile or sequence of migrations
- Give every entry that has sub-units state of least advanced sub-unit under it
- Build each sub-unit as separate unit, in separate worktree and on separate branch, with one or
  more workflow runs. You may start building on whatever base suits work
- Deliver each sub-unit separately, such as through separate pull request against main branch of
  project. Only once every sub-unit listed in its `Builds on:` line is merged there. Pull request
  is request that can be rejected
- When delivery of sub-unit rejected, deliver none of sub-units that build on it. Handle rejection
  as `workflow-skills:implement` describes
- Never put changes made for two entries with third-level heading, e.g. `#383` and `#384`, into one
  commit
- Group commits made for sub-units of one entry into one commit or several, as
  `workflow-skills:logical-units` describes

## Findings raised while building a unit

- Fix finding about code added or edited by unit in unit itself. Never record it
- Draw decision about finding, also about finding in older code, as
  `workflow-skills:visual-decisions` describes when fixing it needs decision by user
- Write work that comes up during unit as sub-unit of entry for that unit only when unit cannot
  finish without it. Write it as `READY`
- Fix other small work that comes up right away, as `workflow-skills:implement` describes, without
  entry
- Name other big work that comes up once, in report to user. Never write entry for it
- Fix defect in older code outside unit, such as flaky test harness, as separate unit in parallel
  with unit
- Start fix of older defect without asking user, as only unit started by you without user's word
- Build fix of older defect by `workflow-skills:implement`, with defect and evidence for it in
  prompt and without draft, in worktree and on branch of its own
- Deliver fix of older defect on its own, through pull request or review of its own
- Split fix of older defect that reaches several modules into sub-units, one per module, each
  delivered through pull request of its own
- Record fix of older defect as `IN PROGRESS` entry while it runs
- Add fix of older defect to `Builds on:` line of unit when unit cannot work without it

# Requests to the user

- Send request with tool `mcp__workflow-skills__send_request` only for something user does outside
  session, e.g. power-cycle external system
- In session without that tool, e.g. Agent SDK session or `-p` run, write request in message. Stop
  work that depends on it
- Name entry in each request by its number and title
- Take reply that arrives with tool result, or as message, as user's own reply. Act on it as on
  any other reply of user
- When user replies in chat to request still open, withdraw it with
  `mcp__workflow-skills__withdraw_request` in same turn

# The states an entry can take

State is fixed enum: one of three markers.

- `RECORDED`: asked for by user. Not started
- `READY`: user said it can be built. Whether unit is ready to build follows from words of user
  alone
- Mark sub-unit `READY` once everything needed by it is clear
- `IN PROGRESS`: under construction, until entry deleted as section `Purpose` describes
- Entry waiting on decision by user keeps its state. Handle open point as
  `workflow-skills:visual-decisions` describes
- **A decision still owed blocks only the item concerned by it.** Move work on to next one
- Work on smallest change possible where decision does not change outcome

## What never goes in

- **Never write absolute local paths, machine names or personal details.** Use paths relative to
  repository only
- **Never write credentials of any kind, endpoints with secrets, or internal identifiers not needed
  to act**, even though file is local. They leak by being copied

## When to write

- Write into `TODO.md` without being asked, during and after turns, in same turn as each of these
  moments:
  - When `TODO.md` does not exist: record whatever work is currently in flight, or create empty
    file
  - User asks for unit of work or approves one. Write it with its status marker
  - State of unit changes, or entry of unit can be deleted
  - Draft of unit is approved
  - Something is owed to whoever operates production: manual step, index to drop, backfill to run.
    Write it as unit of its own, with step named in title. Easy to lose, expensive to forget
  - Item turns out already done, or wrongly described
- Test whether update needed by asking: **if the session ended right now, would the next reader
  know what to do?** If not, file is stale

## Your action

First thing you do when you see this skill: check what work is currently running (workflows,
background tasks). Then check TODO.md for entries that are `IN PROGRESS` or `READY`.

- `RECORDED`: Do not do anything about it. User says something when they want anything done about
  it
- `READY`: Start work right away, also while other work runs. Set it to `IN PROGRESS` after you
  launched work (code edits, workflows, commands)
- `IN PROGRESS`: Check current progress on item. Resume work if not running. Keep working until
  entry can be deleted. Change waiting on review by user, such as open pull request: handle
  comments as `workflow-skills:implement` describes. Do not build it again. Never merge it
  yourself to meet condition for deleting entry
