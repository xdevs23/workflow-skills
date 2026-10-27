---
name: implement
description: Implement change to code, from first talk with user about it until user reviews code.
---

# Implement a change

## Notes

- Write down what user says about change in Markdown file while you talk, by hand.
- Write every word said by user about change into notes. Same words and style, typos and grammar
  fixed.
- Keep each sentence as user said it. Never turn it into your own words or terms.
- Update notes while talk goes on. Correct and change them whenever user corrects or changes what
  they said, so notes always contain what they said.
- Save notes as `<change>.md` in folder for private specs inside project cache, set by
  `workflow-skills:local-cache`, because notes contain user's verbatim words.
- Change lines already in notes to correct fact, or remove what user no longer wants.

## Draft

- Write feature down first, as one entry in `TODO.md` as `workflow-skills:todo-md` describes.
- Once notes done and you already have enough to work with, draw draft for change as
  `workflow-skills:visual-decisions` describes.
- Show on draft: UI/UX where there is one, how state is represented in backend, and modules
  into which feature is split, with what each module may know of others. Such as core that is
  agnostic and one module for each implementation, where modules do not know of each other.
- Draw draft only from decisions already made. Keep what depends on decision still open for user
  out of draft. Write it as rough "not yet specified" note in entry of unit.
- Once draft approved, add sub-units for its modules and for gaps under it as
  `workflow-skills:todo-md` describes, each with own draft. Move down until you have everything
  needed.
- Find facts yourself. Leave decisions to user.
- Save draft of feature as `<change>.html` in same folder as notes. Draft of sub-unit as
  `<change>-<sub-unit number>.html`.
- When user says what should be different, change notes. Update draft as
  `workflow-skills:visual-decisions` describes.
- Start building as soon as user says it can start.
- If user cannot give clear direction or define scope, task workflow with draft writing that
  provides multiple options on scope, UI/UX design and architecture as optional picks.

## Implementation

- Make change of few lines yourself, without workflow. Review it with
  `workflow-skills:review-pass`.
- Run every workflow and agent as `workflow-skills:workflows` describes.
- Write new workflow script for every run. Give it name and description that accurately describe
  what workflow is about.
- Split work as you see fit. Number of agents used by you is not limited.
- Start every implementer as `workflow-skills:implementer`, in worktree in folder set by
  `workflow-skills:local-cache` for workflow worktrees.
- In project made of several git repositories, give each implementer whole tree, with worktree for
  every repository. For tree managed by repo tool, add local manifest that points every project in
  tree at its worktree. Sync it without fetching.
- Where tree has too many repositories to copy, such as ROM tree of thousand repositories, let
  implementer work in that tree.
- Hand every implementer: paths to full notes and approved drafts of its part and of units above
  it, part of change built by it when you split work, and commands of project that build, check and
  test that part alone, where project has them. Never reword notes for it.
- Word part of work handed to implementer by what rule or request behind it is for, such as "a
  value sent by the server and unknown to this build becomes an explicit unknown value where it
  arrives". Never word it as check to make pass, such as "make the lint pass".
- When you run several implementers, give each separate worktree. Merge branches worked on by them
  into one branch before reviewers start, in separate merge step if needed.
- Run parts of work that depend on each other one implementer after other. Start implementer for
  dependent part in worktree and on branch used by implementer before it.
- Pass what researcher finds to implementer as input only. Never turn it into requirement.
- Never give implementer number or any other limit on how large change may be. Only rules on how
  large change may be: those in `workflow-skills:implementer`.
- Prior art is not a reason to reject review finding. If something is bad, it is bad. Excuses
  cannot justify it, however many.

## Reviewers

- Once all implementers done, start following reviewers in parallel on whole change. Tell them
  which repositories change is in, and at which commits it starts and ends.
- Start scope reviewer as `workflow-skills:reviewer-scope`. Hand it notes and approved draft. It
  works without rules.
- Start prose reviewer as `workflow-skills:reviewer-prose`, on smallest model available, at medium
  effort.
