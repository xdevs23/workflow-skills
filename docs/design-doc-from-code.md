# Write the design document from the code

A unit's design document is written by hand by the writers of the unit, from the code they built,
after the implementation, and only when the unit's change alters the design. A writer extends the
document that already describes the part it changed and writes a new one only when none does. The
spec tool checks the prose of a spec against a 120-character width
rule and counts that prose as `specLines`, which the 20:1 size check divides by.

## The writers write the document

The implementer, when its change alters the design, writes or extends a design document as its
last write, once its implementation is done and before its checks. It writes the document by hand
from the code it built and the spec, commits it as its own commit and lists it in the files it
returns. The fixer of the main run writes or extends a document by hand once its corrections are
done, when a correction alters the design, commits it as its own commit, and writes nothing when its
approved list is empty. The fixer of a fix run does the same in the parent unit's documents
directory.

The document describes the change as the code at the writer's final commit implements it: what it
does, how its parts fit together, the decisions with their reasons, and the alternatives that were
rejected with their reasons. The rejected alternatives come only from the spec's items of kind
`rejected`, and a writer adds none of its own. The writer checks every statement about behaviour
against that code. The document carries no words of the user, no local absolute paths and no
account of the conversation, and it follows the repository's prose rules and the writing-style
skill.

The main script and the fix-run script carry this step in the writer prompts, before the check
command, so a prompt reads in the order of the work. Each script names a new document after the
spec's file name: the main script after the unit spec, the fix-run script after the parent spec.
Both scripts hold the same text for when a writer writes a document and for what the document
carries, and no stage prompt produces the document with a tool.

The implement-review-verify skill, the spec-writing skill, the implementer and fixer templates
and the README describe this step and the contents of the document. The passages that say which
documents may enter a spec as authority also cover the generated documents that earlier units left
in the repository.

## A document when the design changes

A writer, the implementer or a fixer, writes or extends a design document when its change alters
the design: what the code does, how its parts fit together, a decision with its reason, or a
rejected alternative. A change that alters none of these needs no document, and the stage is
complete without one. Correcting a design document that describes the code wrongly stays allowed
whether or not the design changes. Each writer prompt opens its document step with this rule, and
the scripts accept a writer whose files hold no design document like any other writer.

A writer whose change alters the design extends by hand the design document in the documents
directory of the marked block that already describes the part it changed. It writes a new document
only when no document there describes that part, and the script names that new document after the
spec's file. The fixer of a fix run works in the parent unit's documents directory and names a new
document after the parent spec. Whichever document a writer wrote or extended, it commits it as its
own commit, as its last write before its checks, and lists it in its files. What the document
carries is unchanged: the change as the code at the final commit implements it, with no words of
the user and no local absolute paths.

The implementer and fixer templates state the same rule, and a writer reads its template's rules
ahead of its prompt, so neither orders a document for a change that alters no design. The templates
leave the choice of the document and the name of a new one to the prompt, which the script builds
from the documents directory and the spec.

## The fix run treats the document like any other file

The diff check of a fix run maps every change of the fix to the corrective entry it carries out,
and no design document in the documents directory gets an exception, whether it is named after the
parent spec or an earlier unit wrote it. A change to any of them maps to an entry, or the check
reports it as a finding, which the run returns to the root as CRITICAL. A correction whose only
change is a design document maps to its entry when that entry names that document, and the run then
treats it as an ordinary fix. The prompt of the diff check says so.

A fix run starts from the parent run's final snapshot and takes no other commit of the parent run,
since nothing in it reads the base commit of the parent unit.

## The spec tool only validates

The spec tool validates a spec and writes no file. Given an option it does not know, it fails with
the argument parser's error, in the spec mode and in the fix-list mode alike. The summary always
goes to stdout, as one plain line or, with `--json`, as JSON. The `summary` field of a spec is the
spec's own summary.

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
item's `user_words` against the cited message with runs of whitespace collapsed, as it matches the
record's quotations.

The tool reads each field as the YAML parser returns it. A folded scalar is therefore checked as
the lines it folds into, one long line per paragraph, and wrapped prose is written as a literal
block.

The Markdown parser `mdast-util-from-markdown` reads each field, and the tool takes two things from
it. The paragraphs, with the first and last line each spans, decide which lines the fill rule
compares. The prefix tokens the parser reads in front of a line's own text, its indentation, list
markers and quote markers, give the column where that text starts. That column decides the first
word of the next line and whether a long line holds a single word. The tool imports the parser at
version 2.0.3, which Bun fetches on the tool's first run, and it needs no other runtime than
`Bun.YAML`, so its minimum Bun version is 1.2.21.

## Spec lines and the size check

The spec tool reports `specLines` in its JSON output and in its plain summary: the non-blank lines
of the spec's prose, plus one line for each distinct item id that some item names as a parent. A
parent adds a line because each one adds a relation the implementation has to honour. The tool
reports `nonBlankLines`, the non-blank lines of the whole YAML file, beside it. Evidence, rule
locations, the observation command, the ids, kinds and sources, and the record path are not prose,
and they change `nonBlankLines` but not `specLines`.

The 20:1 size check of the implement-review-verify skill divides the added code lines by the
`specLines` count the tool reports for the final spec, and it reads no design document. It records
the merge-base and candidate commit of each repository and the spec's `sha256` from the tool. That
`sha256` equals the one the spec check of the run that produced the candidate printed, so the
counted spec is the one the writers and reviewers read.

## Decisions and their reasons

- The writers write the document after the implementation because a document produced from the
  spec records what was planned and says nothing about what the code does. Written from the code at
  the final commit, it records what was built.
- The spec tool has no way to produce a design document, because the document is written from
  the code, and a generator that no stage calls would be code nothing uses.
- A fix run takes no base commit of its parent unit, because nothing in it reads one, and asking
  for it would make every fix run supply a commit to no purpose.
- A writer needs a document only when its change alters the design, because a change that alters
  no design leaves every design document true, and a document written for it would record nothing
  about the design. A document that describes the code wrongly can still be corrected, since the
  correction makes it true again.
- A writer extends the document that already describes the part it changed and writes a new one
  only when none does, so the design of a part is described in one document instead of spread over
  one document per unit that touched it.
- The fix run checks every design document like any other file, and accepts a correction whose only
  change is a design document when its entry names that document, so no document has either a free
  pass or a special barrier.
- The width rule checks both the length and the fill of a line, because a length limit alone would
  let a spec padded with short lines through, and padding would inflate the line count the size
  ratio is measured against.
- The paragraphs and the columns come from an established Markdown parser that reports source
  positions, because an established format is read with an established parser, never with a
  hand-written one. Bun's built-in renderer reports no positions, so it cannot say which lines form
  a paragraph.
- Every prose field is held to the width rule, not the content alone, because every prose field
  counts toward the size check, and a count taken against unwrapped lines could be kept small by
  long lines.
- The size check divides by `specLines` because the whole YAML file holds evidence, rule
  locations, commands and keys, which are bookkeeping and not the prose the ratio is taken
  against.

## Rejected alternative

Generating the design document from the YAML spec with the spec tool was rejected. A generated
document records the spec and says nothing about what the code does. The document is written from
the code instead.
