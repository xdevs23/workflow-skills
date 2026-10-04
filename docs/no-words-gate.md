# A workflow launches only on the user's words

A unit spec that carries none of the user's words authorizes nothing, and today nothing
refuses it. The spec tool accepts a spec with zero transcript items, the implementer treats a
record that was never supplied like a record that is silent, and the skill blocks acceptance
after the work instead of the launch before it. This unit moves every one of those checks to
the launch: the tool refuses a spec without the user's words, a small gate stage at the start
of every run runs the tool and returns its proof, and the writing stages stop on a record that
holds no words.

The failure this exists for: a program of seven units was specified, built and reviewed on a
record whose first entry said that no verbatim words were available. The words existed in the
transcript. Nothing read them, a design contradiction was handed to an agent to resolve, and a
mechanism nobody had asked for was hardened for a day.

The ready-to-use scripts under the skill replace the skeletons that used to sit inside its
text. The root copies one and edits only its marked block.

This document is generated from the unit's private spec by `tools/check-spec.ts` and is never
edited by hand.

## Requirements

**reject-missing-words**: A workflow rejects a spec when the user's verbatim words are missing, not only when the
cited words fail to match.

**tool-refuses-empty**: The spec tool ensures that a spec holds items and that it is not kept empty of the
user's words.

**undecided-question**: A decision the user never took must not reach the user as a question about how to carry
it out. The mechanism in the failing session entered through an assistant's draft and an
answer to a yes/no list that was read without the question it answered.

**eight-changes-agreed**: The eight changes the root proposed are built as proposed: the no-words trigger in the
implementer and the fixer, the launch block in the skill, the no-words hard flag and enum
value in the shared prompt, the launch gate, the three tool checks, the two provenance
reader rules with the blocking exception, and the skill sentence on contradictions.

**ready-scripts**: The skill ships ready-to-use workflow scripts that the root copies and edits instead of
writing each unit's script from scratch.

**gate-is-a-stage**: The launch gate is a small model stage that runs the tool on the spec file named in the
arguments. Its prompt leaves nothing to decide. No check is inlined in the script.

**no-inline-check**: The spec is passed to the run as a file path and checked by the gate stage, not by code
inside the workflow script.

**proof-string**: The tool prints a proof when the spec passes: the fingerprint of the values it checked.
The gate stage returns that proof in a required field. The script continues only when the
proof equals the fingerprint of its own launch values, and otherwise ends the run at once
without another attempt. The script does nothing else with the proof.

**build-it**: The unit is built without a spec review round with the user.

**tool-accepts-no-words-today**: The tool today exits zero on a spec whose only item rests on a rule and none on the
user's words.

**tool-path-is-relative**: The skill's command names the tool by a path relative to this repository, which does not
exist in another project. The installed plugin holds the tool under its plugin cache
directory.

**provenance-reader-unused**: In the project of the failing session, 122 workflow runs since 2026-09-14 launched 62
implementers and zero provenance readers, on a plugin that shipped the reader.

**implementer-silence-rule**: The implementer's sense check lets a record that says nothing about the mechanism pass.
Nothing in it separates a silent record from a record that was never supplied.

**skill-blocks-acceptance-rule**: The skill states that a missing part of the record blocks acceptance. Acceptance comes
after the work is built.

**shared-prompt-limitation-rule**: The shared prompt of the main skeleton tells a stage to report a missing record as a
limitation rather than to stop.

**from-scratch-rule**: The skill forbids copying a previous unit's script, because a copied script carries the
previous unit's authority. The reason stands. What changes is where the reviewed text
lives: in shipped script files instead of code blocks inside the skill.

**advisory-rule**: The provenance reader's findings are advisory today, with no blocking class.

**no-words-trigger**: `abort.trigger` gains the value `no-words` beside `none`, `directive-conflict` and
`sense-check`, in every stage schema that carries the enum and in the skill's prose about
the triggers. The implementer sets it before any edit when the spec was not supplied,
cannot be read, or holds no entry of author `user`, and leaves the tree unmodified. A spec
that holds the user's words and says nothing about the mechanism still passes as silent.
The script treats `no-words` like the other two triggers: `abortOnFlag` throws, the run
ends with exit `aborted`, and the aborting object rides in `remaining`. An entry of author
`user` counts as the user's words. An assistant entry, a paraphrase, a summary and a design
document's decision list do not. The fixer sets the same trigger before its first write; in
a fix run, which reads no spec, it sets it when no entry it receives points at words of the
user or at a rule. The shared prompt names the flag and
forbids reporting the gap and proceeding. The simpler alternative this rules out is a
limitation entry, which the failing session wrote and walked past.

