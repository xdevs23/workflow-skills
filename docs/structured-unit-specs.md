# Unit specs carry provenance per item

A unit spec is a YAML list of items, and every item names where it comes from: words the user
said, a rule in a file, a fact observed in this environment, or other items it follows from. A
committed tool resolves those references, and a reader in the spec pre-phase judges whether the
cited words authorize what the item claims, both before any implementer runs.

The failure this exists for: a reviewer raises a hypothesis, the root records it as a confirmed
defect, it becomes a spec requirement, an implementer builds it faithfully, and every reviewer
passes it because each one measures the code against the spec. The spec is the only authority
the review measures against, and nothing measured the spec.

This document is generated from the unit's private spec by `tools/check-spec.ts` and is never
edited by hand.

## Requirements

**items-with-evidence**: The spec handed to a workflow is a list of items. Each item is an object with a Markdown
`content`, and an item that rests on the user's words carries `evidence` (transcript file,
line, uuid) and the verbatim `user_words`. One item holds one requirement or decision.

**root-cannot-slip-decisions-in**: Every item is checkable against its evidence, so the root cannot enter a decision of its own
into a spec as though the user had made it.

**spec-private-document-public**: The spec of a unit is `.cache/specs/<unit>.yaml` under the main checkout, untracked, because
it quotes the user. The tracked design document under `docs/` carries no user words and is
plain Markdown.

**strict-sources**: `source` is a closed enum and every source kind has required fields and no others. An
unknown key, an unknown enum value, a wrong type or an empty required string is a violation.
Nothing softer validates, so no reader can argue an item into a weaker class.

**tool-is-not-enforcement**: The tool proves the spec is usable: its references resolve. Whether the cited words mean what
an item claims is judged inside the workflow, by the provenance reader before code and by
the spec-compliance, inverse-spec and finding-verifier stages after it.

**build-it**: The unit is built, including the rule that an item asserting a hazard needs an observed fact.

**hazard-needs-observation**: An item whose content asserts that a condition, failure mode or risk exists is valid only
with source `transcript` or `observation`. A reviewer's claim that something could happen is
not evidence that it does, and it stays a finding until an observation shows the condition in
this environment.

**record-claim-is-a-claim**: A claim in the work record has the status of a reviewer's claim. Having been written down in
an earlier pass does not make it observed. A recorded entry that asserts a condition is
observed again before it justifies an item, and before it becomes a question to the user.
The simpler route this rules out is citing the work record as a source, which is how an
unchecked claim became a question once already.

**document-is-generated**: The tracked design document is generated from the YAML by the tool, with the quoted words
and evidence left out, and is never hand-edited. One source, one rendering. This holds for
this unit too: its own tracked document is generated from its own spec.

**one-format-definition**: The format is defined once, by what the tool validates, with a committed example spec that
the tests exercise.

**built-with-itself**: This unit is specified in the format it defines, and what using the format showed is fixed
in the unit: see `violations-name-the-id`, `render-shape` and `summary-stream`.

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

**file-shape**: The file is a mapping with `unit` (non-empty string), `summary` (non-empty Markdown, the
preamble of the generated document) and `items` (non-empty list). Every item carries `id`
(unique, kebab-case), `kind`, `content` (non-empty Markdown) and `source`, plus the fields
its source kind requires and no others. `kind` is an enum of `requirement`, `criterion`,
`rejected` (which also requires `reason`) and `boundary`.

**source-kinds**: `source` is an enum of exactly four values. `transcript` requires `evidence`, a non-empty
list of `{ file, line, uuid }`, and `user_words`; every entry must resolve and `user_words`
must appear in at least one resolved message. `rule` requires `rule: { file, line }` and
`quote`. `observation` requires `observation: { command, exit, output, date }`. `derivation`
requires `parents`, a non-empty list of item ids.

**transcript-resolution**: `file` is a Claude Code session transcript in JSONL, resolved against the directory given
with `--transcripts`. `line` is its 1-based line number. That line must parse as a record
whose `type` is `user` and whose `uuid` equals the entry's. The message text is
`message.content` when it is a string, otherwise the concatenation of its `type: "text"`
blocks, with any `<system-reminder>` block removed.

**rule-resolution**: A rule's `file` is an absolute path or a path relative to the directory the tool is run
from, which is the repository root. The file must exist and the line must be within it.
Matching collapses runs of whitespace, newlines included, to one space in both the `quote`
and the file text, and the quote must occur in the window that begins at the cited line and
ends at the first following blank line or after forty lines. A hard-wrapped rule therefore
quotes faithfully across its lines.

**mechanism-names-what-it-replaces**: A `derivation` item that mandates a mechanism states in `content` the simpler alternative it
rules out, and its parents include the item that asks for it or the observation that shows
the simpler route failing. The simpler alternative this rules out is accepting a mechanism
because a stage wanted one.

