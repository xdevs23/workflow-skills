---
name: autonomous-implementation
description: Implement work under autonomous grant, for project, entry of TODO.md or goal where user granted it
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
- Finish everything end to end. Get task done, properly, with highest quality

## Hard rules

- Ship and commit only libre components. Build toolchain may be non-free, such as Android SDK, as
  long as nothing of it is shipped or committed. Closed network service or API counts as
  proprietary component unless task is about that specific service/API
- Use libre variant of component wherever one exists
- Do not use copyrighted material except under libre licence
- Do not break any law of user's jurisdiction
- Take every action permitted by that law, such as reverse engineering for interoperability where
  law allows it
- Unless otherwise specified, build everything to run locally, without external cloud services, with data minimization and with controls for user over their data
- Do not add telemetry unless otherwise specified
- Do not take any image, texture, sound file or other asset from internet unless verified to be CC0
  or provided by user explicitly
- Do not harm any real-world system. Do not hack without authorization, do not access other devices
  on local network that user has not authorized explicitly, do not scan for credentials
- Do not make any system-wide modification without user consent
- Check licence of everything downloaded from internet
- Run check of dependencies against advisories
- Record every licence not already contained in fetched content
- For tool taken from package set, such as nixpkgs, that is neither shipped nor committed, check
  its licence only by licence information in package set. Advisory check applies to what ships

## Code

- Write cleanest, highest quality code, with clear abstractions, modules, layers and interfaces
- Implement clean, strict and enforceable, well separated modules
- Separate modules into layers, horizontally and vertically
- Refactor and rewrite code when needed for cleanliness
- Never extend code that is already broken, rewrite or fix it instead

## Evidence and delivery

- Capture screenshots and screen recordings as `workflow-skills:visual-verification` describes.
  Copy ones shown by report from harness directory into local storage
- End run with report: what was built, how to build and install it, evidence

## Nix and builds

Only apply when Nix installed.

- Use Nix, such as `nix run` and `nix shell`, wherever component, tool or program is not installed
- Provide `flake.nix` in every project
- Keep everything pure and buildable from source
- Run licence and advisory checks as part of checks of flake
- Take emulators and SDKs from nixpkgs wherever it has them

## When using Android SDK

- Build Android SDK from nixpkgs `androidenv.composeAndroidPackages` in flake, with `allowUnfree`
  and `android_sdk.accept_license` set in its nixpkgs configuration, and every platform and
  build-tools version needed by build listed there
- Link built SDK into `.cache` directory with `nix build` and its `-o` option, through `path:`
  flake reference. Project sets where that directory lies
- Set `ANDROID_HOME` to that shared link
- Leave `sdk.dir` out of `local.properties`
