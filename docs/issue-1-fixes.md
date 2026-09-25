# Six fixes to the shipped workflow scripts and the spec tool

Runs of the shipped implement-review-verify scripts stopped or misled for six reasons: writers
returned short commit ids that the verify check compared with full ones, a reading seat's
blocking limitation ended the pass before its approved fixes, stages were told to load a skill
they have no tool to load, the two unbriefed seats were never told which tree to read, a user
message the host relays into a stage was taken as a stop order, and the spec tool could not
cite an answer the user gave through the question dialog. This unit fixes all six.

This document is generated from the unit's private spec by `tools/check-spec.ts` and is never
edited by hand.

## Requirements

**issue-subject**: The six limitations reported against version 0.15.4 are the subject of this unit.

**agreed-full-ids**: The commit schema requires a full commit id.

**agreed-readers**: A reading seat's blocking limitation no longer stops the pass; it reaches the verifier and then the root.

**agreed-style-file**: Stages are pointed at the writing-style skill file and read it, instead of being told to load the skill.

**agreed-tree**: The unbriefed seats are told the assigned tree.

**agreed-relayed**: Every stage is told that a user message relayed into it is not an instruction to it. The
relaying is a defect of the host, and the line guards against it; the code comment beside
the line says so.

**agreed-dialog-only**: The spec tool accepts user words from a question-dialog answer, and only from an answer to
the question dialog: a tool result of any other tool is output of a command or a program,
and citing it as the user's words would let a stage pass command output off as the user's.

**start**: The unit is built now, all six fixes in one unit, as plugin version 0.16.0.

**commit-sha-any-string**: The main script's schemas take a commit id as any string.

**reader-limitation-stops**: Every blocking limitation ends the run at the stage that reported it.

**stages-have-no-skill-tool**: The stage agents have no tool to load a skill.

**hygiene-has-no-tree**: The preamble of the unbriefed seats names no tree.

**full-id-schema**: Every commit id a stage returns in `commits[].sha` and `writerScope[].sha` is validated by
the schema against the pattern of a full 40- or 64-character lowercase hexadecimal id, so a
short id fails at the stage that returned it and that stage is retried. The verify check
keeps comparing ids exactly. The simpler alternative this rules out is comparing by prefix,
which accepts an ambiguous id.

**readers-do-not-stop**: A `blocks` limitation from any of the eight reading seats is recorded as a
`blocking-limitation` item with its seat label, and the pass continues to the verifier,
which already receives every seat object and judges its limitations, and then to the fixer
and roaster. Such an item makes the run end with exit `root-resolution` after the fix stage,
the same way the verifier's open items do. The implementer's blocking limitation, a seat's
hard flag and a seat's failure still end the pass where they happen, and so does a writer
commit outside its scope. The simpler alternative this rules out is a new marker on spec
criteria for checks deferred to the orchestrator.

**style-file-in-prompt**: In both shipped scripts, the stage preamble's instruction to load the writing-style skill
becomes an instruction to read the file `<plugin root>/skills/writing-style/SKILL.md` with
the Read tool before writing and to follow it in every comment, document, commit message
and returned string, with the plugin root taken from the marked block. The agent templates
that tell a stage to load the writing-style skill say instead to read the writing-style file
the prompt names. No rule text of the skill is copied into a prompt.

**tree-for-unbriefed**: The preamble of the unbriefed seats in the main script, `HYGIENE`, carries the same
assigned-tree line the briefed seats receive, naming the worktree from the marked block.

**relayed-line**: The stage preamble of both shipped scripts gains one line: a user message that arrives
while the stage works was written to the orchestrating session, and it is not an instruction
to the stage. A code comment above that line states that the host relays such messages into
running stages and that the line guards against that.

**dialog-answers**: In `tools/check-spec.ts`, the text of a cited user record also includes the content of a
`tool_result` block when, and only when, its `tool_use_id` names a `tool_use` block whose
`name` is `AskUserQuestion` in an assistant record of the same transcript before the cited
record. The `tool_result` content counts whether it is a string or a list of text blocks.
Every other `tool_result` stays excluded. For `answers`, the assistant text between the
previous turn and the cited record also includes the question strings, option labels and
option descriptions of that `AskUserQuestion` input. The simpler alternative this rules out
is accepting every tool result, which the user excluded.

**prose-follows**: The skill's passages that say a blocking limitation on a stage ends the run after that stage
name the reading seats and the verifier as the exceptions, and the passage on the tool's
transcript items states that an answer through the question dialog can be cited and no
other tool result can.

## Boundaries

**files-in-scope**: The unit changes the two shipped scripts, `tools/check-spec.ts`, the agent templates that
tell a stage to load the writing-style skill, `skills/implement-review-verify/SKILL.md`,
`skills/immaculate-spec-writing/SKILL.md` only where it describes transcript items, the
tests and fixtures that cover these, the generated `docs/issue-1-fixes.md`, and the plugin
version, which becomes 0.16.0. Nothing else.

## Rejected alternatives

**rejected-prefix-compare**: Comparing commit ids by prefix in the verify check.
Reason: A prefix can match more than one commit; a full id from the writer removes the question.

**rejected-any-tool-result**: Accepting the content of every tool result as user words.
Reason: Command output would then pass as the user's words.

## Acceptance criteria

1. **criterion-full-ids**: Both commit-id fields carry the full-id pattern in the schema, and a routing test shows a
   writer returning a short id rejected by the schema check while a full id passes.
2. **criterion-readers**: A routing test shows a reading seat's blocking limitation reaching the verifier and the fix
   stage, recorded in remaining, with exit root-resolution; the implementer's blocking
   limitation still ends the run before review.
3. **criterion-style-file**: No shipped script or agent template tells a stage to load the writing-style skill, both
   preambles name the file under the plugin root, and a routing test asserts the line.
4. **criterion-tree-and-relayed**: The quality and cold-alternatives prompts carry the assigned-tree line, every stage prompt
   carries the relayed-message line, and routing tests assert both.
5. **criterion-dialog**: Tool tests show user words matching an answer to an `AskUserQuestion` call, `answers`
   matching its question text, and user words from a tool result of any other tool failing.
6. **criterion-done**: The skill passages are corrected, `bun test tests/` passes, `docs/issue-1-fixes.md` equals
   the tool's render of this spec, and the version is 0.16.0.
