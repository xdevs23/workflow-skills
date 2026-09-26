# Simplify the declared-input rule and settle the scratch rule of the visual-verification guide

This unit replaces the automatic declared-input matching of the visual-verification guide with a review of the evidence sheet, and limits the scratch mount rule to paths too long for the rendering engine.

This document is generated from a private spec by the spec tool and is never edited by hand.

## Requirements

**input-change-delegated**: How a change to a translation, fixture, scene or lock file is judged when the strict comparison refuses the pair is left to the orchestrating session.

**keep-it-simple**: Solutions stay simple.

**scratch-setup**: Where the scratch directory goes when its path is too long for the rendering engine depends on the setup, for example a virtual machine's file share or a bind mount to a short path.

**scratch-preference**: The scratch directory is strongly preferred inside the project cache, made reachable at a short path only by a mount or share; the system temporary directory is used only when no other way is possible, and then within the user's global rules.

**sheet-without-compatibility**: The reference evidence sheet deliberately renders two captures without the compatibility check, so a locale or fixture edit that changes the scene fingerprint still shows what it did on screen, while the comparison stays the strict verdict.

**test-command**: The repository runs its checks with bun test over the test files.

**input-change-review**: The comparison stays the strict automatic verdict. A unit whose change alters a compatibility input on purpose, such as a translation, a fixture, the scene module or a dependency lock, says so in its criterion. When the comparison refuses that pair, the writing stage returns the refusal together with an evidence sheet of the same two captures, and the reviewing stages judge the outcome by reading the sheet, the two receipts and the after capture's measured checks. There is no automatic matching of receipt fields, no per-file input list and no structured results file of the sheet. The more elaborate alternative this rules out is automatic receipt matching, which kept growing new gaps.

**scratch-length-only**: The mount-or-share rule for the scratch directory covers only a scratch path too long for the rendering engine. A slow shared file system stays a pitfall that names its symptom, since a short mount path leaves the storage as slow as before.

## Boundaries

**scope**: The unit changes only the visual-verification skill file and its guide files, measured from this unit's base commit, which holds its generated design document. Every file stays at most 450 lines.

## Acceptance criteria

1. **c-input-change-review**: The skill file, in its verifying sequence, its outcome forms and its unit-spec section including reading stages and fix-list entries, and guide parts 10 and 12 and the index state input-change-review.
2. **c-machinery-removed**: No file of the skill or guide in the resulting tree describes a field-by-field receipt difference, a declared-input match of receipt fields or files, or a structured results file of the evidence sheet.
3. **c-scratch-length-only**: The skill file, the guide index and parts 2 and 15 state scratch-length-only, and the skill's pitfalls state the mount-or-share remedy once, in the scratch path length paragraph.
4. **c-scope**: The diff from this unit's base commit touches only the files the scope item names, every changed file stays at most 450 lines, and bun test --timeout 60000 tests/ passes.
