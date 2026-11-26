---
name: implement
description: Implement change to code, from first talk with user until user reviews code
---

- In main conversation whose latest note on agent mode sets `swarm`, follow
  `workflow-skills:orchestrate` in place of this skill. It names sections of this skill you still
  follow
- In main conversation whose latest note on agent mode sets `single`, do not follow this skill
- Run one-time mechanical task yourself, by hand, outside this skill, e.g. sync or move of
  repositories: no draft, no workflow, no agent

## User's words

- Record user's words on unit with `mcp__workflow-skills__record_idea`, verbatim, under entry of
  unit, in turn in which user says them. Record user's words about goal as whole, not about one
  unit of it, under that goal
- Read user's words on unit with `mcp__workflow-skills__get_ideas` before drawing or building it
- Count lines labelled `Project, was for` returned by `mcp__workflow-skills__get_ideas` as context
  from finished entries and cleared goals, never as user's words on unit or requests on it. Say so
  wherever you hand them on
- User's words rank above approved draft wherever the two disagree. Approval of draft approves its
  overall shape, never each detail on it
- Never write down what user said or decided in your own words: no notes, summary or paraphrase,
  in any file
- Count as user's words also decision made by subagents under explicit grant of
  `workflow-skills:autonomous-implementation`

## Draft

- Write feature down first, as one entry in `TODO.md` as `workflow-skills:todo-md` describes
- Once user's words give you enough to work with and any discussion with user reached agreement,
  draw draft for change as `workflow-skills:visual-decisions` describes
- Show on draft: UI/UX where there is one, how state is represented in backend, and modules
  into which feature is split, with what each module may know of others. Such as core that is
  agnostic and one module for each implementation, where modules do not know of each other
- Add sub-units for modules of change whenever change needs them, as `workflow-skills:todo-md`
  describes
- Save draft of feature as `<change>.html` in folder for private specs inside project cache, set by
  `workflow-skills:local-cache`. Draft of sub-unit as `<change>-<sub-unit number>.html`
- When user says what should be different, update draft as `workflow-skills:visual-decisions`
  describes
- Start building as soon as user says it can start

## Implementation

- Make change of few lines yourself, without workflow. Review it with
  `workflow-skills:review-pass`
- Write new workflow script for every run. Give it name and description that accurately describe
  what workflow is about
- Split work as you see fit. Number of agents used by you is not limited
- Start every implementer as `workflow-skills:implementer`, in worktree in folder set by
  `workflow-skills:local-cache` for workflow worktrees
- When change adds text shown by product, run copy phase by `workflow-skills:running-copy-phase`
  before implementers start. Hand them finished strings
- In project made of several git repositories, give each implementer whole tree, with worktree for
  every repository. For tree managed by repo tool, add local manifest that points every project in
  tree at its worktree. Sync it without fetching
- Where tree has too many repositories to copy, such as ROM tree of thousand repositories, let
  implementer work in that tree
- Hand every implementer: user's words on unit as `mcp__workflow-skills__get_ideas` returns them,
  paths to approved drafts of its part and of units above it, and part of change built by it when
  you split work. Add in your own words whatever else helps it
- Word part of work handed to implementer by what rule or request behind it is for, such as "a
  value sent by the server and unknown to this build becomes an explicit unknown value where it
  arrives". Never word it as check to make pass, such as "make the lint pass"
- When you run several implementers, give each separate worktree. Merge branches worked on by them
  into one branch before reviewers start, in separate merge step if needed
- Run parts of work that depend on each other one implementer after other. Start implementer for
  dependent part in worktree and on branch used by implementer before it
- Pass what researcher finds to implementer as input only
- Write prompt for agent other than implementer in compressed register of skills: task, paths,
  inputs. Never repeat rule of skill loaded by agent
- Never give implementer number or any other limit on change size. Only limits: rules in
  `workflow-skills:implementer`
- Prior art is not a reason to reject review finding

## Reviewers

- Once all implementers done, start following reviewers in parallel on whole change. Tell them
  which repositories change is in, and at which commits it starts and ends
- Start scope reviewer as `workflow-skills:reviewer-scope`. Hand it user's words on unit as
  `mcp__workflow-skills__get_ideas` returns them, and approved draft. It works without rules
- Start prose reviewer as `workflow-skills:reviewer-prose`, on smallest model available, at medium
  effort
