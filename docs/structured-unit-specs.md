# Unit specs quote the discussion

A unit spec is a YAML file that quotes the discussion of its unit from the session transcripts, and
nothing else. Every entry names the transcript record it quotes, and a committed tool checks each
quote against that record before any stage of a run reads the spec.

The failure this exists for: a reviewer raises a hypothesis, the root records it as a confirmed
defect, it becomes a spec requirement, an implementer builds it faithfully, and every reviewer
passes it because each one measures the code against the spec. The spec is the only authority
the review measures against, and nothing measured the spec.

## Requirements

**spec-is-the-discussion**: A spec holds the discussion of its unit, quoted verbatim from the
session transcripts, and nothing else. The orchestrating session writes no text of its own into
it: there are no items, kinds, sources, derivations, criteria or summary, and no separate record
of the user's words. Only an entry of author `user` is authority. An entry of author `assistant` is
context: it gives the user entries after it their meaning, such as the explanation and the question
a bare yes answers, and decides nothing itself.

**spec-private-document-public**: The spec of a unit is `.cache/specs/<unit>.yaml` under the main checkout, untracked, because
it quotes the user. The tracked design document under `docs/` carries no user words and is
plain Markdown.

**file-shape**: The file is a mapping with exactly two keys: `unit`, the unit's name, and
`entries`, a non-empty list. Every entry has exactly five fields: `file`, `line` and `uuid` name
one record of a session transcript, `author` is `user` or `assistant`, and `text` is a verbatim
substring of that record. Any other key of the file and any other field of an entry fails.

**what-the-spec-holds**: The spec holds the message that the origin pointer of the unit's todo
record names, since the todo record is the first thing written when a unit is asked for, and every
message of the user about this unit from every session of the project, the records of the current
session before a compaction included. The todo record and the records of related units point at
where earlier discussion stands. Of a message about two units the spec holds only the part about
this one, which is why an entry quotes a substring and never has to hold a whole message. Words
about another unit stay out of the spec, and the user corrects the sorting where it is wrong.
Assistant entries are added only as far as the user's words need them. No entry speculates or
asserts something unverified: a cause or a fix enters only once it was established and verified with
its evidence in the chat. Speculation found in the discussion or reported by a stage is removed,
becomes a point to research, or, as a last resort, a question for the user. Every question an entry
asks has its answer in a later entry. Entries keep session order, so a yes stays after the question
it answers.

**the-tool-checks-the-spec**: The orchestrating session checks the spec with the spec tool, and the
main run launches on the checked file. Nobody types into the file, so every entry stays a quote the
tool can verify against its record.

**copies**: A run's spec never changes, and each run starts on its own spec file. Words the user
adds while a run is going or after it returns go into a copy of the spec, the same entries with the
new ones added in session order under a new file name, and the next run starts on the copy. An
earlier assistant message that a new answer needs is inserted at its place. A run that comes
back with nothing built because the implementer flagged the spec continues the same way, on a copy
that holds the user's answer to the flag.

**tool-is-not-enforcement**: The tool proves the spec is usable: every quote stands in the record
it cites, as a message of its author. What the user's words require of the change is judged inside
the workflow, by the reviewers and the finding verifier.

**one-format-definition**: The format is defined once, by what the tool validates, with a committed example spec that
the tests exercise.

**reports-carry-quotations**: The implement workflow skill states, in its section on what the root presents to the user,
that a problem reported to the user carries two literal quotations, each with its file and
line or the command that produced it: the observed symptom, and the line that causes it. A
characterization is not a quotation. When the cause is not identified the report says so and
names what was checked, and never substitutes a plausible cause.

**runtime-has-yaml**: The installed runtime provides YAML parsing, so no dependency is needed.

**minimum-runtime**: `Bun.YAML` first appears in the release notes of Bun 1.2.21 and is absent from those of
1.2.20. The tool checks that `Bun.YAML` exists, exits with a diagnostic naming 1.2.21 as the
minimum when it does not, and the README states that minimum.

**check-command-is-writer-text**: The implement workflow skill states that the check command is prompt text for the writing
stages only and never sits in a block that reviewers receive. A reviewer may not run it, so
a shared block carrying it orders and forbids the same act.

**transcript-resolution**: `file` is a session transcript in JSONL, resolved against the directory
given with `--transcripts`. `line` is its 1-based line number, and the record on that line must
carry the entry's `uuid`. Matching collapses runs of whitespace to one space in the quote and in
the record's text, and the quote must occur in that text.

