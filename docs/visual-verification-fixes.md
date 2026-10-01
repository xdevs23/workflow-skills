# Complete the visual-verification guide against its reference

This unit adds to the visual-verification skill and its guide the rules of the reference harness listed below, states how a change to a compatibility input is judged, and states where the scratch directory lives when its path is too long.

This document is generated from a private spec by the spec tool and is never edited by hand.

## Requirements

**breadth-request**: The implementation guide has the same shape and breadth as the reference harness.

**examples-not-prescriptions**: The guide names components and libraries only as examples and lets the implementing model choose.

**no-reference-names**: The guide keeps no project names, paths or copy strings of the reference application.

**any-rendered-ui**: The guide covers any rendered user interface, including native mobile, desktop and terminal interfaces.

**guide-folder**: The guide is an index plus numbered part files, each at most 450 lines.

**run-flow**: Each writer captures after its last commit and runs the comparison, the comparison report is returned as evidence, not as a pass or fail check, and reviewers that receive the spec check that the capture belongs to the commit under review.

**scratch-setup**: Where the scratch directory goes when its path is too long for the rendering engine depends on the setup, for example a virtual machine's file share or a bind mount to a short path.

**scratch-preference**: The scratch directory is strongly preferred inside the project cache, made reachable at a short path only by a mount or share; the system temporary directory is used only when no other way is possible, and then within the user's global rules.

**input-change-delegated**: How a change to a translation, fixture, scene or lock file is judged when the strict comparison refuses the pair is left to the orchestrating session.

**version-one-raise**: The raise of the branch to 0.21.0 covers both units, and this unit raises the version no further.

**prose-heading-rule**: Every paragraph opens with a full sentence that carries its own subject and reads correctly with every heading removed.

**prose-announcement-rule**: No sentence only announces that more text follows.

**banned-words-rule**: Text follows the do-not-use list of the writing-style skill.

**test-command**: The repository runs its checks with bun test over the test files.

**sheet-without-compatibility**: The reference evidence sheet deliberately renders two captures without the compatibility check, so a locale or fixture edit that changes the scene fingerprint still shows what it did on screen, while the comparison stays the strict verdict.

**sheet-dimensions**: The reference evidence sheet counts a checkpoint whose dimensions changed as a changed checkpoint.

**reference-copy**: The frozen reference copy cited by the rule items matches its recorded fingerprints file by file.

**branch-version**: The branch already carries a raised plugin version.

**capture-revision-split**: Inherited from the first unit's fixes: reading stages check that the before capture's receipt carries the base commit the unit spec names and that each after capture's receipt carries the snapshot under review.

**coloring-kept**: Inherited from the first unit: the diff coloring part stays in the guide, since the reference harness has it.

**input-change-decision**: A unit spec criterion declares in advance which compatibility inputs its change alters, such as a translation, a fixture, the scene module or a dependency lock, and its expected outcome then takes a third form beside zero changed pixels and changes only in named checkpoints. The comparison refuses such a pair and stays strict. The writer compares the before and after receipts field by field and returns the fields that differ; the pair is judged only when the differing fields are exactly the declared inputs, and any other difference fails the outcome. The writer then renders an evidence sheet per variant under output names never used before, and the sheet also writes its per-checkpoint results beside the image in a structured file: changed-pixel count, changed dimensions, new checkpoint, and checkpoint present only in the before capture. A variant present only in the before capture is named in that file. An input takes this third form only when a compatibility field of the receipt covers it; a translation that only the application loads, outside the scene's import graph, is application source, the comparison accepts that pair, and the second outcome form applies. The receipt keeps the path-keyed entry list of the scene fingerprint beside its digest, so the field-by-field difference names each changed file and the declared-input match is checked file by file. Pixel counts come from that file, a checkpoint whose dimensions changed counts as changed, and the measured checks come from the after capture's own receipt and report. The simpler alternative this rules out is loosening the comparison for declared inputs, which would weaken the strict verdict.

**scratch-decision**: The scratch directory of the runtime and the rendering engine lives in the system temporary directory, one private directory per run, and the launcher removes it when the run ends. It holds only temporary files; every artifact stays in the harness directory.

**gap-1**: The reference harness states or enforces this rule: The automation library and the rendering engine are locked together as a verified compatible combination during implementation, and no version is claimed that was not verified.

**gap-2**: The reference harness states or enforces this rule: The scratch override names a private directory used by one run only, never shared across runs.

**gap-3**: The reference harness states or enforces this rule: A missing lock fails, as does a mismatched one.

**gap-4**: The reference harness states or enforces this rule: The bootstrap copies the harness code into the lock-keyed dependency cache and runs the command line and the self-test suite from there with the runtime's automatic installation disabled, so harness modules resolve packages only from the frozen cache and never from the project's own installed dependency directory.

**gap-5**: The reference harness states or enforces this rule: The refresh is never invoked by scene, by compare, or by a cache miss.

**gap-6**: The reference harness states or enforces this rule: The bootstrap exits with the child process's exit status, and a child that ends without a status (killed by a signal) counts as a failure.

