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

## User words

- Record user words on unit with `mcp__workflow-skills__record_idea`, verbatim, under entry of
  unit, in turn in which user says them. Record user words about goal as whole, not about one
  unit of it, under that goal
- Read user words on unit with `mcp__workflow-skills__get_ideas` before drawing or building it
- Count lines labelled `Project, was for` returned by `mcp__workflow-skills__get_ideas` as context
  from finished entries and cleared goals, never as user words on unit or requests on it
- User words rank above approved draft wherever the two disagree. Approval of draft approves its
  overall shape, never each detail on it
- Never write down what user said or decided in your own words: no notes, summary or paraphrase,
  in any file

## Draft

- Write feature down first, as one entry in `TODO.md` as `workflow-skills:todo-md` describes
- Once user words give you enough to work with and any discussion with user reached agreement,
  draw draft for change as `workflow-skills:visual-decisions` describes
- Show on draft: UI/UX where there is one, how state is represented in backend, and modules
  into which feature is split, with what each module may know of others
- Save draft as `workflow-skills:local-cache` describes for private specs
- Start building as soon as user says it can start

## Building

- Hand every agent that writes code user words on its part, as
  `mcp__workflow-skills__get_ideas` returns them
- Word work handed to agent by what rule or request behind it is for, such as "a value sent by
  the server and unknown to this build becomes an explicit unknown value where it arrives". Never
  word it as check to make pass, such as "make the lint pass"
- Never give agent number or any other limit on change size
- Write product text as `workflow-skills:running-copy-phase` describes
- Prior art is not a reason to reject review finding
- Stop each agent whose result work no longer needs
- Delete working directory of agent only after reading that nothing in it is left uncommitted, in
  separate command

## Done

- Count change done only once all of these hold:
  - it does what user words on unit ask, and nothing beyond them
  - it meets rules of `workflow-skills:writing-code` and of every other skill that applies to it
  - it is on working branch: main, or branch into which project integrates
  - build, checks and run of changed behavior on its real path, as `workflow-skills:verifying-work`
    describes, pass on what landed there
  - its unpushed commits form logical units, as `workflow-skills:logical-units` describes

## User review

- Send change to user through review system used by project, such as pull request by
  `workflow-skills:pull-request`. In project without review system, report change to user
- When user rejects change, build it again. Handle every comment added by user
