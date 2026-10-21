---
name: autonomous-implementation
description: Applies only when the user has asked for autonomous implementation, for one task, for the session until revoked or for a timeframe, such as for an experiment or a novel approach whose architecture is not decided yet.
---

# Autonomous implementation

**Load the `workflow-skills:writing-style` skill first.** The rules in it apply to every comment,
document, commit message and reply you write while you follow this skill. Load it whenever you work
with this plugin.

Autonomous implementation is `workflow-skills:implement` turned around. There, the user approves
notes of the user's words and a draft before anything is built. Here, subagents make the
decisions, the user's input is optional and never waited for, and the work goes milestone by
milestone until its stop condition is met and the evidence shows it.

- Follow every rule by what it is for. Getting a result forbidden by a rule through another route,
  such as a cast hidden in a helper, a type widened until a value fits or a term redefined until
  the work passes, breaks the rule just as the forbidden form does. When a rule stands in the way
  of your work, name it where you report your work, and never go around it.

## The grant

- Work this way only when the user asked for it. The user grants it for one task, for the whole
  session until they revoke it, or for a timeframe named by the user.
- Never read a grant into a request that does not give one.
- Record the grant in the run file: its scope, when it was given, the end of its timeframe, and the
  revocation once the user revokes it.
- Check the grant before every decision.
- Once the grant has lapsed or was revoked, stop the run at once: do not start another agent, stop
  the running workflow, report, and ask the user as the global rules require.
- Keep everything outward-facing out of the grant, such as pushing, publishing and posting: it still
  needs the user's consent.
- Within the grant, use this skill in place of `workflow-skills:implement` for the granted work.
  The user chose this skill for that work. The global rule to implement through
  `workflow-skills:implement` applies to all other work.

## What is turned around

- Treat the run file as the authority: the user's description, the research done at intake, and the
  decisions made by the subagents, with the user's answers above all of them.
- Leave every product and architecture decision to the subagents.
- Orchestrate the run: plan the milestones, start the agents, judge their results against the
  rules, and keep the run file current.
- Start the agents that write code as `workflow-skills:implementer`, which works without the rule
  skills. Hold their work to the rules through the reviewers.
- Hold every agent to `workflow-skills:todo-md` and `workflow-skills:local-cache`, and the agents
  that write the text shown by the product to `workflow-skills:copywriting`. Name these skills in
  the prompt handed to each agent bound by them.
- Let the subagents pick among the copy variants wherever the user would pick by
  `workflow-skills:copywriting`, and log each pick as a decision.
- List in the final report the strings that carry the product. The user reads them before
  anything ships, and shipping lies outside the grant.

## Intake

- Take the user's description of the idea, the intent, the technologies and the constraints.
- Research everything needed by the work before the first milestone starts, with research agents
  such as `workflow-skills:researcher-breadth` and `workflow-skills:researcher-contextfree`.
- Merge the results returned by those agents with `workflow-skills:consolidator`.
- Collect the intent, the goal, the technologies, the target platforms and the constraints, and
  write them into the run file.
- Ask the user once, with a question that does not block the work, for their jurisdiction, which
  the hard rules on law refer to, and for the target platforms not named in the description.
- Do not take an action whose legality depends on the jurisdiction until the jurisdiction is known.

## The run file

- Write the run file at intake into the project cache defined by `workflow-skills:local-cache`, and
  keep it current: the grant, the description, the intent, the goal, the technologies, the
  constraints, the jurisdiction, the milestones with the state of each, the decision log and the
  index of the evidence.
- Record in the run file, for the running milestone, the run ID of the workflow, the paths of the
  workflow script and journal, the worktree used by the workflow, and the commit checked out in each
  repository when the milestone started, so that you can find the run and its state after a resume.
- Reload the whole run from the run file after a crash, a compaction or a resume.

## Milestones

- Define each milestone before its work starts: what it is, what it contains, what it delivers, the
  evidence that proves it, and when it stops.
- Keep the final stop condition as the user stated it, such as: stop only when the full app is
  implemented, screenshots and a screen recording show it fully working, and an APK the user can
  install on their phone is delivered.
- Shape the workflows however the work needs: which agents run, in which order, and how many
  workflows a milestone takes. Scripts do not enforce a shape. The reviewers still hold the work to
  the rules.