**launch-not-acceptance**: The skill states that a missing part of the record blocks the launch. The root writes no
spec and starts no run on it, searches the session transcripts for the words, and where it
finds none tells the user which decision it has no words for and waits. Writing the gap
into the record as a limitation and continuing is named as the failure the sentence
exists to stop. The skill also states that a contradiction between a design and the code,
or between two statements of the user, is a question for the user with both sides quoted,
which no agent resolves and no spec is written on top of.

**tool-requires-words**: The tool fails a spec in which no entry has author `user`, with a violation naming
`entries`, and a spec whose `entries` is not a non-empty list. The simpler alternative this
rules out is trusting the author to include the words.

**tool-answers-field**: A `transcript` item may carry `answers`, a verbatim quote of the assistant text that the
cited user words reply to. The key is optional: the shape check allows it absent and
allows no other extra key. When present, the tool resolves it: the quote must occur in a
record of type `assistant` in the same transcript file, lying after the nearest earlier
record of type `user` that carries a text block and is not a tool result, and before the
cited user record, with the same whitespace collapsing the rule check uses. An unmatched
quote is a violation naming `<id>.answers`. The simpler alternative this
rules out is reading an answer without its question, which turned a "no" to a listed
option into the opposite of what the user meant.

**tool-proof-string**: When the spec passes, the tool's summary carries `proof`, the fingerprint of the
values it checked in eight hexadecimal characters, and `spec`, the path it was given. Both
appear in the `--json` object and in the plain summary. A failing spec prints no proof. The simpler alternative this rules out is a
fixed marker, which a stage could type without running anything.

**tool-location**: The skill states where the tool lives: `tools/check-spec.ts` under the plugin root, which
is this repository when the work is on the plugin itself, and otherwise the installed
plugin's directory under the plugin cache, the one whose `.claude-plugin/plugin.json`
carries the loaded version. Every command the skill shows uses `<plugin root>/tools/check-spec.ts`,
and the shipped scripts take the plugin root in their marked block. An installed plugin
older than this unit prints no proof, so its gate fails and no run launches on it until
the plugin is updated; that is the intended effect. The simpler alternative this rules
out is the relative path, which resolves only inside this repository.

**gate-stage**: Both shipped scripts begin with a gate stage on the model their marked block sets, shipped
at low effort, before any other agent. Its prompt is one command line and one sentence: run
this exact command once with the Bash tool and return its exit code, stdout, stderr and the
proof string printed on success, with no interpretation, retry or fix. Its schema requires
`exitCode`, `stdout`, `stderr` and `proof`. The script continues when `exitCode` is zero and
`proof` equals the fingerprint of its launch values; otherwise it throws at once, quoting
stderr. The command is the tool with `--json`, the spec path from `args.specPath`, the
transcript directory from `args.transcripts` and the base list. The script refuses at once
when `args.specPath` does not end in `.yaml`. The script parses nothing from stdout and
inlines no check. The simpler alternative this rules out is the root running the tool by
hand before launching, which the failing session never did.

**shipped-scripts**: The skill ships two complete workflow scripts under `skills/implement-review-verify/scripts/`:
`spec-review.js` for the pre-phase and `implement-review-verify.js` for the main run.
Each opens with a marked block, delimited by two comment lines, holding everything a unit
sets: the paths (main checkout, worktree, spec, transcripts, private record, generated
document, plugin root), the check command, the base or start SHA, `criteriaCount`, the
unit prompt text for the implementer, and the model and effort per stage. Everything
below the block is the reviewed skeleton and is not edited per unit. The two code blocks
that held the skeletons inside the skill are replaced by short passages that name the
files and the marked block. The simpler alternative this rules out is keeping the code
blocks in the skill beside the files, which is the same text authored twice and drifts.
The from-scratch rule becomes: copy the shipped script, edit
only the marked block, and never copy a previous unit's copy. The reason the rule gives
stays as written. The routing test and the pre-run test load the two files instead of the
code blocks, and gain cases for the gate: a filled proof continues, an empty proof or a
non-zero exit retries and then throws, and a spec path that is not YAML throws before any
stage.

