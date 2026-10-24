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

- Once the notes are done, draw the draft of the change as `workflow-skills:visual-decisions`
  describes.
- Save the draft as `<change>.html` in the same folder as the notes. Number the pages of a draft
  that is split into several, as `<change>-2.html`.
- When the user says what should be different, change the notes, and update the draft as
  `workflow-skills:visual-decisions` describes.
- Start the implementation once the user approves the draft.
- If the user can't give a clear direction or define the scope, task a workflow with draft writing,
  providing multiple options on scope, UI/UX design and architecture as optional picks.

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
- Hand every implementer the paths to the full notes and the approved draft, the part of the change
  it builds when you split the work, and the commands of the project that build, check and test
  that part alone, where the project has them. Never reword the notes for it.
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

- Once all implementers are done, start the following reviewers in parallel on the whole change,
  each with an explicit model. Tell them which repositories the change is in and at which commits it
  starts and ends.
- Start the scope reviewer as `workflow-skills:reviewer-scope` and hand it the notes and the
  approved draft. It checks that the change contains everything the user asks for in the notes and
  nothing else. It works without the rules.
- Start the prose reviewer as `workflow-skills:reviewer-prose`, on the smallest model available, at
  medium effort. It checks every sentence that the change adds or edits against
  `workflow-skills:writing-style`.
- Start four more as `workflow-skills:reviewer-layer` and hand each the notes and the skills that
  the list below gives to that layer. The rules are `workflow-skills:engineering-principles`,
  `workflow-skills:code-writing` with the file for each language in the changed files,
  `workflow-skills:writing-style`, `workflow-skills:hygiene`, and the instruction files in the
  project root, in every directory edited by the change and the global instruction file.
  - The correctness reviewer checks whether the change works and how the cost of running it grows.
    It loads `workflow-skills:reviewer-correctness`, `workflow-skills:missing-gaps` and
    `workflow-skills:runtime-cost`, without the rules.
  - The simpler shape reviewer checks what could be deleted, shared or left out. It loads
    `workflow-skills:cold-alternatives`, `workflow-skills:duplicate-checker` and
    `workflow-skills:abstraction-quality`, without the rules.
  - The structure reviewer checks whether concerns and layers are separate and whether types are
    narrow. It loads `workflow-skills:separation-of-concerns`, `workflow-skills:domain-leakage`,
    `workflow-skills:smearing`, `workflow-skills:code-smell`, `workflow-skills:type-safety` and the
    rules.
  - The rules and surface reviewer checks the change against every rule, looks for ways around
    them, and checks how clean the names and comments in it are. It loads
    `workflow-skills:project-rule-reader`, which reads the rules, `workflow-skills:rule-bypass`,
    `workflow-skills:code-cleanliness` and `workflow-skills:quality`.
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
- Show the user every optional pick a reviewer returns, and build it only when the user picks it.
  Don't wait for the user to respond: show them the options and treat it as asynchronous.

## Builds

- Run the full build, the whole test suite and the visual captures yourself, never in an
  implementer or a reviewer.
- Build a change once its findings are fixed. When several changes are ready at the same time,
  merge their branches into one build branch and build them together.
- Build a change with visual work before its reviewers start, so that the scope reviewer gets the
  captures, as `workflow-skills:visual-verification` describes.
- Hand each failure, with its output, to one implementer on the branch used by the change that
  caused it. Hand a failure that only the combination of branches shows to one implementer on the
  build branch. Build again once the fixes are merged into the build branch.
- Where a project has no command that builds, checks or tests one part alone within seconds, design
  commands that do, such as one build target for each module, a test filter or an incremental
  build. Put them to the user as a unit of work, and record and implement that unit once the user
  approves it.
- Until such commands exist, cover the changes of the implementers with your full build.

## User review

- Send the change to the user through the review system the project uses. Open a pull request by
  `workflow-skills:pull-request` and watch it with `workflow-skills:babysit-pr`, or submit the
  change to the review process of the project.
- Expect the user to review the code. When the user rejects the change, send it back to a new run.
  Handle every comment the user adds.
- In a project without a review system, report the change to the user. The user may review it but
  does not have to.

## Wrapping up

- While a build or a test runs longer than the work needs, measure where the time goes and work on
  the biggest time sink in a worktree of its own, without waiting for the run to end.
- After each workflow, assess what took the longest and try to optimize it so that the next run needs less time. Aim
  for a maximum of 20 minutes per agent. Anything under 20 minutes does not need to be inspected.
