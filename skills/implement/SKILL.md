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

## Notes

- Write down what the user says about the change in a Markdown file while you talk, by hand.
- Write every word the user says about the change into the notes, in the same words and style,
  with typos and grammar fixed.
- Keep each sentence as the user said it, and never turn it into your own words or terms.
- Update the notes while the talk goes on. Correct and change them whenever the user corrects or
  changes what they said, so the notes always contain what they said.
- Save the notes as `<change>.md` in the folder for private specs inside the project cache, which
  `workflow-skills:local-cache` sets, because the notes contain their verbatim words.
- Change lines already in the notes to correct a fact, or remove what the user no longer wants.

## Draft

- Once the notes are done, draw the draft of the change as `workflow-skills:visual-decisions`
  describes.
- Save the draft as `<change>.html` in the same folder as the notes.
- When the user says what should be different, change the notes, and update the draft as
  `workflow-skills:visual-decisions` describes.
- Start the implementation once the user approves the draft.

## Implementation

- Write a new workflow script for every run. Give it a name and a description that accurately
  describe what the workflow is about.
- Split the work as you see fit. There is no limit to how many agents you use.
- Start every implementer as `workflow-skills:implementer` with an explicit model, in a worktree in
  the folder that `workflow-skills:local-cache` sets for workflow worktrees.
- In a project made of several git repositories, give each implementer the whole tree, with a
  worktree for every repository. For a tree that the repo tool manages, add a local manifest that
  points every project in the tree at its worktree, and sync it without fetching.
- Where a tree has too many repositories to copy, such as a ROM tree of a thousand repositories,
  let the implementer work in that tree.
- Hand every implementer the paths to the full notes, the approved draft and the rules summary in
  `rules-summary.md` next to this skill. When you split the work, add which part of the change it
  builds. Never reword the notes for it.
- When you run several implementers, give each of them a separate worktree. Merge the branches
  they worked on into one branch before the reviewers start, if needed in a separate merge step.
- Run parts of the work that depend on each other one implementer after the other. Start the
  implementer for a dependent part in the worktree and on the branch that the implementer before it
  used.
- Pass what a researcher finds to the implementer as input only, without turning it into a
  requirement.
- Never give an implementer a number or any other limit on how large the change may be. The only
  rule on the size of the change is the one in `workflow-skills:implementer`.

## Reviewers

- Once all implementers are done, start the following reviewers in parallel on the whole change,
  each with an explicit model. Tell them which repositories the change is in and at which commits it
  starts and ends.
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

## Findings

- Read what the reviewers found.
- Fix small findings yourself by hand, or hand the findings to one implementer in whatever form you
  see fit.
- Record a finding about code outside the change with `workflow-skills:todo-md`, and leave it out
  of this change.

## User review

- Send the change to the user through the review system the project uses. Open a pull request and
  watch it with `workflow-skills:babysit-pr`, or submit the change to the review process of the
  project.
- Expect the user to review the code. When the user rejects the change, send it back to a new run.
  Handle every comment the user adds.
- In a project without a review system, report the change to the user. The user may review it but
  does not have to.