- Start four more as `workflow-skills:reviewer-layer`. Hand each path of approved draft and skills
  given to that layer by list below. Rules: `workflow-skills:designing-architecture`,
  `workflow-skills:writing-code` with skill for each language in changed files,
  `workflow-skills:handling-errors`, `workflow-skills:writing-tests`,
  `workflow-skills:debugging`, `workflow-skills:building-screens`, `workflow-skills:ux-design`,
  `workflow-skills:storing-data`, `workflow-skills:securing-access`,
  `workflow-skills:changing-the-build`, `workflow-skills:verifying-work`,
  `workflow-skills:working-with-outside-systems`, `workflow-skills:copywriting` with
  `workflow-skills:writing-product-text` when change adds text shown by product,
  `workflow-skills:hygiene`, and instruction files in project root, in every directory edited by
  change, and global instruction file
  - Correctness reviewer loads `workflow-skills:reviewer-correctness`,
    `workflow-skills:missing-gaps` and `workflow-skills:runtime-cost`, without rules
  - Duplication and abstraction reviewer loads `workflow-skills:duplicate-checker` and
    `workflow-skills:abstraction-quality`, without rules
  - Structure reviewer loads `workflow-skills:separation-of-concerns`,
    `workflow-skills:domain-leakage`, `workflow-skills:smearing`, `workflow-skills:code-smell`,
    `workflow-skills:type-safety` and rules
  - Rules and surface reviewer loads `workflow-skills:project-rule-reader`,
    `workflow-skills:rule-bypass`, `workflow-skills:code-cleanliness`, `workflow-skills:quality`
    and rules
- When change fixes findings of earlier review, hand scope, prose and layer reviewers those
  findings

## Findings

- Read what reviewers found
- Start at most one fix run for findings of a change: one implementer that gets all of them, each
  as problem named by reviewer. Hand shape of fix only where approved draft sets it or where cause
  and fix are known. Or fix them all yourself by hand
- Fix by hand every finding left after that fix run, and every finding of later review of change
- Do not start any review round of your own on fix
- In main conversation in agent mode `orchestrator`, once change is built, start right away
  independent workflow for work named by implementers outside their behavior: edge cases not
  covered, lint rules for rules that linter can check, cleanup of existing code
- Take optional pick returned by reviewer into fix run when objectively better in every way and
  obvious engineering choice, like better correctness, code quality, performance. Drop other
  optional picks

## Builds

- Run full build, whole test suite and visual captures yourself, never in implementer or reviewer
- Build change once its findings fixed. When several changes ready at same time, merge their
  branches into one build branch and build them together. In project without pull requests or other
  review system, working branch is build branch, as section on merging describes
- Hand each failure, with its output, to one implementer on branch used by change that caused it.
  Hand failure shown only by combination of branches to one implementer on build branch. Build
  again once fixes merged into build branch
- Where project does not have a command that builds, checks or tests one part alone within seconds,
  design commands that do. Such as one build target for each module, test filter or incremental
  build. Draw draft of unit of work that adds them. Record and implement that unit once user
  approves draft
- Until such commands exist, leave out first step of section on merging. Full build after merge
  covers change

## Merging

- Take each change through these steps, in this order:
  1. Build change on its branch with targeted checks and builds of parts changed by it. Never run
     full build at this step
  2. Merge branch into working branch as soon as step 1 passes, unless project uses pull requests
     or other review system
  3. Run full build, whole test suite and verification on branch that now contains change
- Keep commits made by implementers and fixers separate until change merged
- Rebase unpushed commits of unit branch into few logical units
- In project made of several repositories, first find out which repositories change modified.
  Merge each of them separately
- Check working branch clean, read result, only then delete worktree, in separate command

## Done

- Count change done only once all of these hold:
  - each finding of last review matched to commit fixing it
  - full build, whole test suite and run of changed behavior on its real path, as
    `workflow-skills:verifying-work` describes, pass on commit of working branch that contains
    change. Working branch: main, or branch into which project integrates

## User review

- Send change to user through review system used by project. Open pull request by
  `workflow-skills:pull-request`, or submit change to review process of project
- Expect user to review code. When user rejects change, send it back to new run. Handle every
  comment added by user
- In project without review system, report change to user. User may review it, does not have to

## Wrapping up

- After each workflow, read time taken by each agent. Name biggest time sink, remove it where it
  comes from. Such as by preparing shared artifact once, by handing context over in prompt or by
  cutting repeated run
- Remove time sink caused by work running at same time, e.g. wait on shared machine or on files of
  other work, by running less at once, never by new unit
- Aim for at most 20 minutes per agent. Agent under 20 minutes does not need to be inspected
- Count as time sink only time spent waiting on machines and on rework
- Run checks of agent once, when agent finished writing
- Remove redundant work from current task right away
- Stop each agent whose result the work no longer needs