**check-tool**: `tools/check-spec.ts` is run as `bun tools/check-spec.ts <spec.yaml> --transcripts <dir>`
with optional `--json` and with at most one of `--render <path>` and `--check-render <path>`.
It exits non-zero after reporting every violation it found, one per line, in file order, and
never stops at the first. Violation classes: unreadable or malformed YAML; a shape breach; a
transcript or rule reference that does not resolve; an observation missing a field; a parent
id that does not exist; a derivation whose parent chain never reaches a `transcript`, `rule`
or `observation` item; a cycle among parents. It executes nothing from the spec: a command
string in an observation is data. The simpler alternative this rules out is trusting the
author to keep references correct by hand.

**violations-name-the-id**: A violation names the item by its `id`, which is what the author edits, as
`<file>: <id>.<field>: <message>`. An item with no usable id is named by its 1-based
position written in words, as `item 3`, never in array notation.
The simpler alternative this rules out is the array position the first build printed, which
sends the author counting items to find the one to edit.

**render-shape**: The generated document opens with `# <unit>` and the `summary`, then groups items by kind
under `## Requirements`, `## Boundaries`, `## Rejected alternatives` and
`## Acceptance criteria`, each group in file order and omitted when empty. A requirement or
boundary renders as a paragraph led by its id in bold. A rejected item renders its content
and its reason. Criteria render as a numbered list whose numbers are the ordinals. The
document carries `id`, `content` and `reason` only: `user_words`, `evidence`, rule file and
quote, the whole observation and `parents` are left out.
The heading names and their order are this format's own choice. The simpler alternative
this rules out is the flat list of one section per item in file order that the first build
rendered, which was too thin to commit as a design record.

**summary-stream**: The tool's summary goes to stdout only when neither `--render` nor `--check-render` is
given. With either of them it goes to stderr, unless `--json` is given, in which case the
JSON object goes to stdout. The summary carries the counts by kind and by source, the
ordered criterion list as `{ ordinal, id }` numbered from one in file order, the spec's
sha256 and its non-blank line count.

**check-render**: `--check-render <path>` generates the document in memory and fails when it differs from the
file at the path, or when that file cannot be read. It writes nothing. The simpler
alternative this rules out is regenerating on every run and reading the Git status, which
writes into a tree that reviewers must find unchanged.

**provenance-reader**: The spec pre-phase gains a third reader beside the gap-finder and the soundness reader, with
a template under `agents/`. It receives the spec, the transcript directory and the private
record. Item by item it judges what the tool cannot: whether the cited words authorize what
the item claims, whether an item asserting a condition has an observation behind it, and
whether a mandated mechanism names the simpler route it rules out. It runs each observation's
command again, reports any mismatch with the recorded output or exit status, and reports any
observation older than the base commit. Its findings are advisory to the root and use the
same three-step severity the gap-finder uses.

**where-the-tool-runs**: The root runs the tool before the spec pre-phase and again, with `--check-render`, before
the implement stage, and launches neither on a failing spec. Every stage receives the spec
by its path under the main checkout, never a path relative to its worktree, because a
worktree holds no untracked file.

**criteria-keep-ordinals**: `args.criteriaCount` is the number of `criterion` items, taken from the tool's output and not
from a hand count, and a verdict's `criterion` is the integer ordinal the tool assigned. The
soundness reader's prompt states that numbering rule, since the file it reads shows no
numbers. A stage that maps a choice back to authority names the item `id`: an inverse-spec
authorization entry names the id that authorizes the choice, or reports that no item does.
The simpler alternative this rules out is keying verdicts by id, which would renumber every
stage schema and script check for nothing the ordinal list does not already give.

**size-measures-the-document**: The denominator of the code-to-spec ratio is the non-blank line count of the generated
document at the candidate commit, which has a blob id. The private YAML is never measured.

**spec-writing-emits-yaml**: The `immaculate-spec-writing` skill emits this format and states the source rules. When a
unit reaches the implement workflow with only a settled design in prose, the root writes the
YAML before launching. After any amendment the root regenerates the tracked document.

**stale-wording-removed**: Text in the files this unit edits that still describes a hand-numbered Markdown spec is
brought in line: the launch paragraph telling the root to state criteria numbered and to make
the spec doc carry them, the two `criteriaCount` error strings in the skeletons, the closing
line of the spec-compliance template, the completeness prose that promises a limitation per
unchecked provenance entry while the script only requires a non-empty list, and the size
passage in `docs/workflow-finding-verification.md`. New text follows the writing-style
skill: the words seat and lane stay where they name the existing review roles and the
existing enum, and every other listed word is replaced with its plain form.

## Boundaries

**no-hand-written-parsers**: The tool parses YAML with `Bun.YAML.parse` and JSON with `JSON.parse`, reading transcripts
line by line. It contains no hand-written parsing of either and adds no dependency.

