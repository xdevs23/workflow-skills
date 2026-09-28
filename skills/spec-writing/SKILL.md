---
name: spec-writing
description: Applies whenever a unit spec or its private directive record is written or amended.
---

# Writing a unit spec

**Load the `writing-style` skill first.** It binds every comment, document, commit message and
reply this skill produces, and it is not optional when working with this plugin.

## Before the spec is written

**Settle the design first.** The implementer builds against a decided design; it does not invent
scope. If the design isn't settled, stop and settle it with the user first.

**Authority lives only in the items.** A design is settled only by the user's words held as spec
items. A document enters a spec only as an observation of the current state of the code or the
documents, re-run and dated, or as a design document the tool generated from a spec that passed
the tool and the provenance review. A hand-written design document is never cited as the design:
its decisions become items with the user's words, or they do not count. The summary, the boundary
items and the comments of a spec state nothing that no item backs, and a comment carries
provenance notes only. A prompt to any agent never calls a design settled or decided on the
orchestrating session's own authority; a prompt that states a decision quotes the user's words and
names the date they were said.

**Inherited work is listed before it is built on.** A unit that builds on a branch, a design
document or earlier units made without a spec that passed the tool and the provenance review
starts by listing the decisions it inherits as items with the user's words. A decision that cannot
be backed that way goes to the user before building continues. The provenance review's frame check
covers that list.

**What the tree already says about the work** is five answers established before any drafting
starts: whether the thing is already implemented; what already exists that the work can build on;
what needs refactoring before the work can sit on it; what the work conflicts with; and how the
applicable rules shape it. Every answer comes from reading the codebase and the rules. An answer
from memory is the one that makes a spec describe a system nobody has.

**An edit the root makes to a spec on its own is an ordinary derivation from an existing
decision.** It is never a new product, architecture, persistence, security or operational choice.
Those choices, and any point where the spec would contradict a recorded directive of the user, go
to the user instead of being written around.

**A spec is never reworded so that it gets past its reviewers.** A spec that needs rewrite after
rewrite is a sign that something is wrong, and the root takes the conflict to the user instead of
rewriting the spec again.

**A premise change rewrites the entire spec.** When a premise of a spec changes, the root either
writes a superseding entry in the todo record kept as `workflow-skills:todo-md` says, discarding
the old entry, and a new spec from an empty file, or rewrites the spec in place from an empty file.
The spec is never edited to follow a premise change. The decisions that still stand come only from
the user's words and the private record.

## The private directive record

**The private directive record** holds the user's verbatim decisions the spec must describe, with
their surrounding qualifications and context, since those give a directive its meaning, and the
plan text the user approved, which counts as the user's verbatim directive. It is the YAML file
described below. Never copy it into the tracked artifact. A necessary directive cannot be omitted
from that record because it seems minor; keep factual research findings distinct from the
decisions the record actually establishes. It vetoes the draft: a directive it contradicts is a
conflict to flag to the user, not evidence for a different decision. If no such record applies,
say so explicitly rather than silently treating none as none needed.

**Anti-re-litigation needs a technical decision record and a PRIVATE source record.**
The tracked design document records decisions, constraints and rejected alternatives with their
reasons, never conversational quotations. Treat user messages as confidential: verbatim directives
may be kept only in untracked, ignored artifacts unless committing them is explicitly authorized.
Point authority-aware seats at that private record to verify fidelity without copying it into
tracked docs, tests, code or commit messages. A broad commit instruction does not authorize
including private records. Keep workflow scripts containing private text untracked too. The
private record lives where `workflow-skills:local-cache` puts private directive records.

