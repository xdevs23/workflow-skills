# Name each main run after its unit

A unit fills the name and description in the meta block of its copy of the main script, so each main run appears in the workflow list under its own unit.

This document is generated from a private spec by the spec tool and is never edited by hand.

## Requirements

**placeholder-seen**: A workflow list that shows a main run of the implement-review-verify skill under the name kebab-name and the description one line is a defect.

**per-unit**: Each main run appears in the workflow list under the name and description of its own unit.

**no-check**: Nothing refuses a main run whose copy still carries the placeholder name and description.

**main-meta**: The meta block of the shipped main script carries the name kebab-name and the description one line, and the comment that opens its marked block says a unit edits only that block.

**copy-rule**: Before this unit, a unit copied the shipped script and edited only its marked block.

**marker-test**: A routing test requires the same opening comment of the marked block in all three shipped scripts.

**render-step**: A unit's design document is generated from its final spec after the implementation and never edited by hand.

**unit-fills-meta**: A unit that copies the shipped main script also sets the name and the description of its meta block: the name is a kebab-case name of the unit, and the description is one line saying what the run implements. The phases and every other line outside the marked block stay as shipped, and the shipped main script keeps kebab-name and one line as the values a unit replaces. The comment below the meta block of the shipped main script says so. The implement-review-verify skill says so where it states the copy rule, where it describes the main script, and where it says the fix-run script is filled like the other two. The comment that opens the marked block reads '// ---- UNIT VALUES. A unit copies this file and sets the values of this block. ----' in all three shipped scripts, so it no longer says a unit edits only that block, and the routing test that compares it follows. Nothing else in the pre-phase and fix-run scripts changes. Leaving the meta block as shipped shows every main run under the same placeholder, as main-meta shows.

**meta-tests**: A routing test shows that the shipped main script's meta block carries the two placeholder values and that the skill's copy rule names the name and the description of the main script's meta block as values a unit sets.

## Boundaries

**scope**: The unit adds a comment below the meta block of the shipped main script, changes the comment that opens the marked block in the three shipped scripts, the implement-review-verify skill and the routing tests, and adds its own design document. No check refuses an unfilled copy, and nothing else changes.

## Acceptance criteria

1. **c-fill**: unit-fills-meta holds in the implement-review-verify skill and the shipped main script.
2. **c-tests**: meta-tests holds, and the test suite passes after the last change.
