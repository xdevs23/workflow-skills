---
name: implement
description: Implement a change to code, from the first talk with the user about it until the user reviews the code.
---

# Implement a change

**Load the `workflow-skills:writing-style` skill first.** The rules in it apply to every comment,
document, commit message and reply you write while you follow this skill. Load it whenever you work
with this plugin.

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

- Write the feature down first, as one entry in `TODO.md` as `workflow-skills:todo-md` describes.
- Once the notes are done and you already have enough to work with, draw the draft for the change
  as `workflow-skills:visual-decisions` describes.
- Show on the draft the UI/UX where there is one, how the state is represented in the backend, and
  the modules the feature is split into, with what each module may know of the others, such as a
  core that stays agnostic and one module for each implementation, where the modules do not know of
  each other.
- Draw a draft only from decisions already made. Keep what depends on a decision still open for the
  user out of the draft, and write it as a rough "not yet specified" note in the entry of the unit.
- Once a draft is approved, add the sub-units for its modules and for the gaps under it as
  `workflow-skills:todo-md` describes, each with its own draft, and move down until you have
  everything you need.
- Find the facts yourself, and leave the decisions to the user.
- Save the draft of the feature as `<change>.html` in the same folder as the notes, and the draft of
  a sub-unit as `<change>-<sub-unit number>.html`.
- When the user says what should be different, change the notes, and update the draft as
  `workflow-skills:visual-decisions` describes.
- Start building as soon as the user says it can start.
- If the user can't give a clear direction or define the scope, task a workflow with draft writing,
  providing multiple options on scope, UI/UX design and architecture as optional picks.

## Implementation

- Make a change of a few lines yourself, without a workflow, and review it with
  `workflow-skills:review-pass`.
- Run every workflow and agent as `workflow-skills:workflows` describes.
- Write a new workflow script for every run. Give it a name and a description that accurately
  describe what the workflow is about.
- Split the work as you see fit. There is no limit to how many agents you use.
- Start every implementer as `workflow-skills:implementer`, in a worktree in
  the folder that `workflow-skills:local-cache` sets for workflow worktrees.
- In a project made of several git repositories, give each implementer the whole tree, with a
  worktree for every repository. For a tree that the repo tool manages, add a local manifest that
  points every project in the tree at its worktree, and sync it without fetching.
- Where a tree has too many repositories to copy, such as a ROM tree of a thousand repositories,
  let the implementer work in that tree.
- Hand every implementer the paths to the full notes and the approved drafts of its part and of
  the units above it, the part of the change it builds when you split the work, and the commands of
  the project that build, check and test that part alone, where the project has them. Never reword
  the notes for it.
- Word the part of the work handed to an implementer by what the rule or the request behind it is
  for, such as "a value sent by the server and unknown to this build becomes an explicit unknown
  value where it arrives". Never word it by the check it should make pass, such as "make the lint
  pass".
- When you run several implementers, give each of them a separate worktree. Merge the branches
  they worked on into one branch before the reviewers start, if needed in a separate merge step.
- Run parts of the work that depend on each other one implementer after the other. Start the
  implementer for a dependent part in the worktree and on the branch that the implementer before it
  used.
- Pass what a researcher finds to the implementer as input only, without turning it into a
  requirement.
- Never give an implementer a number or any other limit on how large the change may be. The only
  rules on how large the change may be are the ones in `workflow-skills:implementer`.
- Prior art is not a reason to reject a review finding. If something is bad, it is bad, and there
  is no amount of excuse that can justify it.

## Reviewers

- Once all implementers are done, start the following reviewers in parallel on the whole change.
  Tell them which repositories the change is in and at which commits it
  starts and ends.
- Start the scope reviewer as `workflow-skills:reviewer-scope` and hand it the notes and the
  approved draft. It works without the rules.
- Start the prose reviewer as `workflow-skills:reviewer-prose`, on the smallest model available, at
  medium effort.
