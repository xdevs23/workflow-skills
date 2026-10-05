# The review stage alone

The review pass is a skill of its own, `workflow-skills:review-pass`, for a change that is already
committed and needs the reviewers of implement-review-verify without the rest of a run. A full run
builds the change, reviews it, verifies the findings and fixes them; for a change made directly,
such as a text edit, the implementer stage has nothing to do, and the verifier and fixer cost more
than judging the findings directly.

## What the pass runs

The pass is a run of the main script of implement-review-verify with `reviewOnly` set to true in its
marked block. Such a run takes one launch value, `review`, which names what to review in any form
the session that starts it chooses, takes no base list, no spec and no transcript directory, and
starts only the thirteen reviewers that need no spec, each with the request as the session wrote it.
The spec-compliance and inverse-spec reviewers judge a change against its spec, so they do not run,
and their two model entries stay out of the marked block. The correctness reviewer, the duplicate
checker and the rule reader, which read the spec in a main run, are told that the change has none:
they judge it by the code and the rule sources, and their objects carry no evidence, no abort and no
unbacked-choice kind. Every other reviewer receives the prompt of a main run's review stage. No
implementer ran, so no reviewer receives an implementer's object or artifacts.

The run returns the record of a main run. No finding verifier reads the reviewers' objects, so every
finding goes to `remaining` as a `review-finding` item under its source ID, and every narrowing
limitation and unchecked coverage entry as a `review-limitation` item labelled with its reviewer. A
finding keeps its reviewer's severity, except that a finding with a kind is CRITICAL, as the
verifier holds it in a main run. The findings and limitations of every reviewer that returned reach
`remaining` also when another reviewer failed. No reviewer of the pass carries a hard flag, because
each trigger needs a spec. The run ends `follow-up` when a finding is must-fix or CRITICAL and
`clean` otherwise. A blocking limitation of any reviewer ends it with `root-resolution`, which in a
main run only the verifier would weigh, and a failed reviewer ends it as in a main run. The
findings go unread to a fix run, whose fix list names no spec.

## Decisions and their reasons

The review mode is one boolean of the main script, so the pass runs the review stage itself and a
change to that stage reaches the pass with no second edit.

The pass takes no spec. It exists for changes made directly, which have no discussion quoted into a
spec, so a pass that demanded one asked for something the change never had. The fix run that
follows it reads no spec either, and its fixer and diff check are not offered the two triggers that
need one.

The pass takes a request in any form. It reviews changes the session made by hand, and that session
knows what it changed: one commit range, several repositories, or anything else it wants reviewed.
A main run keeps its base list, because its stages start from those commits.

## Alternatives the user rejected

- A script of its own that copies the main script's review stage and is held to its text by a test
  was rejected in favour of the mode of the main script, switched by one boolean.
- A spec for the pass, checked by one of its reviewers in place of the removed launch check, was
  rejected: a review pass reviews a change made without a spec.
- A fixed launch shape of one base and one head commit per repository was rejected in favour of a
  request the session writes in whatever form fits what it wants reviewed.