**user-entries**: An entry of author `user` quotes a message the user wrote, typed or queued, or an
answer the user gave in the question dialog, including a note typed on it, to a question asked
before the record. A task notification, an injected meta record, command output and the result of
any other tool are refused. The text of a message is its string body or its text blocks, with any
`<system-reminder>` block removed.

**assistant-entries**: An entry of author `assistant` cites an assistant record and quotes its text
blocks, the question text of one of its dialog calls, or the content of one of its Write calls. A
plan the user answered yes to is therefore quotable when a Write call holds it. A file edited
afterwards or generated by a command has no record that holds its final text, so it reaches the
stages only through the message that pointed at it.

**entry-order**: Entries of one session file never go back in line order, and two entries may quote
different parts of the same record. The tool compares session files by their real paths, so two
names of one file, such as a symbolic link beside it, share one order. A spec without an entry of
author `user` fails, and so does a file with the keys of a fix list.

**width-rule**: The width rule applies to the text of every entry. A line, counted with its
indentation and markers, holds at most 120 characters, and every line of a paragraph but its last
is full. A line whose own text is one word too long to fit passes and is named in the summary's
`unbreakable` list. Quoted words keep their words, punctuation and order, while their line breaks
are free, because the tool compares them with the record after collapsing whitespace.

**size-count**: The `specLines` count behind the 20:1 size gate is the number of non-blank lines of
the entries' text. The file's keys and an entry's other fields add nothing to it.

**check-tool**: `tools/check-spec.ts` is run as `bun tools/check-spec.ts <spec.yaml> --transcripts
<dir>` with optional `--json` and `--base <list>`, and `--partial-base` beside `--base`. The
`--base` list names every git repository of the tree with its base commit, and the tool fails a
path that is no repository's top level, a commit the repository does not hold, or a repository the
list leaves out; with `--partial-base` it skips the search for left-out repositories. The tool exits
non-zero after reporting every violation it found, one per line, and never stops at the first. It
executes nothing from the spec.

**violations-name-the-entry**: A violation names the entry by its 1-based position, as
`<file>: entry 3.text: <message>`, never in array notation. A violation of the whole file names
the file's key, and it is reported before those of the entries, which follow in entry order.

**summary**: A passing run prints its summary on stdout, as JSON with `--json`: the spec's
`sha256`, its `nonBlankLines`, the `specLines`, the `unbreakable` lines, a fresh random `proof`
and the spec path. A failing run prints no summary and no proof.

**where-the-tool-runs**: The orchestrating session runs the tool before it launches the main run,
and the run's launch check runs it once more and continues only on the proof it prints. A failing
spec launches no run. Every stage receives the spec by its path under the main checkout, never a
path relative to its worktree, because a worktree holds no untracked file.

## Boundaries

**no-hand-written-parsers**: The tool parses YAML with `Bun.YAML.parse` and JSON with `JSON.parse`, reading transcripts
line by line. It contains no hand-written parsing of either and adds no dependency.

## Rejected alternatives

**rejected-appendix**: A Markdown spec with a provenance appendix.
Reason: The appendix drifts from the prose it describes, and nothing binds a sentence to its entry.

**rejected-tracked-yaml**: Tracking the YAML.
Reason: It quotes the user, and those words stay untracked.

**rejected-size-budget**: Anchoring a size budget to a stated expectation.
Reason: The units that ran away needed nobody inventing requirements. A budget treats the symptom.

**rejected-written-spec**: Keeping a spec the model writes, under stricter rules.
Reason: Text the model writes into a spec invents decisions and bends the user's words, so the spec
holds quotes and nothing else.

**rejected-fixed-end**: A discussion that ends when the workflow starts.
Reason: The user adds words while a run is going and after it returns.

**rejected-whole-messages**: A whole message in every unit it touches.
Reason: An entry quotes the substring of the message that is about its unit.

**rejected-typed-words**: Words typed into the spec file.
Reason: Every entry stays a quote the spec tool can verify against its record.

**rejected-editor-check**: Opening the spec in the user's code editor for a check before every run.
Reason: The spec rules reject an open question and speculation and flag an entry without meaning of
its own, so the spec needs no check by hand before a run.

**rejected-file-with-hash**: A file path with a hash for a plan the user approved.
Reason: The content of a Write call already stands in the transcript.