- Start four more as `workflow-skills:reviewer-layer`. Hand each notes and skills given to that
  layer by list below. Rules: `workflow-skills:designing-architecture`,
  `workflow-skills:writing-code` with file in its `languages` directory for each language in changed
  files, `workflow-skills:handling-errors`, `workflow-skills:writing-tests`,
  `workflow-skills:debugging`, `workflow-skills:building-screens`, `workflow-skills:storing-data`,
  `workflow-skills:securing-access`, `workflow-skills:changing-the-build`,
  `workflow-skills:verifying-work`, `workflow-skills:working-with-outside-systems`,
  `workflow-skills:writing-style`, `workflow-skills:hygiene`, and instruction files in project root,
  in every directory edited by change, and global instruction file.
  - Correctness reviewer loads `workflow-skills:reviewer-correctness`,
    `workflow-skills:missing-gaps` and `workflow-skills:runtime-cost`, without rules.
  - Simpler shape reviewer loads `workflow-skills:cold-alternatives`,
    `workflow-skills:duplicate-checker` and `workflow-skills:abstraction-quality`, without rules.
  - Structure reviewer loads `workflow-skills:separation-of-concerns`,
    `workflow-skills:domain-leakage`, `workflow-skills:smearing`, `workflow-skills:code-smell`,
    `workflow-skills:type-safety` and rules.
  - Rules and surface reviewer loads `workflow-skills:project-rule-reader`,
    `workflow-skills:rule-bypass`, `workflow-skills:code-cleanliness`, `workflow-skills:quality`
    and rules.
- When change fixes findings of earlier review, hand scope, prose and layer reviewers those
  findings.

## Findings

- Read what reviewers found.
- Start at most one fix run for findings of a change: one implementer that gets all of them, each
  with shape to build as reviewer named it. Or fix them all yourself by hand.
- Fix by hand every finding left after that fix run, and every finding of later review of change.
- Do not start any review round of your own on fix.
- Put every rule reported by implementer as standing in way of its work to user, with place where
  it stood in way.
- Put every optional pick returned by a reviewer to user as section `Questions to the user` of
  `workflow-skills:todo-md` describes. Build it only when user picks it.

## Builds

- Run full build, whole test suite and visual captures yourself, never in implementer or reviewer.
- Build change once its findings fixed. When several changes ready at same time, merge their
  branches into one build branch and build them together. In project without pull requests or other
  review system, working branch is build branch, as section on merging describes.
- Hand each failure, with its output, to one implementer on branch used by change that caused it.
  Hand failure shown only by combination of branches to one implementer on build branch. Build
  again once fixes merged into build branch.
- Where project does not have a command that builds, checks or tests one part alone within seconds,
  design commands that do. Such as one build target for each module, test filter or incremental
  build. Put them to user as unit of work. Record and implement that unit once user approves it.
- Until such commands exist, leave out first step of section on merging. Full build after merge
  covers change.

## Merging

- Take each change through these steps, in this order:
  1. Build change on its branch with targeted checks and builds of parts changed by it. Never run
     full build at this step.
  2. Merge branch into working branch, unless project uses pull requests or other review system.
  3. Run full build, whole test suite and verification on branch that now contains change.
- Keep commits made by implementers and fixers separate until change merged.
- Rebase unpushed commits of unit branch into few logical units.
- In project made of several repositories, first find out which repositories change modified.
  Merge each of them separately.
- Check working branch clean, read result, only then delete worktree, in separate command.

## User review

- Send change to user through review system used by project. Open pull request by
  `workflow-skills:pull-request`, or submit change to review process of project.
- Expect user to review code. When user rejects change, send it back to new run. Handle every
  comment added by user.
- In project without review system, report change to user. User may review it, does not have to.

## Wrapping up

- While build or test runs longer than work needs, or while you are idle, measure where time goes.
  Work on biggest time sink in separate worktree of its own, without waiting for run to end, so
  future workflows run faster.
- After each workflow, read time taken by each agent. Name biggest time sink, remove it where it
  comes from. Such as by preparing shared artifact once, by handing context over in prompt or by
  cutting repeated run.
- Aim for at most 20 minutes per agent. Agent under 20 minutes does not need to be inspected.
- Count as time sink only time spent waiting on machines and on rework. Time spent by agent
  generating output is fine at any length.
- Run checks of agent once, when agent finished writing.
- Remove redundant work from current task right away.
