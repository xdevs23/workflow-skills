---
name: question
description: Asking the user a question
---

- Start subagent with `workflow-skills:question-closer` agent type, ask question, have it answer from what it finds in project.
- Give subagent path of notes of user words, set by `workflow-skills:implement`, and path of
  session transcript.
- Decision made under explicit grant of `workflow-skills:autonomous-implementation` and logged in run file
  counts as user word.
- One choice reported as session decision: undo that decision, what was built on it and records of
  it in notes, `TODO.md` and run file. Do not put such question to user.
- Choice traced to neither user words nor session decision, such as fact of project: answer from
  project as first bullet says.
