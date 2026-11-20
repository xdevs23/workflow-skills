---
name: workflows
description: Run workflow or start agent
---

- Set model and effort explicitly on every agent and every stage of a workflow. Custom agent type or
  resume can resolve to another model
- Never wait for workflow with `TaskOutput`. Notification arrives by itself when workflow done.
  Session still open for new messages meanwhile
- When workflow stalls, switch model. Resume it as `workflow-skills:resume-interrupted-run`
  describes
- Hand preparation that takes longer than about 2 minutes to a workflow
