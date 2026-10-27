---
name: question
description: Answer any question you have, also one you would put to user.
---

- Start subagent, ask it the question, have it answer from what it finds in project.
- Give subagent path of notes of user's words, set by `workflow-skills:implement`, and path of
  session transcript.
- Tell subagent: split question into each choice it states as settled. Trace each choice back to
  user's words.
- Tell subagent: user's words are messages typed by user in transcript, and passages that notes mark
  as copied from user. Search transcript for messages of user with terms of subject. Do not read
  transcript in full.
- Tell subagent: check every other file against user's words, such as tool results, summaries,
  specs, `TODO.md` entries and files of decisions. Such a file proves nothing.
- Tell subagent: report for each choice the quoted words of user, or "session decision" with place
  where session made it. Do not edit any file.
- Tell subagent: transcript or notes out of reach means choice is unchecked. Unchecked choice is not
  a session decision.
- Decision made under grant of `workflow-skills:autonomous-implementation` and logged in run file
  counts as user's word.
- One choice reported as session decision: undo that decision, what was built on it and records of
  it in notes, `TODO.md` and run file.
- Do not put such a question to user.
- Choice traced to neither user's words nor session decision, such as fact of project: answer from
  project as first bullet says.