**gap-7**: The reference harness states or enforces this rule: A tracked scene's module file is named after the scene name, since the scene fingerprint is computed from the file located by that name.

**gap-10**: The reference harness states or enforces this rule: The response manifest derived from reading the code is stated as a manifest to verify, never claimed as a browser-observed request trace.

**gap-11**: The reference harness states or enforces this rule: Only the synthetic session, the locale and the theme are seeded into storage before the first render; nothing else is seeded.

**gap-12**: The reference harness states or enforces this rule: The non-overlap check in reading order and the truncating-label floor check use a tolerance of half a layout unit, not the one-unit containment tolerance.

**gap-13**: The reference harness states or enforces this rule: Geometry checks fail when the measured set is empty or a measured box or gap has zero size, so a collapsed or missing element never passes a containment or non-overlap check trivially.

**gap-14**: The reference harness states or enforces this rule: A component scene draws the component in every real host it appears in, at that host's literal width, height and background, including the narrowest host, and in each state of the dependent reads it shows, such as ready, loading and error.

**gap-15**: The reference harness states or enforces this rule: The refresh fails on any non-success response status as well as on a redirected response; only an OK, non-redirected read is projected.

**gap-16**: The reference harness states or enforces this rule: The selected record identifier is percent-encoded when inserted into the allowed operation path, and the selection must match that exact encoded operation.

**gap-17**: The reference harness states or enforces this rule: A successful sheet run prints the written sheet's path relative to the working directory.

**gap-18**: The reference harness states or enforces this rule: Publishing another profile under a label that already holds a complete sample requires retaining it or explicitly managing the local cache first.

**gap-19**: The reference harness states or enforces this rule: The container widths of a component scene characterize the primitive only and are no substitute for page-layout evidence; the component's geometry checks are applied again inside the real page.

**gap-20**: The reference harness states or enforces this rule: A targeted checkpoint must enclose everything it is meant to show: a group capture includes every option with no clipped edge, and floating content that opens outside its card is captured on the enclosing host instead of the card.

**gap-21**: The reference harness states or enforces this rule: A container-responsive component whose own width switches between layouts is mounted in one host per layout, at the literal widths of its real hosts, and every host renders in every named variant.

**gap-22**: The reference harness states or enforces this rule: Fixture state is chosen for the tightest layout: the longest labels the controls draw and the extra control that makes a row fullest.

**gap-23**: The reference harness states or enforces this rule: A page save flow checks the concrete dirty/clean states: after an edit the save and discard actions are enabled and the real unsaved indication shows; save happens once; after the save the clean-state actions are disabled and the unsaved indication is removed.

**gap-24**: The reference harness states or enforces this rule: Row and containment geometry checks hold both with everything closed and with each popover open.

**gap-25**: The reference harness states or enforces this rule: Floating content lies inside the viewport, on the side of its trigger the design opens it to, and inside the horizontal edges of its host or card.

**gap-26**: The reference harness states or enforces this rule: Where text may wrap, its line count is recorded as a diagnostic measurement.

**gap-27**: The reference harness states or enforces this rule: The self-test comparison tests reject missing checkpoints (a checkpoint present in one capture and absent from the other), in addition to incompatible inputs and different dimensions.

**gap-28**: The reference harness states or enforces this rule: Curating a scene includes verifying assumptions and agreeing on the observable checks before the product change starts.

## Boundaries

**scope**: The unit changes only the visual-verification skill file and its guide files, measured from this unit's base commit, which holds its generated design document. The guide stays an index plus numbered part files of at most 450 lines each, it covers any rendered interface with the web realization shown where a rule depends on the platform, components appear only as examples, no name, path or copy string of the reference application appears, and the prose rules and the do-not-use words of the writing-style skill hold.

**no-second-raise**: The unit changes no version.

## Acceptance criteria

