---
name: implement
description: Applies when you implement a change to code, from the first talk with the user about it until the user reviews the code.
---

# Implement a change

**Load the `workflow-skills:writing-style` skill first.** The rules in it apply to every comment,
document, commit message and reply you write while you follow this skill. Load it whenever you work
with this plugin.

A change starts as a talk between you and the user. You write down what the user says in notes and
draw an HTML draft that the user approves. Implementers then build the change, five reviewers check
it, and the user reviews the code.

## The notes

- Write down what the user says about the change in a Markdown file while you talk. Write it by
  hand, and never copy it out of the transcript.
- Write every word the user says about the change into the notes, in the user's words and style,
  with typos and grammar fixed.
- Keep each sentence as the user said it, and never turn it into your own words or terms.
- Update the notes while the talk goes on. Correct and change them whenever the user corrects or
  changes what they said, so the notes always contain the user's words.
- Save the notes as `<change>.md` in the folder for private specs inside the project cache, which
  `workflow-skills:local-cache` sets, because the notes contain the user's words.

## The draft

- Once the notes are done, draw the change for the user as one standalone HTML file. Render it in a
  headless browser and look at the screenshot before you show it, then open it for the user.
- Show on the draft the overall shape, direction, architecture and design of the change.
- Draw technical details, such as migrations, data models and schemas, as pictures. Do not explain
  them in prose.
- Draw the draft yourself or hand it to one agent, as you decide. Draw it yourself when you know
  details from the talk that are not in the notes.
- Save the draft as `<change>.html` in the same folder as the notes.
- When the user says what should be different, change the notes and the draft, and ask the user to
  refresh the page.
- Start the implementation once the user approves the draft.

## The implementation

- Write a new workflow script for every run. Give it a name and a description that show what that
  run does.
- Split the work as you see fit, for example among one implementer, two implementers, or a
  researcher followed by an implementer. Start at least one implementer.
- Start every implementer as `workflow-skills:implementer` with an explicit model, in a worktree in
  the folder that `workflow-skills:local-cache` sets for workflow worktrees.
- Hand every implementer the paths to the full notes, the approved draft and the rules summary in
  `rules-summary.md` next to this skill. When you split the work, add which part of the change it
  builds. Never reword the notes for it.
- Run implementers at the same time only when they edit different files, and give each of them a
  separate worktree. Merge the branches they worked on into one branch before the reviewers start.
- Run parts of the work that depend on each other one implementer after the other. Start the
  implementer for a dependent part in the worktree and on the branch that the implementer before it
  used.
- Hand what a researcher finds to the implementer as input only. Do not turn it into a requirement.
- Never give an implementer a number or any other limit on how large the change may be. The only
  rule on the size of the change is the one in `workflow-skills:implementer`.
- Do not ask the user anything while the implementers work. Each implementer decides what the notes
  and the draft leave open, finishes its part and returns the decisions it made that are not in the
  notes.

## The reviewers

- Once all implementers are done, start five reviewers in parallel on the whole change, each with
  an explicit model. Tell them which repositories the change is in and at which commits it starts
  and ends.
- Start the scope reviewer as `workflow-skills:reviewer-scope` and hand it the notes and the
  approved draft. It checks that the change contains everything the user asks for in the notes and
  nothing else.
- Start each of the other four as `workflow-skills:reviewer-layer` and hand it the notes and the
  lens skills listed for its layer below.
  - The correctness reviewer checks whether the change works and how the cost of running it grows.
    It loads `workflow-skills:reviewer-correctness`, `workflow-skills:missing-gaps` and
    `workflow-skills:runtime-cost`.
  - The simpler shape reviewer checks what could be deleted, shared or left out. It loads
    `workflow-skills:cold-alternatives`, `workflow-skills:duplicate-checker` and
    `workflow-skills:abstraction-quality`.
  - The structure reviewer checks whether concerns and layers are separate and whether types are
    narrow. It loads `workflow-skills:separation-of-concerns`, `workflow-skills:domain-leakage`,
    `workflow-skills:smearing`, `workflow-skills:code-smell` and `workflow-skills:type-safety`.
  - The rules and surface reviewer checks which rules the change breaks and how the names and
    comments in it read. It loads `workflow-skills:project-rule-reader`,
    `workflow-skills:code-cleanliness` and `workflow-skills:quality`.

## The findings

- Read what the reviewers found.
- Fix small findings yourself by hand, or hand the findings to one implementer in whatever form you
  see fit.
- Record a finding about code outside the change with `workflow-skills:todo-md`, and leave it out
  of this change.

## The review by the user

- Send the change to the user through the review system the project uses. Open a pull request and
  watch it with `workflow-skills:babysit-pr`, or submit the change to the review process of the
  project.
- Tell the user in the chat what the change does. Add the decisions the implementers listed and
  every part an implementer left unbuilt, with the evidence it returned.
- Expect the user to review the code. When the user rejects the change as too long, send it back to
  be made smaller. Handle every comment the user adds.
- In a project without a review system, report the change to the user. The user may review it but
  does not have to. Push only when the user allows it.
