# Write the design document from the code

A unit's design document is written by hand by the writers of the unit, from the code they built,
after the implementation. The spec tool no longer generates it. The same change teaches the spec
tool a 120-character width rule for the content of spec items and a line count of that content,
`specLines`, which the 20:1 size gate divides by. The plugin version is 0.24.0.

## The writers write the document

The implementer writes the design document as its last write, once its implementation is done and
before its checks. It writes the document by hand from the code it built and the spec, commits it
as its own commit and lists it in the files it returns. The fixer of the main run updates the
document by hand once its corrections are done, where a correction changed what the document
describes, commits it as its own commit when it changed, and writes nothing when its approved list
is empty. The fixer of a fix run does the same for the parent unit's document.

The document describes the change as the code at the writer's final commit implements it: what it
does, how its parts fit together, the decisions with their reasons, and the alternatives that were
rejected with their reasons. The rejected alternatives come only from the spec's items of kind
`rejected`, and a writer adds none of its own. The writer checks every statement about behaviour
against that code. The document carries no words of the user, no local absolute paths and no
account of the conversation, and it follows the repository's prose rules and the writing-style
skill.

The main script and the fix-run script carry this step in the writer prompts, in the place the
render command used to hold. Each script names the document after the spec's file name: the main
script after the unit spec, the fix-run script after the parent spec. The step sits before the
check command in the prompt, so the prompt reads in the order of the work. Both scripts hold the
same text for what the document carries. No stage prompt of the three scripts carries `--render`
or any other render command.

The implementer and fixer templates, the implement-review-verify skill, the immaculate-spec-writing
skill and the README describe this step and the contents of the document. The passages that say
which documents may enter a spec as authority are unchanged, because the documents generated
before this change stay in the repository as they are.

## The fix run treats the document like any other file

The diff check of a fix run maps every change of the fix to the corrective entry it carries out,
and the parent unit's design document gets no exception. A change to it maps to an entry, or the
check reports it as a finding, which the run returns to the root as CRITICAL. A correction whose
only change is the document maps to its entry when that entry names the document, and the run then
treats it as an ordinary fix. The prompt of the diff check says this and no longer describes the
document as rendered from the parent spec.

The fix-run script no longer takes `parentBaseSha`. Its only use was the `--base` of the render
command, so the launch value, its check, the skill passages naming it and the test values that set
it are gone. A fix run starts from the parent run's final snapshot, `baseSha`, as before.

## The spec tool only validates

The spec tool no longer takes `--render` or `--check-render`, and its renderer is gone. Given
either option, it fails with the argument parser's error for an unknown option and writes no file,
in the spec mode and in the fix-list mode alike. Its usage line no longer names them. The summary
always goes to stdout, as one plain line or, with `--json`, as JSON. The `summary` field of a spec
stays as the spec's own summary.

## The width rule

The tool fails a spec whose prose breaks the width rule, and it reports each violation with the
field it concerns, such as `export-request.content`, and the line number within that field. The
prose of a spec is `unit`, `summary` and each item's `content`, `user_words`, `answers`, `quote`,
`observation.output` and `reason`. A line, counted with its indentation and markers, holds at most
120 characters. Every line of a paragraph but its last is full: the line, a space and the first
word of the next line together pass 120 characters. That holds for a paragraph in a list item and
in a block quote as much as for any other. A line of a fenced code block holds at most 120
characters and is never held to the fill rule. The one exception is a line over 120 characters
whose own text, after its indentation and markers, is a single word, such as a long URL. Such a
line passes, and the summary names it with its field and line number in a list called
`unbreakable`.

Quoted words are verbatim in their words, sentence structure, punctuation and order, and where
their lines break is free. They therefore wrap like the rest of the prose, and the tool matches an
item's `user_words` against the cited message with runs of whitespace collapsed, as it already
matched the record's quotations.

The tool reads each field as the YAML parser returns it. A folded scalar is therefore checked as
the lines it folds into, one long line per paragraph, and wrapped prose is written as a literal
block.

The Markdown parser `mdast-util-from-markdown` reads each field, and the tool takes two things from
it. The paragraphs, with the first and last line each spans, decide which lines the fill rule
compares. The prefix tokens the parser reads in front of a line's own text, its indentation, list
markers and quote markers, give the column where that text starts. That column decides the first
word of the next line and whether a long line holds a single word. The tool imports the parser at
version 2.0.3, which Bun fetches on the tool's first run, and it needs no other runtime than
`Bun.YAML`, so its minimum Bun version stays 1.2.21.

## Spec lines and the size gate

The spec tool reports `specLines` in its JSON output and in its plain summary: the non-blank lines
of the spec's prose, plus one line for each distinct item id that some item names as a parent. A
parent adds a line because each one adds a relation the implementation has to honour. The existing
`nonBlankLines`, the non-blank lines of the whole YAML file, stays beside it. Evidence, rule
locations, the observation command, the ids, kinds and sources, and the record path are not prose,
and they change `nonBlankLines` but not `specLines`.

The 20:1 size gate of the implement-review-verify skill divides the added code lines by the
`specLines` count the tool reports for the final spec, and it reads no design document. It records
the merge-base SHA, the candidate SHA and the spec's `sha256` from the tool. That `sha256` equals
the one the launch check of the run that produced the candidate printed, so the counted spec is the
one the writers and reviewers read.

## Decisions and their reasons

- The writers write the document after the implementation because a document produced from the
  spec records what was planned and says nothing about what the code does. Written from the code at
  the final commit, it records what was built.
- The renderer and its two options are removed because the writer steps were their only callers.
  Left in place, they would remain a generator that nothing uses, for a document that is not wanted
  generated.
- `parentBaseSha` is removed with the render command because nothing else reads it, and keeping it
  would make every fix run supply a commit to no purpose.
- The fix run checks the document like any other file, and accepts a correction whose only change
  is the document when its entry names the document, so the document has neither a free pass nor a
  special barrier.
- The width rule checks both the length and the fill of a line, because a length limit alone would
  let a spec padded with short lines through, and padding would inflate the line count the size
  ratio is measured against.
- The paragraphs and the columns come from an established Markdown parser that reports source
  positions, because the global rules forbid hand-written parsers for established formats. Bun's
  built-in renderer reports no positions, so it cannot say which lines form a paragraph.
- Every prose field is held to the width rule, not the content alone, because every prose field
  counts toward the size gate, and a count taken against unwrapped lines could be kept small by
  long lines.
- The size gate divides by `specLines` because the whole YAML file holds evidence, rule locations,
  commands and keys, which are bookkeeping and not the prose the ratio is taken against.

## Rejected alternative

Generating the design document from the YAML spec with the spec tool was rejected. A generated
document records the spec and says nothing about what the code does. The document is written from
the code instead.
