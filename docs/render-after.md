# Render the design document only after implementation

The design document is generated from the final YAML spec as the last step of a unit, after the implementation; before and during implementation only the YAML spec exists, and every stage reads it.

This document is generated from a private spec by the spec tool and is never edited by hand.

## Requirements

**yaml-only**: The unit spec is the YAML file in the project cache and holds everything. No Markdown design document exists before or during implementation, since such a document is a source of failure, and the document is generated after implementation so it records what was built.

**writers-render**: The implementer renders and commits the design document once it is done, and the fixer brings it up to date once its fixes are done.

**leave-old-docs**: The design documents already in the repository stay as they are.

**version-rule**: A change to the plugin also raises the plugin version.

**global-rule**: For a substantial or architectural change, the global instructions have the durable design document written after the implementation is complete, capturing the decision with user-rejected alternatives and the reasons, and implementation runs against the local-only spec.

**prerender-skill**: Before this unit, the implement-review-verify skill rendered the design document before implementation and checked it at launch.

**prerender-script**: Before this unit, the main script's launch check ran the tool with --check-render against the generated document.

**prerender-spec-writing**: Before this unit, the immaculate-spec-writing skill checked the rendering before implementation.

**size-gate**: The size check counts the non-blank lines of the tracked generated document at the candidate commit.

**copy-rule**: A unit copies the shipped script and edits only its marked block.

**checks-once**: An agent's checks run once, at the end of its writes.

**current-version**: Before this unit, the plugin's version was 0.22.0, raised from 0.21.0 by the previous feature unit.

**other-scripts-no-render**: Before this unit, neither the pre-phase script nor the fix-run script rendered or checked a design document.

**no-prerender**: No design document is rendered, committed or checked before implementation. The main script's unit block has no generatedDocument value and its launch check runs the spec tool without --check-render. No stage prompt names the unit's generated document as something to read; every stage reads the YAML spec from its path. General mentions of design documents in the shared rules stay.

**writers-render-rule**: The implementer, once its implementation is done, renders the design document from the YAML spec with the spec tool's --render, --base set to the unit's base commit so cited rule files are read as they stood there, as its last write; its checks then run once, after that write, and it commits the document as its own commit. The fixer, once its corrections are done, renders it again the same way as its last write before its checks, and commits it when the rendering changed. The fix-run fixer does the same for its parent spec's document. The implementer and fixer templates and the writer prompts of the main and fix-run scripts carry this, with the render command built from the unit block's paths. The size check counts the non-blank lines of the document at the candidate commit that holds it.

**text-sync**: The implement-review-verify skill, the immaculate-spec-writing skill and the README describe the rendering as the writers' completion step, name the unit block's values without a generated document, give the launch check's reason without the generated document, and no longer describe a rendering or a --check-render before implementation. The routing tests assert the new wording, the launch-check command without --check-render, and the render step in the writer prompts.

**version-raise**: The plugin manifest version rises from 0.22.0 to 0.23.0.

## Boundaries

**scope**: The unit changes the main and fix-run workflow scripts, the implementer and fixer templates, the implement-review-verify and immaculate-spec-writing skills, the README, the routing tests, the plugin manifest, and adds this unit's generated document. The spec tool and its options stay as they are, and existing design documents stay as they are.

**own-launch**: This unit's own main run uses a copy of the shipped main script whose launch check omits --check-render, the one change outside the marked block, since the rule this unit implements forbids the document before implementation; every later unit uses the shipped script.

## Acceptance criteria

1. **c-launch**: no-prerender holds, and a routing test asserts the launch-check command without --check-render and a unit block without generatedDocument.
2. **c-writers**: writers-render-rule holds in both templates and both scripts, and routing tests assert the render step in the implementer, fixer and fix-run fixer prompts.
3. **c-text**: text-sync holds in the implement-review-verify skill, the immaculate-spec-writing skill and the README.
4. **c-version**: The plugin manifest version is 0.23.0.
5. **c-doc**: The unit's own design document exists at the candidate commit, equals the spec tool's rendering of the final spec with --base at the unit's base commit, and was committed by a writer.
6. **c-tests**: bun test --timeout 60000 tests/ passes after the last write.
