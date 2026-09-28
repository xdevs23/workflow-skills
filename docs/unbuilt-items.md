# Items the implementer leaves unbuilt

The implementer of implement-review-verify reads the spec against the code before its first edit
and returns what it finds in `specFindings`. An entry of that list now names every spec item it
concerns in a list, and the implementer builds no item named in an entry of class
`unbacked-item`, `joint-impossibility` or `missing-contract`. The finding verifier never approves a
fix that builds such an item and hands the finding to the root as an open decision instead.

## The entry names all its items

An entry of `specFindings` carries `items`, a list of one or more spec item ids, together with the
`class`, the `claim` and `receipts`. The single `item` field it carried before is gone. The main
script's schema for the implementer requires `items` as an array of strings with at least one
entry and allows no other field. A
`joint-impossibility` entry names each item of the conflict, because two requirements that cannot
both hold are one finding about two items.

The main script adds every entry to `remaining` as a `spec-finding` item after the pass, whatever
its ending, and the entry travels there as the implementer returned it, `items` included. The
severities are unchanged: an `unbacked-item` entry is CRITICAL, and every other class is must-fix.

## What the implementer builds

The implementer builds nothing for an item named in an entry of class `unbacked-item`,
`joint-impossibility` or `missing-contract`, and builds the rest of the spec. An item named only in
a `reality-drift` entry is built as before. No spec finding fails the sense check, sets
the abort or asks the user during the run. The implementer's template states this in its sense
check, and implement-review-verify states it in phase 1, where it describes the sense check's
findings.

## What the finding verifier decides

The spec-compliance reviewer never receives the implementer's object, so it reports an item the
implementer left unbuilt as missing required behaviour, which is must-fix. The finding verifier
receives the implementer's object and its `specFindings`. Its template now says that a source
finding which asks to build, complete or change an item named in an entry of class
`unbacked-item`, `joint-impossibility` or `missing-contract` is never `approve-fix`. The verifier
decides it `needs-decision`, names that entry by its class and items in `authority`, and states the
open question in `correction`. The main script already turns every `needs-decision` into an
`open-decision` item of `remaining`, so the finding reaches the root after the run. Phase 3 of
implement-review-verify states the same rule where it lists the verifier's decisions.

The script's decision checks are unchanged. Whether a finding asks to build an unbuilt item is a
judgment about its content, which the verifier makes from the finding and the implementer's
object.

## What stays as it was

The spec-compliance reviewer reports a missing item as before. The fixer's input is still the
verifier's approved list. No other stage changes.
The design document of the implementer's spec checks describes the new entry shape and the new
rule on what the implementer builds.

## Decisions and their reasons

The entry carries a list because a `joint-impossibility` concerns two items, and an entry with one
id could name only one of them.

The items of a `joint-impossibility` or `missing-contract` finding stay unbuilt. Building the rest
of the spec including them would have the implementer build one half of two requirements that
cannot both hold, or an item whose contract nobody defined, and its proof would then read as
complete. Law 13 of implement-review-verify says that work which cannot satisfy the applicable
requirements reports the impossibility and blocks. The run still goes on, as it does for an
`unbacked-item`, and the root reads the finding after the run.

The rule sits with the finding verifier because it is the one stage that sees both the review
findings and the implementer's object. Without it, the spec-compliance reviewer reports the unbuilt
item as missing, the verifier approves the fix, and the fixer builds what the sense check left
unbuilt before the root reads the finding.

## Tests

The routing tests check that the implementer schema's `specFindings` entry requires `items`, a
list of at least one string id, and has no `item` field. They check that each entry reaches
`remaining` as a `spec-finding` item of its severity with its items, a `joint-impossibility` entry
with both of its items. They check that the implementer's template and implement-review-verify
state that no item of an `unbacked-item`, `joint-impossibility` or `missing-contract` entry is
built, and that the finding verifier's template and implement-review-verify state that a finding
asking to build such an item is decided `needs-decision` and is never `approve-fix`.

## Rejected alternatives

The spec of this change records no rejected alternative.