- Start four more as `workflow-skills:reviewer-layer` and hand each the notes and the skills that
  the list below gives to that layer. The rules are `workflow-skills:engineering-principles`,
  `workflow-skills:code-writing` with the file for each language in the changed files,
  `workflow-skills:writing-style`, `workflow-skills:hygiene`, and the instruction files in the
  project root, in every directory edited by the change and the global instruction file.
  - The correctness reviewer loads `workflow-skills:reviewer-correctness`,
    `workflow-skills:missing-gaps` and `workflow-skills:runtime-cost`, without the rules.
  - The simpler shape reviewer loads `workflow-skills:cold-alternatives`,
    `workflow-skills:duplicate-checker` and `workflow-skills:abstraction-quality`, without the
    rules.
  - The structure reviewer loads `workflow-skills:separation-of-concerns`,
    `workflow-skills:domain-leakage`, `workflow-skills:smearing`, `workflow-skills:code-smell`,
    `workflow-skills:type-safety` and the rules.
  - The rules and surface reviewer loads `workflow-skills:project-rule-reader`, which reads the
    rules, `workflow-skills:rule-bypass`, `workflow-skills:code-cleanliness` and
    `workflow-skills:quality`.
- When the change fixes findings of an earlier review, hand the scope, prose and layer reviewers
  those findings.

## Findings

- Read what the reviewers found.
- Start at most one fix run for the findings of a change, with one implementer that gets all of
  them, each with the shape to build as the reviewer named it, or fix them all yourself by hand.
- Fix by hand every finding left after that fix run, and every finding of a later review of the
  change.
- Start no review round of your own on the fix.
- Put every rule that an implementer reports as standing in the way of its work to the user, with
  the place where it stood in the way.
- Put every optional pick a reviewer returns to the user as the section `Questions to the user` of
  `workflow-skills:todo-md` describes, and build it only when the user picks it.

## Builds

- Run the full build, the whole test suite and the visual captures yourself, never in an
  implementer or a reviewer.
- Build a change once its findings are fixed. When several changes are ready at the same time,
  merge their branches into one build branch and build them together. In a project without pull
  requests or another review system, the working branch is the build branch, as the section on
  merging describes.
- Hand each failure, with its output, to one implementer on the branch used by the change that
  caused it. Hand a failure that only the combination of branches shows to one implementer on the
  build branch. Build again once the fixes are merged into the build branch.
- Where a project has no command that builds, checks or tests one part alone within seconds, design
  commands that do, such as one build target for each module, a test filter or an incremental
  build. Put them to the user as a unit of work, and record and implement that unit once the user
  approves it.
- Until such commands exist, leave out the first step of the section on merging. The full build
  after the merge covers the change.

## Merging

- Take each change through these steps, in this order:
  1. Build the change on its branch with the targeted checks and builds of the parts it changes.
     Never run the full build at this step.
  2. Merge the branch into the working branch, unless the project uses pull requests or another
     review system.
  3. Run the full build, the whole test suite and the verification on the branch that now contains
     the change.
- Keep the commits made by the implementers and fixers separate until the change is merged.
- Rebase the unpushed commits of the unit branch into a few logical units.
- In a project made of several repositories, find out first which repositories the change
  modified, and merge each of them separately.
- Check that the working branch is clean, read the result, and only then delete the worktree, in a
  separate command.

## User review

- Send the change to the user through the review system the project uses. Open a pull request by
  `workflow-skills:pull-request`, or submit the change to the review process of the project.
- Expect the user to review the code. When the user rejects the change, send it back to a new run.
  Handle every comment the user adds.
- In a project without a review system, report the change to the user. The user may review it but
  does not have to.

## Wrapping up

- While a build or a test runs longer than the work needs, or while you are idle, measure where the
  time goes and work on the biggest time sink in a worktree of its own, without waiting for the run
  to end, so future workflows run faster.
- After each workflow, read the time taken by each agent, name the biggest time sink and remove it
  where it comes from, such as by preparing a shared artifact once, by handing context over in the
  prompt or by cutting a repeated run.
- Aim for at most 20 minutes per agent. An agent under 20 minutes does not need to be inspected.
- Count as a time sink only time spent waiting on machines and on rework. Time an agent spends
  generating output is fine at any length.
- Run the checks of an agent once, when the agent has finished writing.
- Remove redundant work from the current task right away.
