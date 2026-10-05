---
name: autonomous-implementation
description: Applies only when the user has asked for autonomous implementation, for one task, for the session until revoked or for a timeframe, such as for an experiment or a novel approach that has no settled architecture yet.
---

# Autonomous implementation

**Load the `workflow-skills:writing-style` skill first.** It binds every comment, document, commit
message and reply this skill produces, and it is not optional when working with this plugin.

Autonomous implementation is `workflow-skills:implement-review-verify` turned around. There, the
user's words are the only authority and you decide nothing yourself. Here, subagents make the
decisions, the user's input is optional and never waited for, and the work goes milestone by
milestone until its stop condition holds and the evidence shows it.

## The grant

- Work this way only when the user asked for it. The user grants it for one task, for the whole
  session until they revoke it, or for a timeframe they name.
- Never read a grant into a request that does not give one.
- Record the grant in the run file: its scope, when it was given, the end of its timeframe, and the
  revocation once one comes.
- Check the grant before every decision. Once it has lapsed or was revoked, stop the run at once:
  start no further agent, stop the running workflow, report, and ask the user as the global rules
  say.
- Keep everything outward-facing out of the grant, such as pushing, publishing and posting: it still
  needs the user's consent.
- Within the grant, use this skill in place of `workflow-skills:implement-review-verify` for the
  granted work. The user chose it for that work, and the global rule to implement through
  `workflow-skills:implement-review-verify` covers every other work.

## What turns around

- Treat the run file as the authority: the user's description, the intake research, and the
  decisions the subagents made, with the user's answers above all of them.
- Leave every product and architecture decision to the subagents.
- Orchestrate the run: plan the milestones, start the agents, judge their results against the
  rules, and keep the run file current.
- Hold every agent to the same rules as in any other work: `workflow-skills:engineering-principles`,
  `workflow-skills:code-writing`, `workflow-skills:hygiene`, `workflow-skills:todo-md`,
  `workflow-skills:local-cache`, `workflow-skills:writing-style`, and
  `workflow-skills:copywriting` for every text the product shows. Name the rules that bind each
  agent in its prompt.
- Let the decision panel pick among the copy variants where `workflow-skills:copywriting` asks the
  user to pick, log each pick as a decision, and list the strings that carry the product in the
  final report, because the user reads them before anything ships and shipping lies outside the
  grant.

## Intake

- Take the user's description of the idea, the intent, the technologies and the constraints.
- Research everything the work needs before the first milestone starts, with research agents such
  as `workflow-skills:researcher-breadth` and `workflow-skills:researcher-contextfree`, merged by
  `workflow-skills:consolidator`.
- Collect the intent, the goal, the technologies, the target platforms and the constraints, and
  write them into the run file.
- Ask the user once, as a question that blocks nothing, for the jurisdiction the law rules refer
  to and for the target platforms where the description leaves them open.
- Take no action whose legality depends on the jurisdiction until the jurisdiction is known.

## The run file

- Write the run file at intake into the project cache that `workflow-skills:local-cache` defines,
  and keep it current: the grant, the description, the intent, the goal, the technologies, the
  constraints, the jurisdiction, the milestones with the state of each, the decision log and the
  index of the evidence.
- Record in the run file, for the milestone that is running, its workflow's run ID, the paths of its
  script and its journal, its worktree, and the commit each repository was at when it started, so a
  resume finds the run and its state.
- Reload the whole run from the run file after a crash, a compaction or a resume.

## Milestones

- Define each milestone before its work starts: what it is, what it contains, what it delivers, the
  evidence that proves it, and when it stops.
- Keep the final stop condition as the user stated it, such as: stop only when the full app is
  implemented, screenshots and a screen recording show it fully working, and an APK the user can
  install on their phone is delivered.
- Run each milestone as one workflow in its own worktree, with an explicit model on every agent.
  Shape the workflow however the milestone needs: no script enforces it, and every agent in it
  keeps the rules.
- Commit each milestone's work in the commit style.
- Run the milestone's checks again and capture its evidence again after the last fix, and close the
  milestone only on that result.