- Run every workflow in a worktree, with an explicit model on every agent.
- Commit the work of each milestone in the commit style.
- Run the builds of each milestone yourself, as the section on builds in `workflow-skills:implement`
  describes. Where the project needs targeted commands, let the subagents design them, log the
  decision in the run file, and build them in the first milestone that needs them.
- After the last fix, run the checks of the milestone again and capture the evidence for the
  milestone again. Close the milestone only on that result.
- Re-plan a milestone that failed three times, or stop the run with a report.
- Stop with a report instead of looping when the usage limits of the plan for the models run low.
- Fix every defect introduced by the run itself, in whichever milestone it shows up.
- Fix a defect present before the run as a separate unit in parallel, as `workflow-skills:todo-md`
  describes. It is the one piece of work outside the grant that you start.
- Write a defect present before the run into the run file as a question to the user when fixing it
  needs a decision by the user.
- Write every other finding beyond the granted work, such as an idea for a feature, into the run
  file as a question to the user. Never work on it.
- Remove a silenced check in a file the run edits, also one from before the run, as part of the
  run.

## Decisions

- Log every decision in the run file with its options and its reason, marked as made by an agent,
  so the user can override any of them later.
- Apply the user's answers and overrides at the start of the next milestone.

## Questions to the user

- Never wait for an answer.
- Ask through an asynchronous question where the harness has one: a dialog answered by the user
  while you keep working.
- Where the harness has none, write the question into the run file, go on with the decision made by
  the subagents, and name the question in your next message to the user.

## Reviews

- Review every milestone that changes code with at least the structure reviewer and the rules and
  surface reviewer of `workflow-skills:implement`, started as that skill describes.
- Add the other reviewers in this plugin where the work needs them, and decide yourself when they
  run.
- Handle the findings as the section on findings in `workflow-skills:implement` describes, with
  each milestone as the change.

## Hard rules

- Ship and commit only libre components. A build toolchain may be non-free, such as the Android SDK,
  as long as nothing of it is shipped or committed. A closed network service or API counts as a
  proprietary component.
- Use the libre variant of a component wherever one exists.
- Use no copyrighted material except under a libre licence.
- Break no law of the user's jurisdiction.
- Take every action permitted by that law, such as reverse engineering for interoperability where
  the law allows it.
- Build everything to run locally, without cloud services, with data minimization and with
  controls for the user over their data.
- Add no telemetry.
- Take no image, texture, sound file or other asset from the internet unless it is verified to be
  CC0.
- Harm no real-world system. Do not hack without authorization, do not access other devices on the
  local network, and do not scan for credentials.
- Make no system-wide modification without the user's consent.
- Check the licence of everything downloaded from the internet.
- Run the check of the dependencies against advisories.
- Record every licence not already contained in the fetched content.
- For a tool taken from a package set, such as nixpkgs, that is neither shipped nor committed,
  check its licence only by the licence information in the package set. The advisory check applies
  to what ships.

## Nix and builds

- Use Nix, such as `nix run` and `nix shell`, wherever a component, tool or program is not
  installed.
- Provide a `flake.nix` in every project.
- Keep everything pure and buildable from source.
- Run the licence and advisory checks as part of the checks of the flake.
- Take emulators and SDKs from nixpkgs wherever it has them.
- Build the Android SDK from nixpkgs `androidenv.composeAndroidPackages` in the flake, with
  `allowUnfree` and `android_sdk.accept_license` set in its nixpkgs configuration, and every
  platform and build-tools version needed by the build listed there.
- Link the built SDK into a `.cache` directory with `nix build` and its `-o` option, through a
  `path:` flake reference. The project sets where that directory lies.
- Set `ANDROID_HOME` to that shared link.
- Leave `sdk.dir` out of `local.properties`.

## Code

- Write the cleanest best-in-class code, with clear abstractions, modules, layers and interfaces.
- Refactor and rewrite code where it needs it.
- Never extend code that is already broken.

## Evidence and delivery

- Capture screenshots and screen recordings as `workflow-skills:visual-verification` describes, keep
  them in the project cache, and list them in the index of the evidence in the run file.
- Keep signing keys and other secrets out of the repository, as `workflow-skills:hygiene` requires.
- End the run with a report: what was built, how to build and install it, the evidence, the
  decisions made by the agents, the open questions, and what was recorded for later.
