# Check the re-rendered design document in a fix run like any other file

A fix run's diff check no longer exempts the rendered design document: a change to it needs a corrective entry like any other file. The provenance template stops telling the root to render before implementation.

This document is generated from a private spec by the spec tool and is never edited by hand.

## Requirements

**no-exception**: A fix run checks a change to the re-rendered design document like any other file, with no exception.

**doc-only-allowed**: A fix-run correction whose only change is re-rendering a stale design document is accepted when its entry names the document.

**writers-render**: The implementer renders and commits the design document once it is done, and the fixer brings it up to date once its fixes are done.

**unpushed-no-raise**: A version that has not been released is used by nobody, so a branch whose version is already above the released one raises nothing more.

**versions-observed**: The branch already carries a raised plugin version.

**yaml-only**: The unit spec is the YAML file in the project cache and holds everything; no Markdown design document belongs before or during implementation.

**exemption-before**: Before this unit, the fix-run diff check exempted every change to the parent design document by its path.

**doc-only-before**: Before this unit, a fixer whose commits touched only the parent design document had every fixed key reported as a fix without a commit.

**prerender-template**: Before this unit, the spec-provenance template had the root regenerate publishable artifacts from the YAML while the provenance reader runs before implementation.

**fixrun-findings-only**: A fix run carries only corrections of findings; the root never uses it for other work.

**diff-check-uniform**: In a fix run, the diff check treats the parent design document like any other file: a change to it maps to the corrective entry it carries out, or it is a CRITICAL finding. The exemption by path goes. A correction whose only change is the re-rendered document is accepted when its entry covers it, and a fix reported as done needs a commit of the fixer whatever path it touches; the special rule for commits that touch only the document goes. The skill and the routing tests state this.

**template-no-prerender**: The spec-provenance template says that the root amends the YAML, in place of regenerating publishable artifacts, since no design document exists before implementation.

**rerender-parent**: The implementer of this unit, once its implementation is done, re-renders the render-after unit's design document from that unit's final spec, with --base at that unit's base commit, and renders this unit's own document from this spec with --base at this unit's base commit, both as its last writes before its checks. The render-after spec now states the behavior before that unit as earlier behavior, and this re-rendering carries that wording into its document. A fix run on the render-after unit is not used for it, because a fix run carries only corrections of findings from its parent run.

## Boundaries

**scope**: The unit changes the fix-run script, the spec-provenance template, the implement-review-verify skill, the routing tests and the two design documents of the render-after units. It raises no version, since the branch already carries its raise.

## Acceptance criteria

1. **c-diff-check**: diff-check-uniform holds in the fix-run script and the skill, and routing tests show a fix-run document change without a covering entry reported as a CRITICAL diff finding and a document-only correction accepted when its entry covers it.
2. **c-template**: template-no-prerender holds, and no reading-stage template tells the root to render a document before implementation.
3. **c-docs**: Both design documents equal the spec tool's rendering of their final specs at the candidate commit.
4. **c-tests**: bun test --timeout 60000 tests/ passes after the last write.