- Re-plan a milestone that failed three times, or stop the run with a report.
- Stop with a report instead of looping when the model plan's limits run low.
- Fix every defect the run itself introduced, in whichever milestone it shows up.
- Record defects that were there before the run, and findings beyond the granted work, in the todo
  record that `workflow-skills:todo-md` defines, and never chase them.

## Decisions

- Let two independent proposers and one judge decide each architecture decision, so no single
  agent's habit becomes the design.
- Log every decision in the run file with its options and its reason, marked as made by an agent,
  so the user can override any of them later.
- Apply the user's answers and overrides at the next milestone boundary.

## Questions to the user

- Never wait for an answer. Use the harness's asynchronous question where it has one, a dialog the
  user answers while you keep working.
- Where the harness has none, record the question in the todo record as `workflow-skills:todo-md`
  says, go on with the decision the subagents made, and name the question in your next message to
  the user.

## Reviews

- Decide yourself when a review runs, and run one at the latest at the end of every milestone.
- Review with a subset of the plugin's reviewers: `workflow-skills:reviewer-correctness`,
  `workflow-skills:quality`, `workflow-skills:project-rule-reader`,
  `workflow-skills:cold-alternatives`, `workflow-skills:separation-of-concerns`,
  `workflow-skills:abstraction-quality` and `workflow-skills:missing-gaps`.
- Run `workflow-skills:roaster` beside every fixer.
- Have `workflow-skills:fixer` fix a milestone's findings within that milestone.

## Hard rules

- Ship and commit only libre components. A build toolchain may be non-free, such as the Android SDK,
  as long as nothing of it is shipped or committed. A closed network service or API counts as a
  proprietary component.
- Use the libre variant of a component wherever one exists.
- Use no copyrighted material except under a libre licence.
- Break no law of the user's jurisdiction, and take every action the law permits, such as reverse
  engineering for interoperability where the law allows it.
- Build everything to run locally, without cloud services, with data minimization and with
  controls for the user over their data.
- Add no telemetry.
- Take no image, texture, sound file or other asset from the internet unless it is verified to be
  CC0.
- Harm no real-world system: no unauthorized hacking, no access to other devices on the local
  network, and no scanning for credentials.
- Make no system-wide modification without the user's consent.
- Check the licence of everything downloaded from the internet.
- Run the dependency advisory check.
- Record every licence that the fetched content does not already contain.

## Nix and builds

- Use Nix, such as `nix run` and `nix shell`, wherever a component, tool or program is not
  installed.
- Provide a `flake.nix` in every project.
- Keep everything pure and buildable from source.
- Run the licence and advisory checks among the flake's checks.
- Take emulators and SDKs from nixpkgs wherever it has them.
- Build the Android SDK from nixpkgs `androidenv.composeAndroidPackages` in the flake, with
  `allowUnfree` and `android_sdk.accept_license` set in its nixpkgs configuration, and every
  platform and build-tools version the build needs listed there.
- Link the SDK into a `.cache` directory outside the repository with `nix build path:.#android-sdk
  -o ../.cache/android-sdk`, because a `path:` flake reference copies the whole tree into the Nix
  store, and point a committed `local.properties` at it with the relative line
  `sdk.dir=../.cache/android-sdk/libexec/android-sdk`.
- Populate `../.cache/android-sdk` as a symlink forest instead, with an app of the flake, where a
  tool refuses to follow the single top-level link. The SDK root is then that directory itself.
- Run `./gradlew --stop` after the link moves, because a running Gradle daemon keeps the old SDK
  location.
- Point Gradle at the patched `aapt2` of the SDK with `-Pandroid.aapt2FromMavenOverride` on a NixOS
  machine without nix-ld, where the `aapt2` that Gradle downloads cannot run.

## Code

- Write the cleanest best-in-class code, with clear abstractions, modules, layers and interfaces.
- Refactor and rewrite code where it needs it, and never extend what is already broken.

## Evidence and delivery

- Capture screenshots and screen recordings as `workflow-skills:visual-verification` describes, keep
  them in the project cache, and list them in the run file's evidence index.
- Keep signing keys and other secrets out of the repository, as `workflow-skills:hygiene` says.
- End the run with a report: what was built, how to build and install it, the evidence, the
  decisions the agents made, the open questions, and what was recorded for later.
