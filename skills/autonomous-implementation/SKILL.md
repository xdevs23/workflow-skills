---
name: autonomous-implementation
description: Implement work end to end without questions, for project, entry of TODO.md or goal where user granted it
---

## The grant

- Work this way only on what latest note in conversation says
  `workflow-skills:autonomous-implementation` applies to: whole project, entry of TODO.md with
  entries under it, or goal of session. Without such note, it applies to nothing
- User sets it with `/autonomy`
- Read latest note before every decision
- Once latest note no longer lists work this run does, stop run at once: do not start another agent, stop
  running workflow, report
- Within grant, use this skill in place of `workflow-skills:implement`. In main conversation, all
  other work follows agent mode set by latest note on agent mode
- Keep standards for all other work, such as rules of `workflow-skills:writing-code` and
  `workflow-skills:hygiene`
- Put no question to user. Leave no decision open. Leave no point open for user or for later
- Finish everything end to end. Fill every gap until work is done
- Hold every action that needs consent from user, such as pushing, publishing and posting

## What is turned around

- User's words rank above research and decisions made by subagents
- Leave every product and architecture decision to subagents
- Draw no drafts, decision, plan or design pages
- Where another skill says to draw decision or stop for one, go on with decision made by subagents
- Go on with other work while held action waits for consent
- Once all work left waits on held actions, end run with report. Count final stop condition met
  except for held actions, each named in report
- Start agents that write code as `workflow-skills:implementer`. Hold their work to rules through
  reviewers

## Intake

- Take user's description of idea
- Take jurisdiction, to which hard rules on law refer, and target platforms from user's words and
  instruction files of user
- Hold every action whose legality depends on jurisdiction that neither user's words nor
  instruction files of user name. Go on with other work

## Milestones

- Keep final stop condition as user stated it. Such as: stop only when full app implemented,
  screenshots and screen recording show it fully working, and APK installable by user on their
  phone delivered
- Run every workflow in worktree
- Commit work of each milestone in commit style
- In project without pull requests or other review system, merge worktree of finished milestone
  into working branch as soon as milestone done
- Run builds for each milestone as section on builds in `workflow-skills:implement` describes.
  Where project needs targeted commands, let subagents design and build them in first milestone
  that needs them
- After last fix, run checks of milestone again. Capture evidence for milestone again. Close
  milestone only on that result
- Stop with report when usage limits for models run low
- Fix every defect introduced by run itself, in whichever milestone it shows up

## Reviews

- Review every milestone that changes code with at least structure reviewer and rules and surface
  reviewer of `workflow-skills:implement`, started as that skill describes
- Add other reviewers in this plugin where work needs them. Decide yourself when they run
- Handle findings as section on findings in `workflow-skills:implement` describes, with each
  milestone as the change

## Hard rules

- Ship and commit only libre components. Build toolchain may be non-free, such as Android SDK, as
  long as nothing of it is shipped or committed. Closed network service or API counts as
  proprietary component
- Use libre variant of component wherever one exists
- Do not use copyrighted material except under libre licence
- Do not break any law of user's jurisdiction
- Take every action permitted by that law, such as reverse engineering for interoperability where
  law allows it
- Build everything to run locally, without cloud services, with data minimization and with
  controls for user over their data
- Do not add telemetry
- Do not take any image, texture, sound file or other asset from internet unless verified to be CC0
- Do not harm any real-world system. Do not hack without authorization, do not access other devices
  on local network, do not scan for credentials
- Do not make any system-wide modification without user's consent
- Check licence of everything downloaded from internet
- Run check of dependencies against advisories
- Record every licence not already contained in fetched content
- For tool taken from package set, such as nixpkgs, that is neither shipped nor committed, check
  its licence only by licence information in package set. Advisory check applies to what ships

## Nix and builds

Only apply when Nix installed.

- Use Nix, such as `nix run` and `nix shell`, wherever component, tool or program is not installed
- Provide `flake.nix` in every project
- Keep everything pure and buildable from source
- Run licence and advisory checks as part of checks of flake
- Take emulators and SDKs from nixpkgs wherever it has them
- Build Android SDK from nixpkgs `androidenv.composeAndroidPackages` in flake, with `allowUnfree`
  and `android_sdk.accept_license` set in its nixpkgs configuration, and every platform and
  build-tools version needed by build listed there
- Link built SDK into `.cache` directory with `nix build` and its `-o` option, through `path:`
  flake reference. Project sets where that directory lies
- Set `ANDROID_HOME` to that shared link
- Leave `sdk.dir` out of `local.properties`

## Code

- Write cleanest best-in-class code, with clear abstractions, modules, layers and interfaces
- Refactor and rewrite code where it needs it
- Never extend code that is already broken

## Evidence and delivery

- Capture screenshots and screen recordings as `workflow-skills:visual-verification` describes.
  Copy ones shown by report from harness directory into local storage
- End run with report: what was built, how to build and install it, evidence, decisions that
  subagents returned with results, and actions held for consent from user or for jurisdiction
