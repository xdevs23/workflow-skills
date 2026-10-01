# What the implementer leaves unbuilt

The implementer of implement-review-verify reads the spec against the code before its first edit and
returns what it finds in `specFindings`. An entry of that list points at every spec entry it
concerns. An entry of class `joint-impossibility` or `missing-contract` blocks the run before
anything is built, and the run ends after the implement stage with the finding for the root. An
entry of class `unbacked-entry` leaves unbuilt what its words ask for, together with everything that
needs it, and the run builds the rest of the spec. The finding verifier never approves a fix that
builds what was left unbuilt and hands such a finding to the root as an open decision.

## The entry points at all its spec entries

An entry of `specFindings` carries `evidence`, a list of one or more pointers to spec entries,
together with the `class`, the `claim` and `receipts`. Each pointer has kind `transcript`, the
session file and line of the spec entry, and the key path of the quoted part inside that JSON
record, the shape the three concern seats use. The main script's schema for the implementer requires
`evidence` with at least one pointer and allows no other field, and its completeness check refuses a
transcript pointer without a key path and a rule pointer with one. A `joint-impossibility` entry
points at each statement of the conflict, because two statements of the user that cannot both hold
are one finding about both.

The main script adds every entry to `remaining` as a `spec-finding` item after the pass, whatever
its ending, and the entry travels there as the implementer returned it, `evidence` included. An
`unbacked-entry` entry is CRITICAL, and every other class is must-fix.

## An impossible or undefined demand blocks the run

An entry of class `joint-impossibility` or `missing-contract` blocks the run. The implementer finds
it in its sense check before its first edit and returns it in `specFindings` together with a
limitation of effect `blocks` that names the entry. It edits and commits nothing, the design
document included, so the snapshot of every repository is its start SHA. A spec with such an entry
has nothing built, whatever other entries it has.

The main script checks the implementer's object as it checks every writer object: an unchanged
snapshot lists no commits and no files. It then records each blocking limitation of the implementer
as a `blocking-limitation` item labelled `impl` and ends the run with exit `root-resolution`, so no
review, verify, fix or roast stage starts. After the pass the entry reaches `remaining` as a
`spec-finding` item behind the `blocking-limitation` item, and the root reads both.

## Words said about another unit stay unbuilt with what needs them

An entry of class `unbacked-entry` does not block. Its words were said about another unit, so the
implementer builds nothing they ask for and builds the rest of the spec. What cannot be built
without them rests on the same words, so the entry points at it in `evidence` too and it stays
unbuilt. What the words of a `reality-drift` entry ask for is built.

The implementer's template states both rules in its sense check, and implement-review-verify states
them in phase 1, where it describes the sense check's findings.

## What the finding verifier decides

The spec-compliance reviewer never receives the implementer's object, so it reports what the
implementer left unbuilt as missing required behaviour. The finding verifier receives the
implementer's object and its `specFindings`. Because a `joint-impossibility` or `missing-contract`
entry ends the run before any review, what is left unbuilt in a run that reaches the verifier is
what the words of an `unbacked-entry` entry ask for, together with what depends on it. A source
finding that asks to build, complete or change any of it is never `approve-fix`: the verifier
decides it `needs-decision` and names the entry by its class and evidence in `authority`. Like every
`needs-decision` decision, it carries no correction, so `correction` stays empty. The main script
turns every `needs-decision` into an `open-decision` item of `remaining`, so the finding reaches the
root after the run. Phase 3 of implement-review-verify states the same rule where it lists the
verifier's decisions.

The implementer's completeness check makes sure a blocking entry comes with its limitation: a
result that carries a `joint-impossibility` or `missing-contract` entry without a limitation of
effect `blocks`, or with a repository whose snapshot moved, is refused and retried with the reason
named, so an implementer that forgets the limitation can never send the run on to review.

## Decisions and their reasons

The entry carries a list because a `joint-impossibility` concerns two statements, and an entry with
one pointer could name only one of them. The entry points at its spec entries instead of quoting
them because a bare quote, such as a yes, says nothing until the record it answers is read.

A `joint-impossibility` or `missing-contract` entry blocks, because law 13 of
implement-review-verify has work that genuinely cannot satisfy the applicable requirements report
the concrete impossibility and block. Building the rest of the spec around such an entry would build
one half of two statements that cannot both hold, or build around an artifact whose contract nobody
defined, and the proof would then read as complete. The block uses the implementer's existing
blocking limitation, whose path through the script already ends the run with exit `root-resolution`
and hands the root the limitation and the finding.

An `unbacked-entry` entry does not block, because it says only that its words were said about
another unit. The rest of the spec can still be built from the words about this unit. What needs
those words cannot be built without them, so it rests on the same words and stays unbuilt with
them.

The rule sits with the finding verifier because it is the one stage that sees both the review
findings and the implementer's object. Without it, the spec-compliance reviewer reports what was
left unbuilt as missing, the verifier approves the fix, and the fixer builds what the sense check
left unbuilt before the root reads the finding.

## Tests

The routing tests check that the implementer schema's `specFindings` entry requires `evidence` in
the shape of the concern seats, and that a pointer breaking its rules is refused. They check that an
implementer returning a `joint-impossibility` or a `missing-contract` entry with a blocking
limitation and an unmoved snapshot ends the run after the implement stage with exit
`root-resolution`, a `blocking-limitation` item and a `spec-finding` item, and that no review stage
starts. They check that an `unbacked-entry` entry and a `reality-drift` entry each reach `remaining`
as a `spec-finding` item of its severity while every stage runs, and that the implementer's
template, the finding verifier's template and implement-review-verify state these rules.
