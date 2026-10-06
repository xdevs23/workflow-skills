# Autonomous implementation

The autonomous implementation skill, `workflow-skills:autonomous-implementation`, turns
`workflow-skills:implement-review-verify` around for work the user hands over: subagents make the
product and architecture decisions, the user's input is optional and never waited for, and the
work goes milestone by milestone until a stop condition holds with evidence. It is meant for
experiments and novel approaches that have no settled architecture yet.

## When it applies

The skill applies only on the user's grant, and the user chooses its scope: one task, the whole
session until revoked, or a timeframe. The grant is recorded in the run file and checked before
every decision, a revocation stops the run at once, and outward-facing actions such as pushing,
publishing or system-wide changes stay with the user inside a grant as well. Without a grant, the
global rules apply unchanged and decisions go to the user.

## What the skill holds

The authority of a run is its run file in the project cache: the user's description, the intake
research, the milestones, and a log of every decision the subagents made, which the user can
override at the next milestone. Questions to the user never block the run: the harness's
asynchronous question is used where the harness has one, and otherwise the question is recorded
and the run goes on with the subagents' decision.

Each milestone states what it contains, what it delivers, the evidence that proves it and when it
stops. The session runs the milestones in workflows of any shape, and decides which of the plugin's
reviewers check the work and when. A milestone that fails three times is re-planned or ends the run
with a report. Defects the run introduced are fixed wherever they show up, and older defects and
findings beyond the granted work are recorded instead of chased.

The hard rules keep the result libre, legal and local. What the product ships and what is
committed is libre, while a non-free build toolchain such as the Android SDK is allowed, and the
libre variant is used wherever one exists. Everything downloaded has its licence checked, the
dependency advisory check runs, and licences missing from fetched content are recorded. Products
run locally without cloud services, minimize data, give their users control over it and carry no
telemetry. Assets from the internet are used only when verified to be CC0, no real-world system is
harmed, and nothing system-wide changes without consent.

Every project has a pure, source-buildable `flake.nix` whose checks run the licence and advisory
checks, and tools that are missing come from Nix. The Android SDK is built from nixpkgs
`androidenv` and linked into a `.cache` directory that each project chooses, and `ANDROID_HOME`
points at that link, so no `sdk.dir` is needed.

## Decisions

The skill ships no workflow script and sets no shape for the workflows: which agents run, in which
order and how many workflows a milestone takes is the session's choice. It names no agents for the
decisions either. The subagents decide, and which of them decide and how is left to the session as
well. What the skill holds the session to are the rules: the engineering principles, the code
writing rules, hygiene, the todo record and the other skills it names.

The data rules are defaults instead of questions. A product is built locally, without cloud
services, with data minimization and with its users' control over their data, so the GDPR and the
CRA need no question at intake. Only the jurisdiction and open target platforms are asked, once and
without blocking.

The libre rule covers what the product ships and what is committed. Build toolchains are outside
it, and the libre variant is preferred wherever one exists.

## Rejected alternatives

**rejected-enforcing-script**: A milestone workflow script shipped with the skill, enforcing its
stages the way the scripts of `workflow-skills:implement-review-verify` do, was rejected. Runs of
this skill have no fixed shape, and keeping the rules matters more than the shape of the workflow.

**rejected-fixed-run-shape**: A fixed shape for the workflows, written as rules of the skill, was
rejected: one workflow per milestone, a fixed list of reviewers, a review at the end of every
milestone, and the roaster beside every fixer. The workflows take whatever shape the work needs.

**rejected-decision-panel**: Two independent proposers and a judge for every architecture decision
were rejected. The subagents make the decisions, and the skill does not say which of them decide or
how.

**rejected-regulation-questions**: Asking the user at intake whether the GDPR or the CRA applies
was rejected in favour of local, data-minimizing products with user controls as the default.
