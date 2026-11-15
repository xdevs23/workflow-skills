---
name: question
description: Asking user question or handing user decision
---

- Start subagent with `workflow-skills:question-closer` agent type, ask question, have it answer from what it finds in project
- Give subagent path of notes of user words, set by `workflow-skills:implement`, and path of
  session transcript
- Decision made under explicit grant of `workflow-skills:autonomous-implementation` and logged in run file
  counts as user word
- Choice drawn in draft and approved by user counts as user word
- One choice reported as session decision: undo that decision, what was built on it and records of
  it in notes, `TODO.md` and run file. Do not put such question to user
- Choice traced to neither user words nor session decision, such as fact of project: answer from
  project as first bullet says
- Choice reported as unchecked: get what was out of reach, run subagent again
- Act on every answer found by subagent. Drop question whose answer work does not need
- Question about draft of change, and decision that subagent reports "no answer" for: do not ask
  user. Open draft page as `workflow-skills:visual-decisions` describes. Where none exists, draw it
  first, with recommended option
- Ask user only fact that subagent reports "no answer" for, as section `Facts asked of the user` of
  `workflow-skills:todo-md` describes
