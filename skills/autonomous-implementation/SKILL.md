---
name: autonomous-implementation
description: Implement change autonomously, only when user has asked for it, for one task, for session until revoked or for timeframe
---

## The grant

- Work this way only when user asked for it. User grants it for one task, for whole session until
  they revoke it, or for timeframe named by user.
- Never read grant into request that does not give one.
- Record grant in run file: its scope, when it was given, end of its timeframe, and revocation once
  user revokes it.
- Check grant before every decision.
- Once grant lapsed or was revoked, stop run at once: do not start another agent, stop running
  workflow, report, and ask user as global rules require.
- Keep everything outward-facing out of grant, such as pushing, publishing and posting. It still
  needs user's consent.
- Within grant, use this skill in place of `workflow-skills:implement` for granted work. User chose
  this skill for that work. Global rule to implement through `workflow-skills:implement` applies to
  all other work.

## What is turned around

- Treat run file as authority: user's description, research done at intake, and decisions made by
  subagents. User's answers rank above all of them.
- Leave every product and architecture decision to subagents.
- Orchestrate run: plan milestones, start agents, judge their results against rules, keep run file
  current.
- Start agents that write code as `workflow-skills:implementer`. Hold their work to rules through
  reviewers.
- Hold every agent to `workflow-skills:todo-md` and `workflow-skills:local-cache`. Agents that write
  text shown by product also to `workflow-skills:copywriting`. Name these skills in prompt handed to
  each agent bound by them.
- Let subagents pick among copy variants wherever user would pick by `workflow-skills:copywriting`.
  Log each pick as decision.
- List strings that carry the product in final report. User reads them before anything ships, and
  shipping lies outside grant.

## Intake

- Take user's description of idea, intent, technologies and constraints.
- Research everything needed by work before first milestone starts, with research agents such as
  `workflow-skills:researcher-breadth` and `workflow-skills:researcher-contextfree`.
- Merge results returned by those agents with `workflow-skills:consolidator`.
- Collect intent, goal, technologies, target platforms and constraints. Write them into run file.
- Ask user once, with question that does not block work, for their jurisdiction, to which hard rules
  on law refer, and for target platforms not named in description.
- Do not take action whose legality depends on jurisdiction until jurisdiction known.

## The run file

- Write run file at intake into local storage defined by `workflow-skills:local-cache`. Keep it
  current: grant, description, intent, goal, technologies, constraints, jurisdiction, milestones
  with state of each, decision log, and index that lists evidence.
- Record in run file, for running milestone: run ID of workflow, paths of workflow script and
  journal, worktree used by workflow, and commit checked out in each repository when milestone
  started. So you can find run and its state after resume.
- Reload whole run from run file after crash, compaction or resume.

## Milestones

- Define each milestone before its work starts: what it is, what it contains, what it delivers,
  evidence that proves it, and when it stops.
- Keep final stop condition as user stated it. Such as: stop only when full app implemented,
  screenshots and screen recording show it fully working, and APK installable by user on their
  phone delivered.
- Shape workflows however work needs: which agents run, in which order, how many workflows a
  milestone takes. Scripts do not enforce shape. Reviewers still hold work to rules.
- Run every workflow in worktree.
- Run every workflow and agent as `workflow-skills:workflows` describes.
- Commit work of each milestone in commit style.
- Run builds of each milestone yourself, as section on builds in `workflow-skills:implement`
  describes. Where project needs targeted commands, let subagents design them, log decision in run
  file, and build them in first milestone that needs them.
- After last fix, run checks of milestone again. Capture evidence for milestone again. Close
  milestone only on that result.
- Re-plan milestone that failed three times, or stop run with report.
- Stop with report instead of looping when usage limits of plan for models run low.
- Fix every defect introduced by run itself, in whichever milestone it shows up.
- Fix defect present before run as separate unit in parallel, as `workflow-skills:todo-md`
  describes. It is the one piece of work outside grant started by you.
- Write defect present before run into run file as question to user when fixing it needs decision
  by user.
- Write every other finding beyond granted work, such as idea for feature, into run file as
  question to user. Never work on it.

## Decisions

- Log every decision in run file with its options and its reason, marked as made by agent, so user
  can override any of them later.
- Apply user's answers and overrides at start of next milestone.

## Questions to the user

- Never wait for answer.
- Ask each question as section `Questions to the user` of `workflow-skills:todo-md` describes. Go
  on with decision made by subagents until answer arrives.
- Write each question into run file as well.

## Reviews

- Review every milestone that changes code with at least structure reviewer and rules and surface
  reviewer of `workflow-skills:implement`, started as that skill describes.
- Add other reviewers in this plugin where work needs them. Decide yourself when they run.
- Handle findings as section on findings in `workflow-skills:implement` describes, with each
  milestone as the change.

## Hard rules

- Ship and commit only libre components. Build toolchain may be non-free, such as Android SDK, as
  long as nothing of it is shipped or committed. Closed network service or API counts as
  proprietary component.
- Use libre variant of component wherever one exists.
- Do not use copyrighted material except under libre licence.
- Do not break any law of user's jurisdiction.
- Take every action permitted by that law, such as reverse engineering for interoperability where
  law allows it.
- Build everything to run locally, without cloud services, with data minimization and with
  controls for user over their data.
- Do not add telemetry.
- Do not take any image, texture, sound file or other asset from internet unless verified to be CC0.
- Do not harm any real-world system. Do not hack without authorization, do not access other devices
  on local network, do not scan for credentials.
- Do not make any system-wide modification without user's consent.
- Check licence of everything downloaded from internet.
- Run check of dependencies against advisories.
- Record every licence not already contained in fetched content.
- For tool taken from package set, such as nixpkgs, that is neither shipped nor committed, check
  its licence only by licence information in package set. Advisory check applies to what ships.

## Nix and builds

Only apply when Nix installed.

- Use Nix, such as `nix run` and `nix shell`, wherever component, tool or program is not installed.
- Provide `flake.nix` in every project.
- Keep everything pure and buildable from source.
- Run licence and advisory checks as part of checks of flake.
- Take emulators and SDKs from nixpkgs wherever it has them.
- Build Android SDK from nixpkgs `androidenv.composeAndroidPackages` in flake, with `allowUnfree`
  and `android_sdk.accept_license` set in its nixpkgs configuration, and every platform and
  build-tools version needed by build listed there.
- Link built SDK into `.cache` directory with `nix build` and its `-o` option, through `path:`
  flake reference. Project sets where that directory lies.
- Set `ANDROID_HOME` to that shared link.
- Leave `sdk.dir` out of `local.properties`.

## Code

- Write cleanest best-in-class code, with clear abstractions, modules, layers and interfaces.
- Refactor and rewrite code where it needs it.
- Never extend code that is already broken.

## Evidence and delivery

- Capture screenshots and screen recordings as `workflow-skills:visual-verification` describes.
  Copy ones shown by report from harness directory into local storage. List them in index in run
  file.
- End run with report: what was built, how to build and install it, evidence, decisions made by
  agents, open questions, and what was recorded for later.
