# Items the implementer leaves unbuilt

The implementer of implement-review-verify reads the spec against the code before its first edit
and returns what it finds in `specFindings`. An entry of that list names every spec item it
concerns in a list. An entry of class `joint-impossibility` or `missing-contract` blocks the run
before anything is built, and the run ends after the implement stage with the finding for the
root. An entry of class `unbacked-item` leaves its items unbuilt, together with every item that
needs one of them, and the run builds the rest of the spec. The finding verifier never approves a
fix that builds an item left unbuilt and hands such a finding to the root as an open decision.

## The entry names all its items

An entry of `specFindings` carries `items`, a list of one or more spec item ids, together with the
`class`, the `claim` and `receipts`. The main script's schema for the implementer requires `items`
as an array of strings with at least one entry and allows no other field. A `joint-impossibility`
entry names each item of the conflict, because two requirements that cannot both hold are one
finding about two items.

The main script adds every entry to `remaining` as a `spec-finding` item after the pass, whatever
its ending, and the entry travels there as the implementer returned it, `items` included. An
`unbacked-item` entry is CRITICAL, and every other class is must-fix.

## An impossible or undefined item blocks the run

An entry of class `joint-impossibility` or `missing-contract` blocks the run. The implementer finds
it in its sense check before its first edit and returns it in `specFindings` together with a
limitation of effect `blocks` that names the entry. It edits and commits nothing, the design
document included, so the snapshot of every repository is its start SHA. A spec with such an entry
has nothing built, whatever other entries it has.

The main script needs no new code for this. It checks the implementer's object as it checks every
writer object: an unchanged snapshot lists no commits and no files. It then records each blocking
limitation of the implementer as a `blocking-limitation` item labelled `impl` and ends the run with
exit `root-resolution`, so no review, verify, fix or roast stage starts. After the pass the entry
reaches `remaining` as a `spec-finding` item behind the `blocking-limitation` item, and the root
reads both.

## An unbacked item stays unbuilt with the items that need it

An entry of class `unbacked-item` does not block. The implementer builds nothing for the items it
names and builds the rest of the spec. An item that cannot be built without one of those items
rests on the same missing words, so the entry names it in `items` too and it stays unbuilt. An item
named only in a `reality-drift` entry is built.

The implementer's template states both rules in its sense check, and implement-review-verify states
them in phase 1, where it describes the sense check's findings.

## What the finding verifier decides

The spec-compliance reviewer never receives the implementer's object, so it reports an item the
implementer left unbuilt as missing required behaviour, which is must-fix. The finding verifier
receives the implementer's object and its `specFindings`. Because a `joint-impossibility` or
`missing-contract` entry ends the run before any review, the only items left unbuilt in a run that
reaches the verifier are the items of `unbacked-item` entries, which name the items that depend on
them as well. The verifier's template names those items. A source finding that asks to build,
complete or change one of them is never `approve-fix`: the verifier decides it `needs-decision`,
names the entry by its class and items in `authority`, and states the open question in
`correction`. The main script turns every `needs-decision` into an `open-decision` item of
`remaining`, so the finding reaches the root after the run. Phase 3 of implement-review-verify
states the same rule where it lists the verifier's decisions.

## What stays as it was

The main script's handling of spec findings and of blocking limitations is unchanged. Its comment
beside the handoff of spec findings says that a `joint-impossibility` or `missing-contract` entry
comes with a blocking limitation that has already ended the run, and the implementer's completeness
check makes sure of it: a result that carries such an entry without a limitation of effect
`blocks`, or with a repository whose snapshot moved, is refused and retried with the reason named,
so an implementer that forgets the limitation can never send the run on to review. The script's
decision checks, the severities, the spec-compliance reviewer and the fixer's input stay
as they were. The design document of the implementer's spec checks refers to this document where
it says which findings block the run and which items are built.

## Decisions and their reasons

The entry carries a list because a `joint-impossibility` concerns two items, and an entry with one
id could name only one of them.

A `joint-impossibility` or `missing-contract` entry blocks, because law 13 of implement-review-verify
has work that genuinely cannot satisfy the applicable requirements report the concrete
impossibility and block. Building the rest of the spec around such an entry would build one half of
two requirements that cannot both hold, or build around an item whose contract nobody defined, and
the proof would then read as complete. The block uses the implementer's existing blocking
limitation, whose path through the script already ends the run with exit `root-resolution` and
hands the root the limitation and the finding.

An `unbacked-item` entry does not block, because it says only that no words of the user back its
items. The rest of the spec can still be built from the words that do back it. An item that needs
an unbacked item cannot be built without building that item first, so it rests on the same missing
words and stays unbuilt with it.

The rule sits with the finding verifier because it is the one stage that sees both the review
findings and the implementer's object. Without it, the spec-compliance reviewer reports the unbuilt
item as missing, the verifier approves the fix, and the fixer builds what the sense check left
unbuilt before the root reads the finding.

## Tests

The routing tests check that the implementer schema's `specFindings` entry requires `items`, a
list of at least one string id, and has no `item` field. They check that an implementer returning a
`joint-impossibility` or a `missing-contract` entry with a blocking limitation and an unmoved
snapshot ends the run after the implement stage with exit `root-resolution`, a
`blocking-limitation` item and a `spec-finding` item, and that no review stage starts. They check
that an `unbacked-item` entry, which names a dependent item as well, and a `reality-drift` entry
each reach `remaining` as a `spec-finding` item of its severity while every stage runs. They check
that the implementer's template and implement-review-verify state that `joint-impossibility` and
`missing-contract` entries block and that an `unbacked-item` entry names the items that depend on
its items, and that the finding verifier's template and implement-review-verify name the items of
`unbacked-item` entries as the items left unbuilt and decide a finding asking to build one
`needs-decision`.

## Rejected alternatives

The spec of this change records no rejected alternative.
