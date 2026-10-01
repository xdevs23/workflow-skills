# Specs check their frame, the whole record and their own private record

A program of units was specified, built and reviewed for twelve days on a premise the user had
replaced. Every item of its later specs cited real words, a rule or an observation, and every
citation passed the spec tool and the provenance review. The replaced premise never was an item:
it sat in the specs' summaries, in comments, and in the branch and design document the units
built on, and the provenance review read only the lines around each citation, so it never met
the later decision.

This change checks the frame as well as the items, has the provenance review search the whole
record of the user's words on every subject a spec covers, lets a spec cite a message the user
sent while the session was working, binds a spec to its private record, and sets rules for the
orchestrating session when a premise changes.

This document is generated from a private spec by the spec tool and is never edited by hand.

## Requirements

**analyse-now**: The postmortem of the failed program is analysed and turned into a specified change of the plugin.

**recommendations-agreed**: All recommendations of the analysis are built: the whole-record search, the frame check,
no authority outside items, citable queued messages, re-validated inherited work, the
spec's declared private record, the rules for the orchestrating session, and the comment
check done by the provenance review without a new dependency.

**premise-change-rewrites**: A premise change is grounds for rewriting the entire spec: either a superseding entry in the
todo record, which discards the old entry, and a new spec, or a full rewrite of the spec in
place. The spec is never edited to follow a premise change.

**keep-building**: The change is built without a further round with the user.

**premise-in-comments**: In the failed program, one spec that passed the tool and the provenance review carried eleven comment lines.

**premise-in-summary**: In the same spec, the summary stated the state of the branch the unit built on as a given, with no item behind it.

**seat-judges-items-only**: At version 0.18.0 the provenance review judged items and read the context around each cited line.

**whole-record-search**: For every subject the spec covers, the provenance review searches every message of the user
in every transcript of the transcript directory it receives, queued messages included, and
reads each hit in context. A later statement that refines, narrows or contradicts a cited
one outranks it. An item whose cited words a later statement contradicts or refines, and a
subject the spec decides with no words of the user on it at all, are must-fix findings that
name the later statement's transcript line. The simpler alternative this rules out is
reading only around the cited lines, which missed a decision thousands of lines later.

**frame-check**: The provenance review also judges what surrounds the items: the summary sentence by
sentence, every boundary item, every comment line of the raw spec file, and every document,
branch or earlier unit the spec names or builds on. A claim there that no item backs is a
must-fix finding, and so is a decision found only in a comment. Comments may carry
provenance notes only. The review reads comments from the raw file; the tool adds no YAML
library to see them.

**authority-only-in-items**: The implement-review-verify and immaculate-spec-writing skills state that a document enters
a spec only as an observation of the current state of the code or the documents, re-run and
dated, or as a design document generated from a spec that passed the tool and the
provenance review. A hand-written design document is never cited as the design; its
decisions become items with the user's words or do not count. The shipped scripts' stage
prompts and the skills' guidance for prompts never call a design settled or decided on the
orchestrating session's own authority; a prompt that states a decision quotes the words and
names their date.

**inherited-work**: A unit that builds on a branch, a design document or earlier units made without a spec that
passed the tool and the provenance review starts by listing the decisions it inherits as
items with the user's words. A decision that cannot be backed goes to the user before
building continues. The implement-review-verify skill states this, and the frame check
covers it.

**queued-messages**: The spec tool accepts as user words the text of a message the user sent while the session
was working: an `attachment` record whose `attachment.type` is `queued_command`, whose
`attachment.origin.kind` is `human`, with the text in `attachment.prompt`, cited by its line
and `uuid`. A queued command of any other origin is refused. For `answers`, the assistant
records before a queued message and after the previous user turn count as they do for an
ordinary user record. The simpler alternative this rules out is accepting any attachment,
which would let a machine-written notice pass as the user's words.

**declared-record**: A spec gains a required top-level key `record`, the absolute path of the private directive
record the spec was written from. The tool fails a spec whose record file does not exist, or
does not contain every `user_words` of the spec after collapsing whitespace, with a
violation naming the record or the item. The launch check of each shipped script passes
the private record path from the script's marked block to the tool, which fails when it
differs from the spec's `record`. The generated document never shows the path. The
simpler alternative this rules out is a separate notion of a program with its own record
file: the whole-record search already removes the harm of a thin record.

**root-premise-rules**: The implement-review-verify skill states, beside the question-premise check, four rules for
the orchestrating session. A decision of the user that changes what a thing is triggers a
redesign shown to the user, beginning with what the user sees and then the data model,
before any unit continues. A limit is never attached to a decision of the user; a limit that
seems needed is asked as its own question. A question of the user about a premise stops
every edit that touches that premise until it is answered. Names follow decisions: a title,
module or heading that contradicts a decision is renamed in the same change.

**spec-rewrite-rule**: The implement-review-verify and immaculate-spec-writing skills state that a premise change
rewrites the entire spec: either a superseding entry in the todo record kept as
workflow-skills:todo-md says, discarding the old entry, and a new spec written from an empty
file, or the spec rewritten in place from an empty file. The spec is never edited to follow
a premise change, and the program's standing decisions come from the user's words and the
private record, never from the old spec.

## Boundaries

**files-in-scope**: The change edits the spec tool with its tests and fixtures, the provenance review's template,
the implement-review-verify and immaculate-spec-writing skills, the launch commands of the
three shipped scripts and the routing tests that assert them, the README where it describes
the tool, the generated design document and the plugin version, which becomes 0.19.0.
Every existing fixture spec gains the `record` key. The words seat and lane stay where they
name existing review roles.

## Rejected alternatives

**rejected-comment-library**: A YAML library that keeps comments, so the tool can refuse comments mechanically.
Reason: It adds a dependency; the provenance review reads comments from the raw file.

## Acceptance criteria

1. **criterion-search-and-frame**: The provenance template states the whole-record search with the outranking rule, and the
   frame check over summary, boundaries, comments and named documents, branches and units, with
   both kinds of must-fix finding.
2. **criterion-queued**: Tool tests show a human queued message citable as user words, a queued command of another
   origin refused, and `answers` resolved before a queued message.
3. **criterion-record**: Tool tests show a spec without `record`, with a missing record file, and with a record that
   lacks one of its `user_words` failing, and a launch-time record path that differs from the
   spec's failing; routing tests show every shipped script's launch command passing its record.
4. **criterion-rules**: The skills state the rules of `authority-only-in-items`, `inherited-work`,
   `root-premise-rules` and `spec-rewrite-rule`, and no shipped script prompt calls a design
   settled or decided.
5. **criterion-done**: `bun test tests/` passes, the generated design document equals the tool's render of this
   spec, and the version is 0.19.0.