**files-in-scope**: The unit changes `skills/implement-review-verify/SKILL.md`, the spec-compliance, inverse-spec
and finding-verifier templates, `skills/immaculate-spec-writing/SKILL.md`,
`docs/workflow-finding-verification.md` for the size passage only, adds `tools/check-spec.ts`
and `agents/spec-provenance.md`, extends `tests/`, states the runtime minimum in the README,
adds `tests/check-spec.test.js` to the README's documented test command, regenerates
`docs/structured-unit-specs.md` and keeps the plugin version this branch already sets.
Existing Markdown design documents stay as they are and no other unit is migrated. The
wording sweep of the word pin is a separate unit.

**behavior-preserved**: Reviewer input boundaries, the one pass, source coverage, the verifier's script checks,
writer commit rules, the structured stage output contracts and the integer criterion
ordinals are unchanged.

## Rejected alternatives

**rejected-appendix**: A Markdown spec with a provenance appendix.
Reason: The appendix drifts from the prose it describes, and nothing binds a sentence to its entry.

**rejected-hand-written-document**: A hand-written tracked document beside the YAML, including for this unit.
Reason: The same content authored twice drifts, which is the failure this unit exists to end.

**rejected-tracked-yaml**: Tracking the YAML.
Reason: It quotes the user, and those words stay untracked.

**rejected-tool-runs-commands**: Letting the tool execute observation commands.
Reason: Running command strings out of a spec file is a hazard of its own. The provenance reader runs them under a reviewer's read-only contract.

**rejected-size-budget**: Anchoring a size budget to a stated expectation.
Reason: The units that ran away needed nobody inventing requirements. A budget treats the symptom.

**rejected-finding-as-source**: A fifth source kind for a reviewer's finding or for the work record.
Reason: That is the hole this unit closes. A finding becomes a source only once an observation confirms its condition.

## Acceptance criteria

1. **criterion-parsers**: The tool parses with `Bun.YAML.parse` and `JSON.parse`, adds no dependency, contains no
   hand-written parsing of YAML or JSON, executes nothing from the spec, and reports every
   violation it found, in file order, before exiting non-zero.
2. **criterion-shape**: The tool enforces `file-shape` and `source-kinds`, including the required `summary`, unknown
   keys, unknown enum values, wrong types and empty required strings.
3. **criterion-transcripts**: The tool resolves transcript evidence as `transcript-resolution` states: record type, uuid
   match, string and block-array content, and system-reminder removal.
4. **criterion-rules**: The tool resolves rule references as `rule-resolution` states, including the
   whitespace-collapsed window across hard-wrapped lines and both path forms.
5. **criterion-graph**: The tool validates observations for their four fields, parents for existence, chains for
   ending in a transcript, rule or observation item, and parents for cycles.
6. **criterion-violation-names**: Every violation names its item by id in the form `violations-name-the-id` states, and no
   violation uses array notation.
7. **criterion-output**: `--json` carries the counts, the ordered criterion list, the sha256 and the non-blank line
   count. The summary follows `summary-stream`: with `--render` or `--check-render` and without
   `--json`, stdout is empty.
8. **criterion-render**: `--render` writes the document in the shape `render-shape` states, and `--check-render`
   behaves as `check-render` states and writes nothing.
9. **criterion-own-document**: `docs/structured-unit-specs.md` is byte-identical to what the tool renders from this spec,
   and it contains no sentence exempting this unit from generation.
10. **criterion-runtime**: The tool checks for `Bun.YAML` and exits with a diagnostic naming 1.2.21 when it is absent,
    and the README states that minimum.
11. **criterion-skill**: The implement workflow skill states: the YAML spec read from its path under the main
    checkout, the four source kinds, the hazard rule with the work-record rule, the mechanism
    rule, the provenance reader in the pre-phase and its launch in the pre-phase skeleton, the
    two points where the tool runs and that a failing spec launches nothing, the criterion
    ordinals and the numbering rule in the soundness reader's prompt, the size denominator, the
    regeneration rule, the two-quotation rule for reports to the user, and the writer-only rule
    for the check command.
12. **criterion-templates**: The spec-compliance, inverse-spec and finding-verifier templates state the ordinal and id
    rule of `criteria-keep-ordinals`, a provenance reader template exists under `agents/` and
    states `provenance-reader`, and the `immaculate-spec-writing` skill emits the format with its
    source rules.
13. **criterion-stale-wording**: Every passage `stale-wording-removed` names is corrected, and text this unit adds uses none
    of the writing-style skill's listed words outside the two stated exemptions.
14. **criterion-tests**: Tests cover a valid spec exercising every kind and every source, one spec per violation
    class, one spec carrying several violations reported in file order with a non-zero exit,
    malformed YAML, a missing file, the `--json`, `--render` and `--check-render` outputs with
    their streams, and the wording of the skill and the four templates. `bun test tests/` passes,
    and the README's documented test command includes `tests/check-spec.test.js`.
