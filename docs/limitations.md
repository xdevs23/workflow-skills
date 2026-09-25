# What a limitation is, and the per-commit files check

A limitation is only something a stage was supposed to check and could not. An act the stage's
own rules forbid, such as a read-only stage running the tests, and input the stage is not given
by design are no limitations and are not reported.

The same runs showed a defect in the verify step's writer check: a writer that makes several
commits returns one list of files for all of them, and the check compared that list with each
commit alone, so every commit of such a writer looked out of scope and the fix stage never ran.

This document is generated from a private spec by the spec tool and is never edited by hand.

## Requirements

**forbidden-act-no-limitation**: Leaving out an act a stage's own rules forbid, such as a read-only reviewer running the tests
or a build, is never reported as a limitation.

**withheld-input-no-limitation**: Input a stage is not given by design, such as the private spec for an unbriefed stage, is not a limitation either.

**files-list-is-a-union**: At version 0.19.0 a writer's files list named every path any of its commits touched.

**files-check-per-commit**: At version 0.19.0 the verifier set filesMatch for each commit by comparing the whole files list with that one commit's paths.

**fix-introduced-defects**: A defect found in the plugin's own code is fixed, not only recorded.

**limitation-definition**: The shared prompt blocks of the three shipped scripts, the finding verifier's template and
every reading-stage template that asks for limitations state that a limitation is only
something the stage was supposed to check and could not. An act the stage's own rules
forbid, such as running tests, builds or the spec tool as a reading stage, and input the
stage is not given by design, such as the private spec for an unbriefed stage, are never
limitations and are not reported. The finding verifier discards such an entry without a
decision. The implement-review-verify skill states the same rule once where it describes
limitations. The simpler alternative this rules out is a filter in the script, which
cannot tell a forbidden act from a real gap.

**files-check-fixed**: For each writer commit, filesMatch is true when every path the commit touched appears in the
writer's files list. A path in the files list that no commit of the writer touched is a
writer-scope problem the verifier reports in that writer's last commit's note with ok
false. The finding verifier's template, the verify prompt of the main script and the skill
state this, and a routing test shows a writer with several commits and one files list
passing the scope check.

**unrunnable-observation**: An observation whose command the provenance review cannot run read-only is a must-fix
finding against that observation item, because an observation in a spec must be re-runnable
without writing. It is never reported as a limitation.

**readers-limitations-through-verifier**: A reading stage's limitation reaches the orchestrating session only through the finding
verifier, which keeps it as an unresolved issue or discards it under `limitation-definition`.
The scripts no longer record a reading stage's blocking limitation as a remaining item of
their own. The same holds for an unchecked coverage entry that names a forbidden act or
withheld input: it is dropped, and the retry message of a failed completeness check tells the
stage to drop such an entry as well as to declare a real limitation.

## Boundaries

**files-in-scope**: The change edits the three shipped scripts, the finding verifier's template, the
reading-stage templates that ask for limitations, the implement-review-verify skill, the
routing tests, the design record on structured stage output where it states the files check,
the generated design document and the plugin version, which becomes 0.20.0. Nothing else.

## Acceptance criteria

1. **criterion-limitations**: Every prompt block and template that asks a reading stage for limitations states the rule
   of `limitation-definition`, the verifier's template tells it to discard such entries, and
   routing tests assert the prompt lines.
2. **criterion-files-check**: The verify prompt, the verifier's template and the skill state `files-check-fixed`, and a
   routing test shows a multi-commit writer with one files list reaching the fix stage.
3. **criterion-done**: `bun test tests/` passes, the generated design document equals the tool's render of this
   spec, and the version is 0.20.0.
