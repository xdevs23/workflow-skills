# The user's words reach every stage that could contradict them

The private directive record becomes a structured file whose every quote the spec tool verifies against messages the user actually wrote, text the user approved counts as the user's words, the provenance reader blocks a run whose record misses the user's messages on the unit or on what it extends, and a choice without the user's words becomes a finding that reaches the user as a question unless the user's words, read in their context, back it.

This document is generated from a private spec by the spec tool and is never edited by hand.

## Requirements

**words-overrule**: The user's words overrule everything else, a contradiction with them hard-flags, and the recurring failure is that the user says one thing and the reviewers do not catch it.

**structured-record**: The private directive record becomes structured YAML: every entry is the user's verbatim words plus quoted context, the spec tool checks each quote against the transcripts, and the record carries no free-text notes by the model.

**approval-is-decision**: When the user approves a plan the model proposed, the record holds that plan text and the tool verifies the approval.

**no-dropped-messages**: The provenance reviewer searches all the user's messages on the unit's subject, a message missing from the record blocks the run, and the same check covers what the unit extends: documents, earlier units and existing code.

**unbacked-choice-question**: A choice without the user's words gets its own finding kind, the verifier may not answer it with record or cleanup, and it reaches the user as a question.

**row-six-out**: The sixth proposed change, a contradicting message stopping the work, stays out of this unit.

**close-with-context**: The verifier may close an unbacked-choice finding by quoting the user's words that back the choice, but only when the quote matches its surrounding context; a line found by searching for a word and quoted without its context does not count.

**convert-active**: Records of units still in progress are converted to YAML; records of finished units stay as they are and their old specs are not rechecked.

**version-rule**: A change to the plugin also raises the plugin version.

**record-check-today**: Today the spec tool only checks that each item's user_words appear somewhere in the record file's text.

**user-record-check-today**: Today the spec tool accepts any record of type user as the source of cited words, whatever its origin.

**blocking-today**: Today only a must-fix provenance finding that an item's words are missing, misread or ambiguous blocks the main run.

**kinds-today**: Today the finding kinds are band-aid and longer-route.

**prephase-unbriefed**: The pre-phase script gives its unbriefed stages only the hygiene floor, by design.

**plan-files**: Substantial plans are written as HTML files and the chat message points at them.

**scoped-out-note**: A record in another project carries a model-written note that scopes the user's shared-memory direction out of a unit.

**notification-records**: This project's transcripts hold records of type user whose content is workflow output, marked with the origin kind task-notification.

**current-version**: The plugin's version is 0.21.0.

**markdown-defaults**: The three shipped scripts default the private record path to a Markdown file in their unit block.

**record-format**: A private directive record is a YAML file with exactly the keys unit and entries. entries is a non-empty list; each entry has exactly these keys, and unknown keys fail: id, unique kebab-case; file, line and uuid of the user's transcript record; words, a verbatim quote of that message; context, a non-empty list of quotes of the surrounding conversation, each with file, line, uuid and quote; and optionally answers and approves. answers is the question or assistant text the words reply to. approves is the approved plan text, with either nothing more, when the text stands in the assistant messages the words reply to, or file and sha256, when it stands in a file that one of those messages names. The spec tool, given a spec, reads the record the spec names and verifies every entry: words against the cited record, which must be a message the user wrote, typed or queued, and never a task notification, an injected meta record, command output or a tool result; each context quote against the record it cites; answers against the messages the words reply to, as it verifies an item's answers today; and approves against those messages or against the named file, whose sha256 must match. Each user_words of the spec must be contained, with whitespace collapsed, in the words of an entry. A record that is not YAML of this shape fails with a message naming the format. The simpler alternative this rules out is keeping the Markdown record and scanning it for notes, which cannot tell a quote from a model's note.

**transcript-origin**: The same origin rule holds for the transcript items of a spec: cited user_words must come from a message the user wrote, and the reply window that answers are resolved in opens only at such a message.

