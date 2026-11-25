---
name: orchestrate
description: Hand every unit of work to `workflow-skills:lead` and supervise leads, in agent mode `swarm`
---

- Follow this skill only in main conversation whose latest note on agent mode sets `swarm`
- Aim to satisfy user with work of leads, not to finish work yourself
- Never draw draft, build, review whole change, fix or merge yourself

## User

- Follow sections `User's words` and `User review` of `workflow-skills:implement`, except: send
  rejected change and every comment of user to same lead, in place of new run
- Follow `workflow-skills:todo-md` for `TODO.md` and goals. Write each unit into `TODO.md` before
  handing it to lead

## Reports of leads

- Handle each report of lead as section `Reports to orchestrator` of `workflow-skills:lead` names
  it
- Open draft sent by lead for user as `workflow-skills:visual-decisions` describes
- Read each workflow script and command for host sent by lead before running it, as if written by
  you. Send it back to lead with reason where you would not run it on your own, e.g. where it
  pushes, deletes or writes outside unit, or breaks rule of global instruction file. Never edit it
- Put questions sent by leads to user one at a time, in order received, each with number and title
  of its unit

## Hand-off

- Hand goal, entry of `TODO.md` or sub-unit, at level chosen by you, to lead that draws its draft
  or builds it. Start lead with Agent tool as `workflow-skills:lead`, in background
- 3 to 5 leads running at once: sweet spot, not limit. Start more only where work needs them.
  Every lead sends notifications and starts workflows. Too many leads overwhelm you with
  notifications, and session lags until all work slows to crawl
- Hand work of high priority first: goals, entries of `TODO.md` and tasks from user. Start work of
  low priority, e.g. goal of lower priority, only once work of high priority is done
- Give every unit exactly one lead. Unit inside unit of lead belongs to that lead
- Give each lead a description with number and title of unit, e.g. `lead #218 merge feature
  branches`. After compaction, find lead of unit with `ListAgents`
- Hand lead in prompt: number and title of unit, user's words on unit as
  `mcp__workflow-skills__get_ideas` returns them, verbatim, paths to approved drafts of unit and of
  units above it, whether to draw draft or build, and grant of
  `workflow-skills:autonomous-implementation` over unit where latest note on autonomy lists it. Add
  in your own words only what else helps it
- Keep hand-off short: write prompt, start lead, go back to user
- Send all later work on unit to same lead: user's words on unit, verbatim, after recording them,
  replies, workflow results, roasts, work sent back, and each start or end of grant of
  `workflow-skills:autonomous-implementation` over unit, as soon as note on autonomy shows it.
  Wake it with `SendMessage` to its agent id
- When lead ends with error or without report, wake same lead with `SendMessage`, naming what is
  missing. Start new lead on its branch only where it cannot be woken
- Stop lead with `TaskStop` once user accepted its change or dropped its unit

## Supervision

- Never judge lead by its report alone
- Before taking finished work or answer to roast, read every roast of lead, user's words on unit
  and evidence sent by lead. Look at state left by lead, e.g. git configuration, hooks and scripts,
  or at part of its diff only where point of roast or user's words name it
- Send work back to same lead before it reaches user wherever it misses user's words or approved
  draft, leaves point of roast unanswered, or works around way named by user's words, as
  `workflow-skills:lead` describes. Name what is wrong and where. Ask lead to undo every
  work-around
- Take change to user only once evidence sent by lead shows that section `Done` of
  `workflow-skills:implement` holds
