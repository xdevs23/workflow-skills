---
name: workflows
description: Run a workflow or start an agent.
---

# Workflows

- Load `workflow-skills:writing-style` first, and follow it in every prompt, document and reply you
  write under this skill.
- Set an explicit model and an explicit effort on every agent and every stage of a workflow. Never
  rely on an inherited or default model, since a custom agent type or a resume can resolve to
  another model.
- Never wait for a workflow with `TaskOutput`. The notification arrives by itself when the workflow
  is done, and the session is still open for new messages in the meantime.
- Keep a session continuity notification armed while entries in `TODO.md`, as
  `workflow-skills:todo-md` defines them, are `IN PROGRESS` or `QUEUED`: a recurring check, about
  every 30 minutes, of the running workflows, set up with the tool of the session for recurring
  tasks. When a workflow stalls, switch the model, and resume it as
  `workflow-skills:resume-interrupted-run` describes.
- Delete the session continuity notification once no entry is `IN PROGRESS` or `QUEUED`.
- Hand preparation that takes longer than about 2 minutes to a workflow.
