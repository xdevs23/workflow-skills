# The stages work from the quoted discussion

A unit spec of implement-review-verify holds the discussion of its unit, quoted verbatim from the
session transcripts, and nothing else. The design record on unit specs describes the spec file and
what the spec tool checks, and the one on fix-only follow-up runs describes the fix list. This
record describes what the stages of a run receive from such a spec and how their findings name
what backs them. The rules for assembling the spec live in the section of the workflow skill on
the unit spec.

## What the stages receive

The shared authority block of the main script ranks the user entries of the spec above the prompt,
which is untrusted. It states that the spec is the discussion of its unit, quoted verbatim, that an
entry of author `assistant` is context and never authority, and that a contradiction with what the
user answered yes to is a contradiction with the user's own words. The first hard-flag trigger,
`directive-conflict`, is the prompt directly contradicting a user entry or what the user answered
yes to. A removal of code that only an assistant entry names is no prompt-versus-spec conflict, and
code that an applicable project rule asks for is not code nobody asked for, so the removal rule
does not reach it. The `no-words` trigger of the writing stages fires on a spec that was not
supplied, cannot be read, or holds no entry of author `user`.

The marked block of the main script holds values and no prose. It has no private record path, no
criteria count, no implementer prompt, no scoping and no invariants, so no word of the
orchestrating session reaches a stage. The implementer's task is the closing line of its prompt:
implement what the following discussion arrived at, followed by the spec path. The cold
alternatives reviewer receives the hygiene floor and the diff, like the quality reviewer.

A decision the orchestrating session takes itself, such as a choice that is neither a product nor
an architecture decision, is stated in the chat, where the user sees it, and the message that
states it enters the spec as an assistant entry. The stages read it as context beside the user's
words around it.

## Findings point at their evidence

Correctness, spec compliance and the duplicate checker read the spec and return findings only, with
no verdicts. Each finding says in `claim` what the implementation gets wrong and names in
`evidence` where its backing stands, never as a bare quote. For the user's words an evidence entry
has kind `transcript`, the session file and line of the spec entry, and in `key` the key path of
the quoted part inside that JSON record, one key name per element. Where no words of the user back
the finding, it has kind `rule`, the file and line of a global, plugin or project rule, and an
empty key path. Whoever receives the finding reads the record or rule and the records around it, so
a bare yes is read together with what it answered. The script retries and then fails a reviewer
whose finding has no evidence, an evidence entry without a file, or a transcript entry without a
key path. The other reviewers keep their schemas.

The implementer's spec findings quote the words of the spec entries they concern in `words`. The
classes are `joint-impossibility`, two statements of the user that cannot both hold,
`missing-contract`, `reality-drift`, and `unbacked-entry`, an entry whose words were said about
another unit. An `unbacked-entry` finding does not block the run and is handed to the root as
CRITICAL. The finding verifier closes an `unbacked-choice` finding with a rejection only on a
citation of the form `spec entry <file>:<line>: "<quote>"`, which names the entry by its session
record.

## Agent templates

The spec-provenance template is removed, since a spec of quotations leaves it nothing to check: the
spec tool verifies every quotation against its record. The fixtures of the spec tool's tests live
under a directory named after the spec.

## Visual work

The visual-verification skill writes nothing into the spec for visual work. The implementer takes
the before captures before its first edit, every writer returns the comparison with both capture
names in its checks, and a stage without the implementer's object finds the captures by the
commits their receipts record. The scratch directory of the runtime and the rendering engine lives
in the system temporary directory, one private directory per run, and the launcher removes it when
the run ends.

## Alternatives the user rejected

- Acceptance criteria with a verdict per criterion were rejected in favour of findings that name
  what is wrong with the implementation and what backs it.
- A bare quote of the user's words as a finding's backing was rejected, since a short answer such
  as a yes carries no meaning without the record it answers.
- Keeping the browser's scratch directory in the project cache behind a short mounted path was
  rejected for the system temporary directory, cleaned up after the run.