**provenance-reads-the-question**: The provenance reader reads, for every transcript item, the assistant message the cited
words reply to. Where the words answer a list, a label or a yes/no question, the item must
carry `answers`; a missing one is a must-fix finding. The reader judges the item's content
against question and answer together. Where the cited words admit two readings, the
finding is must-fix and names both readings, and the root resolves it only by asking the
user that one question. A must-fix finding that an item's words are missing, misread or
ambiguous blocks the main run until the user's answer is in the record; the advisory
sentence gains that exception. The pre-phase is its own run, so the block is a rule for
the root and no script enforces it; the simpler alternative it rules out is leaving such
a finding advisory, which is how a misread answer reached a spec.

## Boundaries

**files-in-scope**: The unit changes `tools/check-spec.ts`, `tests/check-spec.test.js` and its fixtures,
`agents/implementer.md`, `agents/fixer.md`, `agents/spec-provenance.md`,
`skills/implement-review-verify/SKILL.md`, the tests that load the skeletons, the README's
description of the tests where it changes, regenerates `docs/no-words-gate.md` from this
spec, adds the two files under `skills/implement-review-verify/scripts/`, and raises the
plugin version to 0.15.0. No hook is added. No other design document is migrated, and
`skills/immaculate-spec-writing/SKILL.md` changes only where it names the tool's path or
the `answers` field.

**behavior-preserved**: Reviewer input boundaries, the one pass, the finding verifier's checks, the writer commit
rules, the criterion ordinals and the existing tool checks are unchanged.

## Rejected alternatives

**rejected-inline-check**: A copy of the tool's checks inside the workflow script, fed with the spec as data.
Reason: It duplicates the tool and puts a second copy of the spec beside the file every other
stage reads. The gate stage runs the one tool on the one file.

**rejected-nonce**: A nonce the script hands to the tool and checks in the tool's output.
Reason: The script hands the tool nothing: each side computes the fingerprint of the values the
tool checked.

**rejected-spec-path-compare**: The script comparing the `spec` path in the tool's output with `args.specPath`.
Reason: The spec path is one of the values the proof covers, so a stage that ran the tool on
another file returns a proof that differs from the script's.

**rejected-prose-gate**: A rule at the top of the global instructions stating that no work proceeds without the
user's words and that it outranks every other instruction.
Reason: It is prose about an inner state. The failing session had such prose and disclosed the
gap instead of stopping. The gate stage and the trigger act where the root is not the
judge.

**rejected-limitation-entry**: A limitation entry in the record for a missing part of the user's words.
Reason: Naming the gap in neat words is what let the work continue.

## Acceptance criteria

1. **criterion-tool-words**: The tool fails a spec with no `transcript` item, and a `requirement` whose chain reaches
   neither a `transcript` nor a `rule` item, each with a violation naming the item or
   `items`, and tests cover both.
2. **criterion-tool-answers**: The tool resolves `answers` against the assistant records between the previous user
   record and the cited one, fails a missing or unmatched quote with a violation naming
   `<id>.answers`, and tests cover a match and a mismatch.
3. **criterion-tool-proof**: A passing run prints `proof` (32 hexadecimal characters, different on two runs) and
   `spec` in both output forms, a failing run prints neither, and tests cover both.
4. **criterion-gate**: Both shipped scripts start with the gate stage as `gate-stage` states, and the tests show
   a filled proof continuing, an empty proof and a non-zero exit retrying three times and
   throwing, and a non-YAML spec path throwing before any stage.
5. **criterion-scripts**: The two scripts exist, each opens with the marked block holding every per-unit value
   `shipped-scripts` lists, the skill's skeleton code blocks are gone and its text names the
   files and the copy rule, and the tests load the scripts from the files.
6. **criterion-trigger**: `no-words` is in every abort enum in the scripts and named in the implementer, fixer and
   shared prompt as `no-words-trigger` states, and the skill's prose about the triggers
   counts three.
7. **criterion-skill-text**: The skill states the launch block, the contradiction sentence and the tool's location as
   `launch-not-acceptance` and `tool-location` state, and every command it shows uses the
   plugin-root path.
8. **criterion-provenance**: The provenance reader template states the two rules and the blocking exception of
   `provenance-reads-the-question`.
9. **criterion-tests-and-version**: `bun test tests/` passes, `docs/no-words-gate.md` is byte-identical to the tool's render
   of this spec, and the plugin version is 0.15.0.
