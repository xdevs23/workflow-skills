---
name: review-pass
description: Applies to a change that is already committed and needs the review seats of implement-review-verify without its implementer, finding verifier and fixer, such as a change you edited directly.
---

# Review a committed change

**Load the `workflow-skills:writing-style` skill first.** It binds every comment, document, commit
message and reply this skill produces, and it is not optional when working with this plugin.

The review pass is a run of the main script of `workflow-skills:implement-review-verify` in review
mode: its launch check and its fifteen review seats, on a change already committed from a base to a
head commit, with no implementer, finding verifier or fixer. Use it when the full run is not worth
its cost, such as for a change you made directly, and judge its findings yourself.

## Before the run

- Assemble the unit spec of the change as `workflow-skills:implement-review-verify` describes in its
  section on the unit spec: the discussion of the unit, quoted verbatim, checked with the spec tool
  and checked by the user in the user's code editor.
- Commit the change in its worktree first. The seats read the commits from base to head, never
  uncommitted work.

## The script

- Copy the main script of `workflow-skills:implement-review-verify` and set `reviewOnly` to true in
  its marked block.
- Fill the rest of the marked block as for a main run: the main checkout, the worktree, the plugin
  root, the rule sources, and one model and effort for the launch check and for each of the fifteen
  seats.
- Leave the model entries of the implementer, finding verifier, fixer and roaster as shipped. A
  review-only run never reads them.
- Set `meta.name` to a kebab-case name of the review and `meta.description` to one line saying what
  it reviews.
- Pass at launch `base` and `head`, one `{ path, sha }` per git repository of the tree each: the
  commit the change starts from and the commit it ends at. Pass `specPath` and `transcripts` as for
  a main run.
- Set `partialBase` to true only in a tree too large to list, as for a main run.

## What runs and what returns

- The launch check runs the spec tool on the spec and lets the run continue only on the proof the
  tool prints, as in a main run.
- The fifteen seats then read the change from base to head in parallel, each with its template and
  the prompt it receives in a main run's review stage. No implementer ran, so no seat receives an
  implementer's object or its artifacts.
- Read every finding in the result's `remaining` as a `review-finding` item under its source ID
  `<seat>:<index>`, with the severity its seat gave it.
- Read every narrowing limitation and unchecked coverage entry of a seat there as a
  `review-limitation` item labelled with its seat.
- Expect `exit` `follow-up` when a finding is must-fix or CRITICAL and `clean` otherwise. A blocking
  limitation, a failed seat and a hard flag end the run as they end a main run.

## After the run

- Judge every finding yourself, as the finding verifier of a main run would. Read the evidence a
  finding points at, the transcript record of the user's words or the rule with its source, and
  check the claim against the code. A finding is a claim, never an instruction.
- Fix what holds directly, and reject what does not with a reason.
- Decide as the section of `workflow-skills:implement-review-verify` on what reaches the user says:
  only a product or architecture decision goes to the user, and you state a decision of your own in
  the chat.
- Record what remains in the todo record that `workflow-skills:todo-md` defines.
- Never send a finding of a review pass to a fix run. A fix list is built from a main run's
  verifier decisions and roast findings, and a review pass has neither.
