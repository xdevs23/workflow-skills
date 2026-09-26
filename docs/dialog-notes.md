# Count a note on a dialog answer as the user's words

The spec tool accepts the words the user types as a note on a question-dialog answer, so a spec item can cite them.

This document is generated from a private spec by the spec tool and is never edited by hand.

## Requirements

**note-blocked**: Words the user types as a note on a question-dialog answer can back a spec item, the same way a chosen or typed answer does.

**dialog-counts**: A question-dialog answer holds the user's words.

**answers-only**: Before this unit, the spec tool took the user's words of a dialog result only from the values of its structured answers mapping.

**host-text**: The text of a dialog's tool result is wording of the host and never counts as the user's words.

**render-step**: A unit's design document is generated from its final spec after the implementation and never edited by hand.

**note-shape**: A dialog answer that carries a typed note records it in the result's annotations mapping, keyed by the question, as notes, and puts a placeholder of the host in the answers mapping for that question.

**preview-shape**: A dialog answer whose option carries a preview records the preview in the same annotations mapping, keyed by the question, as preview.

**no-raise**: A plugin version that has not been released yet is not raised again.

**notes-count**: The spec tool takes the user's words of a question-dialog result from the values of its answers mapping and from the notes of every entry of its annotations mapping, keeping only non-empty strings as it already does for answers and ignoring an annotations value or entry that is not a mapping. The answers value of a question whose annotation carries notes is the host's placeholder when it reads exactly (notes only), and that placeholder does not count. The preview of an annotation and the text of the tool result never count. A note counts only where an answer would: in a result that answers an earlier dialog call and is not an injected meta record or a task notification. Reading only the answers mapping leaves a typed note uncitable, as note-shape shows.

**text-sync**: Both passages of the implement-review-verify skill that name a question-dialog answer as the user's words (the transcript source and the directive record) and both passages of the immaculate-spec-writing skill that do (the record and the transcript source) say that a note typed on the answer counts too, and the comment beside the spec tool's dialog reading names the notes and the placeholder.

**note-tests**: The spec tool tests gain dialog results with a note in the transcript fixture, and show that the note's words can be cited, that the note can back a record entry, that the placeholder (notes only) and the text of an annotation's preview cannot be cited, and that a note in a result that answers no earlier dialog call, in an injected meta record or in a task notification cannot be cited.

## Boundaries

**scope**: The unit changes the spec tool, its tests and fixture, the two skills, and adds its own design document. Nothing else changes, the plugin manifest included.

## Acceptance criteria

1. **c-tool**: notes-count holds in the spec tool.
2. **c-text**: text-sync holds.
3. **c-tests**: note-tests holds, and the test suite passes after the last change.
