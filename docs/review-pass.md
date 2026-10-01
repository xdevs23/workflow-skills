# The review stage alone

The review pass is a skill of its own, `workflow-skills:review-pass`, for a change that is already
committed and needs the reviewers of implement-review-verify without the rest of a run. A full run
builds the change, reviews it, verifies the findings and fixes them; for a change made directly,
such as a text edit, the implementer stage has nothing to do, and the verifier and fixer cost more
than judging the findings directly.

## What the pass runs

The pass is a run of the main script of implement-review-verify with `reviewOnly` set to true in its
marked block. Such a run takes `head` at launch beside `base`, one commit per repository each, and
starts only the launch check and the fifteen reviewers on the commits from base to head. Each
reviewer loads its template and receives the prompt of a main run's review stage. No implementer
ran, so the two code-lens reviewers receive no implementer's object and no reviewer receives
artifacts. The marked block is filled as for a main run, every model entry included.

The run returns the record of a main run. No finding verifier reads the reviewers' objects, so every
finding goes to `remaining` as a `review-finding` item under its source ID, and every narrowing
limitation and unchecked coverage entry as a `review-limitation` item labelled with its reviewer. A
finding keeps its reviewer's severity, except that a finding with a kind and every finding of the
inverse-spec reviewer are CRITICAL, as the verifier holds them in a main run. The findings and
limitations of every reviewer that returned reach `remaining` also when another reviewer failed or
set its hard flag. The run ends `follow-up` when a finding is must-fix or CRITICAL and `clean`
otherwise. A blocking limitation of any reviewer ends it with `root-resolution`, which in a main run
only the verifier would weigh, and a failed reviewer or a hard flag ends it as in a main run.
Whoever ran the pass judges the findings, as the finding verifier would.

## Decisions and their reasons

The review mode is one boolean of the main script, so the pass runs the review stage itself and a
change to that stage reaches the pass with no second edit.

## Alternatives the user rejected

- A script of its own that copies the main script's review stage and is held to its text by a test
  was rejected in favour of the mode of the main script, switched by one boolean.
