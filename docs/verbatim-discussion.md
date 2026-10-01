# The stages work from the quoted discussion

A unit spec of implement-review-verify holds the discussion of its unit, quoted verbatim from the
session transcripts, and nothing else. The design record on unit specs describes the spec file and
what the spec tool checks, and the one on fix-only follow-up runs describes the fix list. This
record describes what the stages of a run receive from such a spec. The spec-writing skill is
deleted, and the rules for assembling the spec live in the section of the workflow skill on the
unit spec. The reviewers that judged the change per acceptance criterion now flag what is wrong by
quoting the user's words.

## What the stages receive

The shared authority block of both scripts ranks the user entries of the spec above the prompt,
which is untrusted. It states that the spec is the discussion of its unit, quoted verbatim, that an
entry of author `assistant` is context and never authority, and that a contradiction with what the
user answered yes to is a contradiction with the user's own words. The first hard-flag trigger,
`directive-conflict`, is the prompt directly contradicting a user entry or what the user answered
yes to. A removal of code that only an assistant entry names is no prompt-versus-spec conflict. The
`no-words` trigger of the writing stages fires on a spec that was not supplied, cannot be read, or
holds no entry of author `user`.

The marked block of the main script holds values and no prose. The private record path, the
criteria count, the implementer prompt, the scoping and the invariants are gone from it, so no word
of the orchestrating session reaches a stage. The implementer's task is the closing line of its
prompt: implement what the following discussion arrived at, followed by the spec path. The cold
alternatives reviewer receives the hygiene floor and the diff, like the quality reviewer.

Correctness, spec compliance and the duplicate checker read the spec and return findings only, with
no verdicts. Each finding carries `words`, the user's words of the entry it is judged against, and
says in `claim` what the implementation gets wrong; the script retries and then fails a reviewer
whose finding leaves `words` empty. The other reviewers keep their schemas.

The implementer's spec findings quote the words of the spec entries they concern in `words`. The
classes are `joint-impossibility`, two statements of the user that cannot both hold,
`missing-contract`, `reality-drift`, and `unbacked-entry`, an entry whose words were said about
another unit. An `unbacked-entry` finding does not block the run and is handed to the root as
CRITICAL, as the class it replaces was. The finding verifier closes an `unbacked-choice` finding
with a rejection only on a citation of the form `spec entry <file>:<line>: "<quote>"`, which names
the entry by its session record.

## Alternatives the user rejected

- Acceptance criteria with a verdict per criterion were rejected in favour of findings that quote
  the user's words.

## Open

- OPEN: the section of the visual-verification skill on implement-review-verify still has the root
  name the expected outcome in a criterion, write the before capture's name and a short scratch path
  into the unit spec, and state a visual defect's correction in a fix-list entry. None of these
  values has a place in a spec of quotes or a fix list of source IDs.
- OPEN: the rule that sends an open choice which is neither a product nor an architecture decision
  to a new unit no longer names how the choice the orchestrating session decides reaches that unit,
  since a spec holds only quotes.
- OPEN: the spec-provenance template still describes spec items and the private directive record.
  No script starts it, and removing an agent template needs a decision of its own.
- OPEN: older design records in this directory describe the spec of items, the private record and
  the per-criterion verdicts that this change replaces.
