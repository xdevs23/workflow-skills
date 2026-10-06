---
name: review-pass
description: Applies to a change that is already committed and needs only a review, such as a change you edited directly.
---

# Review a committed change

**Load the `workflow-skills:writing-style` skill first.** It binds every comment, document, commit
message and reply this skill produces, and it is not optional when working with this plugin.

The review pass is a run of the main script of `workflow-skills:implement-review-verify` in review
mode: thirteen of its reviewers, on whatever you name for review, with no spec, no implementer, no
finding verifier and no fixer. A change you made directly was made
without a spec, so the review pass takes none. The spec-compliance and inverse-spec reviewers judge
a change against its spec, so they do not run, and the other reviewers read the change by the code
and the rule sources.

- Use it when a full run of `workflow-skills:implement-review-verify` would cost more than the
  change needs, such as for a change you made directly.

## The script

- Copy the main script of `workflow-skills:implement-review-verify` and set `mode` to `review` in
  its marked block.
- Fill the rest of the marked block as for a main run, without the `impl`, `verify`, `fix` and
  `roast` entries of `models` and the `spec` and `inverse` entries of `models.review`. Leave those
  out: those agents do not run, and the script stops on an entry that names no agent the run
  starts.
- Set `meta.name` to a kebab-case name of the review and `meta.description` to one line saying what
  it reviews.
- Pass at launch `review`: what the reviewers are to review, in any form that names it, such as a
  sentence, or a list of repositories with the commits the change starts and ends at. Every
  reviewer receives it as you wrote it.
- Pass no `base`, no `specPath` and no `transcripts` at launch. The script stops on any of them,
  because a review pass reads only its request.

## What runs and what returns

- The thirteen reviewers read what `review` names in parallel, each with its template. The
  correctness reviewer, the duplicate checker and the rule reader are told that the change has no
  spec, and every other reviewer receives the prompt it receives in a main run's review stage. No
  implementer ran, so no reviewer receives an implementer's object or its artifacts.
- Read every finding in the result's `remaining` as a `review-finding` item under its source ID
  `<reviewer>:<index>`. It keeps the severity its reviewer gave it, except that a finding with a
  kind is CRITICAL.
- Read every narrowing limitation and unchecked coverage entry of a reviewer there as a
  `review-limitation` item labelled with its reviewer.
- Expect the findings and limitations of every reviewer that returned also when another reviewer
  failed. No reviewer of a review pass carries a hard flag, because each flag needs a spec.
- Expect `exit` `follow-up` when a finding is must-fix or CRITICAL and `clean` otherwise.
- Expect a blocking limitation of any reviewer to end the run with `root-resolution`, and a failed
  reviewer to end it with `failed`.

## After the run

- Read no finding to judge, sort or decide it. Start a follow-up run on what the review pass
  returned to be fixed, as the section of `workflow-skills:implement-review-verify` on remaining
  items says. The review pass checked no spec, so the follow-up's implementer resolves every finding
  with the rules and the plugin's skills, and returns unresolved, with the problem stated, only what
  neither resolves.
- Pass the follow-up run the commit each repository is at as its `base`. A review pass returns no
  snapshots, because it reads only its request.
- Show the user each problem the follow-up run returns unresolved, as its implementer wrote it.
- Record what remains in the todo record that `workflow-skills:todo-md` defines.