The root builds that private record from the actual conversation, as a YAML file with exactly the
keys `unit` and `entries`. Each entry has exactly `id` (unique, kebab-case), the `file`, `line` and
`uuid` of the transcript record the user's message stands in, `words` (a verbatim quote of that
message), `context`, and optionally `answers` and `approves`. The directives themselves go in
`words`, and the qualifications, surrounding context and examples that give them meaning go in
`context`, a non-empty list of quotes, each with the `file`, `line` and `uuid` of the record it
stands in and the `quote`. An entry without context fails the tool. Each entry names its source,
so later statements can be told from earlier ones.
`answers` quotes the question or assistant text the words reply to. `approves` holds the plan text
the user approved: a string when the text stands in the assistant messages the words reply to, or a
mapping of `text`, `file` and `sha256` when it stands in a file one of those messages names, such as
a plan written as an HTML file. The tool verifies every entry: `words` against the cited record,
which must be a message the user wrote, typed or queued, or a question-dialog answer, including a
note the user typed on it, and never a task notification, an injected meta record, command output or
another tool result; each `context` quote against the record it cites; `answers` and `approves`
against the messages the words reply to, or against the named file, whose sha256 must match. Unknown
keys fail, so the record holds quotations and nothing else: a summary, an explanation or an
applicable project requirement never enters it, and nothing in it is relabeled as a user quotation.
A record that is not YAML of this shape, a Markdown record included, fails the tool with a message
naming the format.

**Approved text counts as the user's words.** Text the user approved, held in the approves field
of a private record entry, counts as the user's verbatim directive: a contradiction with it is a
contradiction with the user's own sentence. The hierarchy of law 8 and the directive-conflict hard
flag of law 10 in `workflow-skills:implement-review-verify` treat it that way, and a spec item
built on an approval quotes the approved text in its `answers` field. The tool checks that the
approved text stands where the entry says it does; the provenance reader judges whether the entry's
words approve it.

Never selectively omit, truncate or rewrite the original evidence to make a spec or implementation
pass; only a later, actual user decision may supersede an earlier one, and only
with its provenance recorded — an assistant's own spec edit never does. The root does not edit a
spec or its record while a run on it is in flight. The spec review before the main run is the one
run after which the root amends the spec, once, before it launches the main run on it. A change
after the main run started is work for a new unit and never repeats the finished run's reviews.

A necessary part of the record being unavailable or incomplete blocks the launch. The root writes
no spec and starts no run on it. It searches the session transcripts for the words, and where it
finds none it tells the user which decision it has no words for and waits. Writing the gap into
the record as a limitation and continuing is the failure this sentence exists to stop: a record
without the user's words authorizes nothing, and trusting the spec in its place is not a fallback.
A contradiction between a design and the code, or between two statements of the user, is a
question for the user with both sides quoted, which no agent resolves and no spec is written on
top of.

## The unit spec