1. **c-intended-input-change**: The skill file states input-change-decision in its sequence for verifying a change and in its section on visual work in a unit spec, including the third outcome form; there, reading stages also open the evidence sheets, their structured results and the field-by-field receipt difference, and a fix-list entry for such a change names them. Guide parts 10 and 12 describe the field-by-field receipt difference, the per-variant sheets and the structured results file.
2. **c-scratch**: The guide index, parts 2 and 15 and the skill file, in its pitfalls and in its section on visual work in a unit spec, state scratch-decision, and no file offers the system temporary directory as a first choice.
3. **c-gap-1**: The skill file or a guide file states this rule of the reference, generalized for any rendered interface: The automation library and the rendering engine are locked together as a verified compatible combination during implementation, and no version is claimed that was not verified.
4. **c-gap-2**: The skill file or a guide file states this rule of the reference, generalized for any rendered interface: The scratch override names a private directory used by one run only, never shared across runs.
5. **c-gap-3**: The skill file or a guide file states this rule of the reference, generalized for any rendered interface: A missing lock fails, as does a mismatched one.
6. **c-gap-4**: The skill file or a guide file states this rule of the reference, generalized for any rendered interface: The bootstrap copies the harness code into the lock-keyed dependency cache and runs the command line and the self-test suite from there with the runtime's automatic installation disabled, so harness modules resolve packages only from the frozen cache and never from the project's own installed dependency directory.
7. **c-gap-5**: The skill file or a guide file states this rule of the reference, generalized for any rendered interface: The refresh is never invoked by scene, by compare, or by a cache miss.
8. **c-gap-6**: The skill file or a guide file states this rule of the reference, generalized for any rendered interface: The bootstrap exits with the child process's exit status, and a child that ends without a status (killed by a signal) counts as a failure.
9. **c-gap-7**: The skill file or a guide file states this rule of the reference, generalized for any rendered interface: A tracked scene's module file is named after the scene name, since the scene fingerprint is computed from the file located by that name.
10. **c-gap-10**: The skill file or a guide file states this rule of the reference, generalized for any rendered interface: The response manifest derived from reading the code is stated as a manifest to verify, never claimed as a browser-observed request trace.
11. **c-gap-11**: The skill file or a guide file states this rule of the reference, generalized for any rendered interface: Only the synthetic session, the locale and the theme are seeded into storage before the first render; nothing else is seeded.
12. **c-gap-12**: The skill file or a guide file states this rule of the reference, generalized for any rendered interface: The non-overlap check in reading order and the truncating-label floor check use a tolerance of half a layout unit, not the one-unit containment tolerance.
13. **c-gap-13**: The skill file or a guide file states this rule of the reference, generalized for any rendered interface: Geometry checks fail when the measured set is empty or a measured box or gap has zero size, so a collapsed or missing element never passes a containment or non-overlap check trivially.
14. **c-gap-14**: The skill file or a guide file states this rule of the reference, generalized for any rendered interface: A component scene draws the component in every real host it appears in, at that host's literal width, height and background, including the narrowest host, and in each state of the dependent reads it shows, such as ready, loading and error.
15. **c-gap-15**: The skill file or a guide file states this rule of the reference, generalized for any rendered interface: The refresh fails on any non-success response status as well as on a redirected response; only an OK, non-redirected read is projected.
16. **c-gap-16**: The skill file or a guide file states this rule of the reference, generalized for any rendered interface: The selected record identifier is percent-encoded when inserted into the allowed operation path, and the selection must match that exact encoded operation.
17. **c-gap-17**: The skill file or a guide file states this rule of the reference, generalized for any rendered interface: A successful sheet run prints the written sheet's path relative to the working directory.
18. **c-gap-18**: The skill file or a guide file states this rule of the reference, generalized for any rendered interface: Publishing another profile under a label that already holds a complete sample requires retaining it or explicitly managing the local cache first.
19. **c-gap-19**: The skill file or a guide file states this rule of the reference, generalized for any rendered interface: The container widths of a component scene characterize the primitive only and are no substitute for page-layout evidence; the component's geometry checks are applied again inside the real page.
20. **c-gap-20**: The skill file or a guide file states this rule of the reference, generalized for any rendered interface: A targeted checkpoint must enclose everything it is meant to show: a group capture includes every option with no clipped edge, and floating content that opens outside its card is captured on the enclosing host instead of the card.
21. **c-gap-21**: The skill file or a guide file states this rule of the reference, generalized for any rendered interface: A container-responsive component whose own width switches between layouts is mounted in one host per layout, at the literal widths of its real hosts, and every host renders in every named variant.
22. **c-gap-22**: The skill file or a guide file states this rule of the reference, generalized for any rendered interface: Fixture state is chosen for the tightest layout: the longest labels the controls draw and the extra control that makes a row fullest.
23. **c-gap-23**: The skill file or a guide file states this rule of the reference, generalized for any rendered interface: A page save flow checks the concrete dirty/clean states: after an edit the save and discard actions are enabled and the real unsaved indication shows; save happens once; after the save the clean-state actions are disabled and the unsaved indication is removed.
24. **c-gap-24**: The skill file or a guide file states this rule of the reference, generalized for any rendered interface: Row and containment geometry checks hold both with everything closed and with each popover open.
25. **c-gap-25**: The skill file or a guide file states this rule of the reference, generalized for any rendered interface: Floating content lies inside the viewport, on the side of its trigger the design opens it to, and inside the horizontal edges of its host or card.
26. **c-gap-26**: The skill file or a guide file states this rule of the reference, generalized for any rendered interface: Where text may wrap, its line count is recorded as a diagnostic measurement.
27. **c-gap-27**: The skill file or a guide file states this rule of the reference, generalized for any rendered interface: The self-test comparison tests reject missing checkpoints (a checkpoint present in one capture and absent from the other), in addition to incompatible inputs and different dimensions.
28. **c-gap-28**: The skill file or a guide file states this rule of the reference, generalized for any rendered interface: Curating a scene includes verifying assumptions and agreeing on the observable checks before the product change starts.
29. **c-scope**: The diff from this unit's base commit touches only the files the scope item names, every changed file stays at most 450 lines, and bun test tests/ passes unchanged.
