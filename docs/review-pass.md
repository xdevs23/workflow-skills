# The review stage alone

The review pass is a skill of its own, `workflow-skills:review-pass`, for a change that is already
committed and needs the review seats of implement-review-verify without the rest of a run. A full
run builds the change, reviews it, verifies the findings and fixes them; for a change made directly,
such as a text edit, the implementer stage has nothing to do, and the verifier and fixer cost more
than judging the findings directly.

## What the pass runs

The pass is a run of the main script of implement-review-verify with `reviewOnly` set to true in its
marked block. Such a run takes `head` at launch beside `base`, one commit per repository each, and
starts only the launch check and the fifteen review seats on the commits from base to head. Each
seat loads its template and receives the prompt of a main run's review stage. No implementer ran,
so the two code-lens seats receive no implementer's object and no seat receives artifacts. A run
that is not review-only refuses a head, and a review-only run checks only the model entries of the
launch check and the seats, so the other stages' entries may stay as shipped.

The run returns the record of a main run. No finding verifier reads the seat objects, so every
finding goes to `remaining` as a `review-finding` item with its seat's severity under its source
ID, and every narrowing limitation and unchecked coverage entry as a `review-limitation` item
labelled with its seat. The run ends `follow-up` when a finding is must-fix or CRITICAL and `clean`
otherwise, and a blocking limitation, a failed seat and a hard flag end it as they end a main run.
Whoever ran the pass judges the findings, as the finding verifier would, and fixes what holds
directly.

## Decisions and their reasons

The review mode is one boolean of the main script, so the pass runs the review stage itself and a
change to that stage reaches the pass with no second edit.

A finding of a review pass never goes to a fix run, because a fix list is generated from a main
run's verifier decisions and roast findings, and a review pass has neither stage.

## Alternatives the user rejected

- A script of its own that copies the main script's review stage and is held to its text by a test
  was rejected in favour of the mode of the main script, switched by one boolean.