The root authors the unit spec, `<unit>.yaml` in the private-spec location that
`workflow-skills:local-cache` defines, ignored and untracked because it quotes the user.
Read that YAML spec from disk in full at each spec-consuming stage. Every stage receives the spec
by its path under the main checkout, never a path relative to its worktree, because a worktree
holds no untracked file. When a settled design arrives as prose, the root writes the YAML before
launching. `<plugin root>/tools/check-spec.ts` defines the validation contract; the committed,
synthetic example at `tests/fixtures/spec-provenance/valid.yaml` is exercised by the tests. The
top-level mapping has `unit`, `summary` (Markdown, the spec's own summary), `record` and a
non-empty `items` list.

The spec's top-level `record` key holds the absolute path of the private directive record the spec
was written from, the YAML file described under the private directive record above. The tool fails
a spec whose record file does not exist, whose record is not of that format, whose record holds a
quote the transcripts do not bear out, or whose record entries do not hold every `user_words` of the
spec in their `words` once whitespace is collapsed. The design document never shows the path. The
tool reads a relative path from the directory it runs in, as the test fixtures do, but a unit spec
holds the absolute path: each script's launch check compares it with the absolute path in its marked
block.

Each item has a unique kebab-case `id`, a `kind` (requirement, criterion, rejected or boundary),
non-empty Markdown `content` stating one decision or requirement, and `source`. A rejected item
also has `reason`. Use exactly the fields of its source kind:

- **transcript:** `evidence`, a non-empty list of `{ file, line, uuid }` pointing to user records in
  the supplied session directory, and `user_words`, verbatim text in at least one resolved message.
  Where the words answer a list, a label or a yes/no question, also `answers`, a verbatim quote of
  the assistant text they reply to, which the tool resolves in an assistant record between the
  previous user turn and the cited record. An answer the user gave through the question dialog
  (`AskUserQuestion`) can be cited: its record is the tool result that answers the dialog call, and
  `answers` can quote the question, an option label or an option description of that call. A note
  the user typed on the answer can be cited from the same record. A message the user sent while the
  session was working can be cited too:
  its record is an `attachment` whose `attachment.type` is `queued_command` and whose
  `attachment.origin.kind` is `human`, with the text in `attachment.prompt`, and `answers` resolves
  before it as before a user record. A queued command of any other origin is refused. No other
  tool result can be cited, because its content is output of a command or a program. A task
  notification, an injected meta record and command output cannot be cited either: a typed
  message counts only with origin `human`, and `answers` resolves in the assistant records since
  the last message the user wrote. At least one
  item has this source: a spec with none of the user's words fails, and so does a requirement
  derived from observations alone.
- **rule:** `rule: { file, line }` and `quote`, matching the rule's words across hard-wrapped lines.
- **observation:** `observation: { command, exit, output, date }`, recording a fact observed here.
  Use a read-only command that the provenance reader can repeat and compare against output and exit.
- **derivation:** `parents`, a non-empty list of item ids whose chains reach a sourced item.

An item asserting that a condition, failure mode or risk exists needs source transcript or
observation. A reviewer's hypothetical hazard stays a finding until an observation establishes the
condition here. A claim in the todo record that `workflow-skills:todo-md` defines has the same
status as a reviewer's claim: having been written down in an earlier pass does not make it
observed. The root observes a recorded condition again before it justifies an item and before it
becomes a question to the user. The todo record is never cited as a source. A derivation mandating
a mechanism names in content the simpler alternative it rules out; its parents include the
transcript item asking for it or the observation showing the simpler route failing. Trace ordinary
derivations to existing decisions; new decisions remain the user's. The provenance reader judges
these claims against the cited words and observed facts.

The prose of a spec is wrapped at 120 characters, and the tool fails a spec that breaks the width
rule. The prose is `unit`, `summary` and each item's `content`, `user_words`, `answers`, `quote`,
`observation.output` and `reason`. A line, counted with its indentation and markers, holds at most
120 characters, and every line of a paragraph but its last is full: the line, a space and the first
word of the next line together would pass 120. A line of a fenced code block holds at most 120
characters and is never held to the fill rule. The one exception is a line whose own text is a
single word too long to fit, such as a long URL, which passes and which the tool names in the
`unbreakable` list of its summary. Quoted words keep their words, punctuation and order verbatim,
while where their lines break is free, so they wrap like the rest, and the tool matches them
against the message with whitespace collapsed. The tool reads each field as the YAML parser returns
it, so a folded scalar (`>`) is checked as the lines it folds into, one long line per paragraph, and
wrapped prose is written as a literal block (`|`).

**ACCEPTANCE CRITERIA ARE MANDATORY.** Before you launch, write each one as a `criterion` item
in the YAML spec: checkable, one per behaviour that must hold. The tool numbers them from one in
file order and supplies `{ ordinal, id }` plus `counts.kind.criterion` for the implementation
workflow's integer ordinals and `args.criteriaCount`.
The concern reviewers return verdicts *per criterion*; the additional seats retain their distinct contracts. Without pinned
criteria, "review" degrades to vibes, each seat invents its own bar, and nothing the fixer
receives can be triaged against anything. No criteria, no launch.

## Validating the spec

The YAML spec holds everything a unit needs, and it is the only form of the spec that exists
before and during implementation: every stage reads it from its path. No Markdown design document
is written, committed or checked before implementation. Edit the YAML and validate it again after
every amendment:

```sh
bun <plugin root>/tools/check-spec.ts .cache/specs/<unit>.yaml --transcripts <session-dir> --base '<base list>' --json
```

The spec path in that command is the location `workflow-skills:local-cache` defines for private
specs. The tool validates references. It lives at `tools/check-spec.ts` under the plugin root. The
plugin root is this repository when the work is on the plugin itself, and otherwise the installed
plugin's directory under the plugin cache, the one whose `.claude-plugin/plugin.json` carries the
loaded version.

`--base` takes the run's base list as JSON: one `{ path, sha }` for every git repository of the
tree, the path relative to the tree root and a single dot for a tree that is one repository. The
tool, run at the tree root, fails a list whose path is no repository's top level, whose commit that
repository does not hold, or which leaves out a repository it finds under the tree root. It reads a
cited rule file at the commit of the repository that holds it, reads a file no listed repository
tracks from disk, and fails on any other git error.
