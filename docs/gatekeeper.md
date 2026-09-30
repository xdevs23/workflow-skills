# Only product and architecture decisions reach the user

The implement-review-verify skill puts the root between a workflow run and the user, and the root
lets two kinds of decision through to the user. A product decision is about what the user sees
and does, what data is kept or lost, the product's scope, and anything public or external. An
architecture decision is about where code lives, the shape of the system, the data model and the
contracts between components. The root decides every other item a run leaves open itself, whether
a stage or a remaining item calls that item unsettled, open or undecided.

## The root's own decisions

The skill's section "What reaches the user" sits between the remaining-items rules and the
question-premise check.

- The root fixes a correction that improves code quality without changing anything the spec
  specifies. Such a correction needs no words of the user and no question.
- The root removes behavior nobody approved as an unauthorized addition and never offers it to the
  user as a choice.
- The root removes code, a parameter or a mechanism that nothing uses, that nobody asked for, or
  that is built beyond what was asked, without asking the user. A hand-written design document that
  describes such code, including one written from the root's own spec, is no reason to keep it.
- When a stage recommends a correction and the root's own check against the tree and the recorded
  words finds it correct, the root makes the fix and never presents it as an option beside an
  alternative.
- A `new-choice` item the fix run's scope check refused, and an open `unbacked-choice` decision,
  that is neither a product nor an architecture decision goes to a new implement-review-verify unit
  with its own spec, and the root decides the choice in that spec. It never goes to the user. The
  authority for that choice is the user's recorded delegation of this kind of choice, which the
  skill's rule carries. The new spec cites that rule as a `rule` item, the new unit's private
  record holds the user's approval of the rule with its context, and the choice is an ordinary
  derivation from the rule item and the rules and observations that settle it. Writing the spec
  supplies no authority, and the checks for an unbacked item and for a record without the user's
  words apply unchanged. The delegation covers only choices that are neither product nor
  architecture decisions.
- When stages or models split on a choice that is neither a product nor an architecture decision
  while agreeing on the facts, the root applies the rules to those facts and decides. The split
  alone is never a reason to ask the user, and a product or architecture decision reaches the user
  whether or not the stages split on it.

## Passages that send an item to the user

Several passages of the skill sent a genuinely unsettled or open choice to the user without saying
what kind of choice it was. Each now names product and architecture decisions as the only ones that
go to the user, and has the root decide any other:

- the rule on a sense-check flag, where the root first checks the coder's evidence against the spec
  and the user's recorded words, chooses a continuation those words already decide without a new
  question, sends only a product or architecture decision they leave unresolved to the user, and
  lets the flagged mechanism continue on no other authority;
- the rule that a reviewer suggests and never decides, where only a product or architecture
  decision that removing the unapproved behavior cannot close reaches the user;
- the explicit resolution the root owes every inverse-spec decision, in the verification phase and
  in law 13;
- the list of recorded items that start a new run, where an open decision starts one once it is
  decided, by the user for a product or architecture decision and by the root for any other;
- the question-premise check, in the rule on choices the record already settles, the treatment of
  `inverseSpecDecisions`, the rule that a question is evidence of drift, and the screen of the rule
  that the root is the judge;
- the authoring note on the exceptions the root relays after a run.

## The deleted relay rules

Two rules that sent items to the user are deleted. The question-premise check used to put every
open `unbacked-choice` decision to the user as a question and called it the one kind of item the
judge's screen never closes. The description of the fix run used to send a finding that needs a
decision, an open decision and anything the scope check refused to the user and then to a full
unit with a spec.

The check that followed the first rule stays as its own bullet. The root accepts a verifier's
rejection of an `unbacked-choice` finding only after reading the cited record entry and checking
that the quoted words, read in their surrounding context, back the choice. A quote that does not
match its context leaves the choice open, and the root handles it as every other open
`unbacked-choice` decision under "What reaches the user".

## The form of a question

A product or architecture decision that does reach the user is asked after the root has checked
the user's recorded words, as the question-premise check describes. The question is in the root's
own wording and describes the choice by what the user will see. No option is labelled as
recommended. An option the user's recorded words or the rules already settle is a decision the
root takes itself, and a choice they leave open is the user's, put without the root's preference.
No option keeps a found defect as it is or leaves the decision for later. The rule sits in
the question-premise check beside the existing rules on the shape of an ask.

## Decisions and their reasons

- The root decides a clear answer itself. A question with a recommended answer the root already
  knows to be correct only adds a delay and hands the user a choice the rules already settle.
- An unused, unasked-for or overbuilt mechanism is removed on the facts alone. A hand-written
  design document never counts as the design, as the spec-writing skill states, so a document that
  describes the mechanism does not argue for keeping it.
- A split between stages that agree on the facts is a disagreement about how the rules apply, and
  applying the rules is the root's job, except where the choice is a product or architecture
  decision, which stays the user's.
- A sense-check flag whose continuation the user's recorded words already decide needs no new
  question, because those words are already the user's decision. The flagged mechanism still never
  continues on a stage's argument alone.
- A spec gains no decision authority by being written, so a choice the root makes in a new unit's
  spec traces to the user's recorded delegation of that kind of choice.
- The stages keep their outputs. The finding verifier still returns a needs-decision decision and
  the fix run's scope check still returns a `new-choice` item to the root. This change decides only
  where the root sends them afterwards.

## Tests

The workflow routing suite checks that the skill names the two kinds of decision, that each passage
sending an item to the user names them in its own section or item, that each of the root's own
decisions is a bullet of "What reaches the user" opening with its instruction, that the
question-premise check carries the form of a question, and that the wording of both deleted rules
and of the unconditional sense-check rule is absent from the skill. A restriction moved out of its
passage fails that passage's check even where its words still stand elsewhere in the skill. The
suite finds headings, sections, list items and numbered laws in the blocks that Bun's Markdown
parser returns, and never in the raw text.
