# The follow-up run

A main run of implement-review-verify, or a review pass, returns in its `toFix` list everything it
left to be fixed: the implementer's spec findings, the finding verifier's open decisions and
issues, the roaster's findings and a failed proof. One follow-up run takes that list, resolves what
it can, and leaves the rest to be recorded. No run follows a follow-up run, so the work on a unit
ends after two runs, or after a new main run that carries an answer of the user.

## What a follow-up run runs

A follow-up run is the main script with `mode` set to `follow-up` in its marked block. It runs three
of the four phases of a main run: the implementer, the reviewers and the finding verifier. It
starts no fixer and no roaster.

- The implementer receives the items of the parent run's `toFix` list as its entries, each as that
  run returned it, and the spec the parent run checked as the authority. It answers every entry once,
  keyed by its source: `fixed` with a reason, `rejected` with the counterevidence as its reason, or
  `unresolved` with a problem statement in place of a reason. As the run's last writer it runs the
  full check command after its last write.
- The reviewers read the follow-up's diff, from the parent run's final snapshots to the
  implementer's. The correctness reviewer, the duplicate checker and the inverse-spec reviewer
  receive the entries beside the implementer's object, so they can judge each change against the
  entry it carries out, and so does the finding verifier.
- The finding verifier consolidates the findings as in a main run. No fixer follows it, so each
  correction it approves returns unfixed, at its severity, with every other item it leaves.

A follow-up run returns no `toFix` list. Everything it leaves in `remaining` is recorded in the todo
record for later work.

## The parent run's result travels unchanged

The session passes the parent run's result to the follow-up run as `args.parent`: its `spec`,
`toFix`, `artifacts` and `snapshots` fields, copied from the run's output file unchanged. The script
checks the shape of each field, refuses a source of an unknown kind or one named twice, and refuses a
base list other than the parent's final snapshots. The implementer's spec check names the `sha256`
in `args.parent.spec`, and the spec tool fails before the implementer's first edit when the spec
changed since the parent run checked it.

A review pass checks no spec and returns no snapshots. Its follow-up run starts from the commit each
repository is at, runs the reviewers that need no spec, and gives its implementer and its verifier an
authority block without a spec, in which the rule sources and the plugin's skills decide. Its
implementer runs the spec tool's check of the base list alone, which checks the list against the
tree and prints it with the proof of the list and the tree.

A size breach the session measured after the parent run joins the entries as `args.size`, after what
the parent run returned, beside the spec lines the parent run's spec check counted.

## Problems in place of questions

No stage asks the user a question. A writer that cannot resolve a correction or an entry answers it
`unresolved` and states the problem as it is, without interpreting it: what the problem is, why it is
a problem, and why nothing the user's words, the rules and the skills say solves it. The script holds
such an answer to those three parts and to no reason, and holds a fix or a rejection to a reason and
no problem. An unresolved decision of the finding verifier carries the same problem statement with
its evidence, receipts and source IDs. A correction is required only for an approved fix; an
unresolved claim or verified work outside the repair scope needs no invented next action.

A problem the main run's fixer leaves unresolved travels to the follow-up run with the decision it
answers. An entry the follow-up's implementer leaves unresolved returns as an `unresolved-entry`
item, and the session shows its problem statement to the user as written, with no option, no
question and no recommendation. The user's answer goes into a copy of the spec for a new main run,
which starts after the follow-up run ended, from its final snapshots, so two runs never write to one
tree at once.

## Decisions

- A follow-up run is a mode of the main script. The main script already holds the implementer, the
  fifteen reviewers and the finding verifier, so the mode changes the implementer's task and leaves
  out the Fix phase.
- A rejection and a fix with a commit behind it close an entry once the finding verifier has read
  the follow-up's change. The follow-up's own review is the check of its fixes, so they return no
  unattested fix. A run that ends before its verifier returns closes no entry and records the
  findings of the reviewers that returned.
- A general instruction to fix findings authorizes no particular fix, because the user may not agree
  with a finding. The implementer judges every entry as a claim, by the user's words, the rules and
  the plugin's skills.
- Design documents remain the writer's choice. An order in every writer's prompt and template made
  every unit get a document, including units that did not need one.

## Rejected alternatives

**rejected-fix-run-chain**: A fix run after every run, a fix run included, with a fixer and a
roaster on the list and a diff check after them, was rejected. Every fix run's roaster found
something new in the code that run wrote, so each fix run started the next, an entry no fixer could
resolve was carried into every next list, and a new main run with the user's answer had no stated
place in the chain.

**rejected-fix-list**: A fix list file, written by the spec tool from the parent run's saved result
and checked against it before the fixer's first edit, was rejected. The session passes the parent
run's structured result to the follow-up run itself, unchanged.

**rejected-questions**: A question from a stage to the user, with the answers it offers, was
rejected. A stage states the problem, and only a problem the follow-up run cannot resolve reaches the
user, as it was stated.
