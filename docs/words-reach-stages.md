# The user's words reach every stage that could contradict them

The user's words overrule everything else, and a contradiction with them hard-flags. The recurring
failure this record answers is that the user says one thing and the reviewers do not catch it. Two
rules keep the user's words in front of every stage that could contradict them: only a message the
user actually wrote counts as the user's words, and a choice that no words of the user back is a
finding of its own kind.

## Only the user's own messages count

The spec tool accepts a user entry of the spec only when the record it cites is a message the user
wrote, typed or queued, or an answer the user gave in the question dialog. A task notification, an
injected meta record, command output and the result of any other tool never count as the user's
words, even where the transcript stores them as records of type user. A plan the user answered yes
to reaches the stages as the assistant entry that holds it, beside the user's yes.

## A choice without the user's words is a finding

A finding of kind `unbacked-choice` joins `band-aid` and `longer-route`, for a choice in the spec,
the prompt or the diff that no words of the user back. The briefed review stages of the main script
may emit it, and the inverse-spec reviewer's missing-decision findings carry it. The unbriefed
stages' schemas do not carry it, because the kind's name would brief them.

A decision on such a finding is CRITICAL, and three actions answer it. `needs-decision` states that
no recorded words back the choice and reaches the root in the run's remaining items as an open
decision. `reject` closes the finding only on a user entry whose words, said about this unit, back
the choice: its authority names the entry by its session file and line and quotes the backing
words together with their surrounding context, and its reason says how that context supports the
choice. `approve-fix` answers it only for a removal on the removal rule. The script's decision
checks refuse `record`, `cleanup` and `root-action`, an `approve-fix` that is no removal, and a
rejection without the spec entry citation.

A line found by searching for a word and quoted without its context backs nothing, so a rejection
stands only on the cited entry read in its context. An open `unbacked-choice` decision goes to the
run's fix run, whose fixer settles it by the user's words and the rules, or returns it to the user
as a question when it is a product decision that neither settles.

## Rejected alternatives

- Sending every choice without the user's words to the user as a question was rejected, since the
  user's words often already back the choice once they are read in their context.