**approval-authority**: Text the user approved, held in an entry's approves, counts as the user's verbatim directive: law 6's hierarchy and the directive-conflict hard flag treat a contradiction with it like a contradiction with the user's own sentence. A spec item built on an approval quotes the approved text in its answers field. The implement-review-verify skill, the AUTHORITY block of the main script and of the fix-run script, and the spec-provenance, implementer, fixer and finding-verifier templates state this. The pre-phase script gains no authority block, since its unbriefed stages get the hygiene floor only by design; the spec-provenance template carries the rule for the pre-phase.

**provenance-completeness**: The spec-provenance reader lists every message the user wrote, in every transcript of the directory and queued messages included, on the unit's subject and on the subject of everything the unit extends: documents, earlier units, and existing code the unit changes or builds on, whether or not an item names it. A message on those subjects that no record entry holds is a must-fix finding that blocks the main run until the root has added it to the record or the user has answered, in the same class as a must-fix finding that an item's words are missing.

**unbacked-kind**: A finding kind unbacked-choice joins band-aid and longer-route, for a choice in the spec, the prompt or the diff that no words of the user back. The briefed review stages of the main script and the spec-provenance reader may emit it; the unbriefed stages' schemas do not carry it, and the inverse-spec reviewer's missing-decision findings carry it. A decision on such a finding is CRITICAL. Its only allowed actions are needs-decision, which reaches the root in the run's remaining items as an open decision, and reject, whose authority must cite a record entry by id together with the surrounding context of the backing words, and whose reason must say how that context supports the choice. record, cleanup and approve-fix are refused by the script's decision checks. The needs-decision authority states that no recorded words back the choice. The skill states that the root puts every open unbacked-choice to the user as a question and checks each rejection's quote against its context before accepting it, and that a pre-phase unbacked-choice finding goes to the user the same way before the main run. The simpler alternative this rules out is sending every such finding to the user even when the user's words back it.

**docs-sync**: The README, the implement-review-verify skill and the immaculate-spec-writing skill describe the YAML record where they describe the record today, and the three shipped scripts default the private record path to a YAML file.

**active-conversion**: Records of units still in progress are converted to YAML by the orchestrating session after this unit merges, since the main run's launch check still runs the tool of the base commit. Records of finished units stay as they are.

**version-raise**: The plugin manifest version rises from 0.21.0 to 0.22.0.

## Boundaries

**scope**: The unit changes the spec tool, its tests and fixtures, the three shipped scripts, the agent templates the items name, the implement-review-verify and immaculate-spec-writing skills, the README, the plugin manifest and the generated design document. It changes no private record, adds no rule for a contradicting message, leaves the rule-source check of the spec tool as it is, and does not change the research-loop or audit-loop skills.

## Acceptance criteria

1. **c-record-tool**: tools/check-spec.ts implements record-format and transcript-origin, and tests/check-spec.test.js covers: a valid record; an unknown key; a missing required key; an entry without context or with an empty context list; a record of the wrong top-level shape; a Markdown record; words that do not match the cited record; words citing a task notification, a meta record or an assistant record; a context quote that does not match; answers and approves not found in the replied-to messages; approves from a named file with a matching and a mismatching sha256; a spec user_words contained in no entry.
2. **c-fixtures-docs**: Every spec-provenance fixture that names a record names a YAML record, the fixture tests pass with their expected error lists updated, and docs-sync holds.
3. **c-approval**: approval-authority holds, and the routing tests assert its wording in the skill, the two AUTHORITY blocks and the named templates.
4. **c-completeness**: The spec-provenance template and the skill state provenance-completeness with its blocking effect, and the routing tests assert the wording.
5. **c-unbacked**: unbacked-kind holds, and the routing tests show: a decision on an unbacked-choice answered with record, cleanup or approve-fix fails the verifier's checks; needs-decision reaches remaining as an open decision; reject without a record entry id and quoted context fails; an unbriefed stage's schema has no unbacked-choice.
6. **c-version**: The plugin manifest version is 0.22.0.
7. **c-tests**: bun test --timeout 60000 tests/ passes after the last write.
