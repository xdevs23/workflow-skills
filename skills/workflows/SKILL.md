---
name: workflows
description: Run workflow or start agent
---

- Set model and effort explicitly on every agent and every stage of a workflow. Custom agent type or
  resume can resolve to another model.
- Never wait for workflow with `TaskOutput`. Notification arrives by itself when workflow done.
  Session still open for new messages meanwhile.
- Keep session continuity notification armed while entries in `TODO.md`, as
  `workflow-skills:todo-md` defines them, are `IN PROGRESS` or `QUEUED`. Notification: recurring
  check of running workflows, about every 30 minutes, set up with the tool available to session for
  recurring tasks. When workflow stalls, switch the model. Resume it as
  `workflow-skills:resume-interrupted-run` describes.
- Delete session continuity notification once no entry is `IN PROGRESS` or `QUEUED`.
- Hand preparation that takes longer than about 2 minutes to a workflow.
