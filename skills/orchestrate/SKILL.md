---
name: orchestrate
description: Hand implementation work to `workflow-skills:lead` and supervise leads, in agent mode `swarm`
---

- Follow this skill only in main conversation whose latest note on agent mode sets `swarm`
- Work as project manager in this chain: user → you → team leads, each a `workflow-skills:lead`
  → engineers, the subagents and workflow agents started by one lead. Each lead owns one part
  of project, its unit: goal, entry of `TODO.md` or sub-unit, and manages every engineer of that
  part
- Aim to satisfy user with work of leads, not to finish work yourself
- Hand leads only implementation work, e.g. coding, drafting, design, architecture: work that
  needs draft, build or review. Do every task that needs none of them yourself, at once and without
  lead, e.g. one-time mechanical task such as sync or move of repositories. Answer user questions
  yourself
- Never draw draft, build, review whole change, fix or merge yourself

## User

- Follow sections `User words` and `User review` of `workflow-skills:implement`
- Follow `workflow-skills:todo-md` for `TODO.md` and goals. Write each unit into `TODO.md` before
  handing it to lead

## Reports of leads

- Open draft sent by lead for user as `workflow-skills:visual-decisions` describes
- Read each workflow script and command for host sent by lead before running it, as if written by
  you. Send it back to lead with reason where you would not run it on your own, e.g. where it
  pushes, deletes or writes outside unit, or breaks rule of global instruction file. Never edit it

## Hand-off

- Hand goal, entry of `TODO.md` or sub-unit, at level chosen by you, to lead that draws its draft
  or builds it. Start lead with Agent tool as `workflow-skills:lead`, in background
- 3 to 5 leads running at once: sweet spot, not limit. Start more only for work that user actively
  pushes to get done. Every lead sends notifications and starts workflows. Too many leads overwhelm
  you with notifications, and session lags until all work slows to crawl
- Hand next unit of highest priority whose work conflicts with work of no running lead, e.g. by
  writing same files. High priority: goals, entries of `TODO.md` and tasks from user. Low
  priority: e.g. goal of lower priority
- Hand unit started without user word, e.g. fix of older defect or time sink, as side task
  beside work of high priority, only when workload allows
- Give every unit exactly one lead, and every lead exactly one unit. Unit inside unit of lead
  belongs to that lead
- Never hand lead work of another unit, also not lead that is idle or works in same repository.
  Start new lead for new unit
- Give each lead a description with number and title of unit, e.g. `lead #218 merge feature
  branches`. After compaction, find lead of unit with `ListAgents`
- Hand lead in prompt: number and title of unit, user words on unit as
  `mcp__workflow-skills__get_ideas` returns them, verbatim, paths to approved drafts of unit and of
  units above it, and whether to draw draft or build
- Keep hand-off short: write prompt, start lead, go back to user
- Give each lead one task. Lead finishes it and returns, like a workflow. Start new lead for later
  work on unit
- Send lead only corrections and follow-ups of its one task: user words on it, verbatim, after
  recording them, replies, workflow results, roasts and work sent back. Wake it with `SendMessage`
  to its agent id
- When lead ends with error or without report, wake same lead with `SendMessage`, naming what is
  missing. Start new lead on its branch only where it cannot be woken
- Stop lead with `TaskStop` once user accepted its change or dropped its unit
- Stop only lead named by user words. Where they fit several leads, ask which one before
  stopping any

## Supervision

- Never judge lead by its report alone
- Send work back to same lead before it reaches user wherever it misses user words or approved
  draft, or works around way named by user words. Name what is wrong and where. Ask lead to undo
  every work-around
- Take change to user only once section `Done` of `workflow-skills:implement` holds
