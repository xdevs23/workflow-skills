# Unit specs carry provenance per item

## Required result

A unit spec is a YAML list of items. Every item names where it comes from: words the user
said, a rule in a file, a fact observed in this environment, or other items it follows from.
A committed tool resolves those references, and a seat in the spec pre-phase judges whether
the cited words authorize what the item claims, both before any implementer runs. This builds
on [directive authority](directive-authority.md) and [one pass](single-pass-workflow.md).

The failure this exists for: a reviewer raises a hypothesis, the root records it as a
confirmed defect, it becomes a spec requirement, an implementer builds it faithfully, and
every seat passes it because each seat measures the code against the spec. The spec is the
only authority the review apparatus measures against, and nothing measures the spec.

## Decisions

1. **One authored artifact.** The spec of a unit is `.cache/specs/<unit>.yaml`, untracked,
   because it quotes the user verbatim. The tracked design document under `docs/` is
   generated from it by the tool, with the quoted words and evidence references omitted, and
   is never hand-edited. One source, one rendering.
2. **File shape.** A mapping with `unit` (non-empty string) and `items` (non-empty list).
   Every item carries `id` (unique, kebab-case), `kind`, `content` (non-empty Markdown, one
   requirement or decision) and `source`, plus the fields its source kind requires and no
   others. `kind` is an enum of `requirement`, `criterion`, `rejected` (which also requires
   `reason`) and `boundary`. An unknown key, an unknown enum value, a wrong type or an empty
   required string is a violation.
3. **Source kinds.** `source` is an enum of exactly four values:
   * `transcript`: `evidence`, a non-empty list of `{ file, line, uuid }`, and `user_words`,
     the verbatim words. Every entry must resolve; `user_words` must appear in at least one of
     the resolved messages.
   * `rule`: `rule: { file, line }` and `quote`, the rule's words beginning at that line.
   * `observation`: `observation: { command, exit, output, date }`, a fact established by
     running that command in this environment.
   * `derivation`: `parents`, a non-empty list of item ids it follows from.
4. **What a transcript reference resolves to.** `file` is a Claude Code session transcript in
   JSONL, resolved against the session directory the root supplies to the tool. `line` is its
   1-based line number. That line must parse as a record whose `type` is `user` and whose
   `uuid` equals the entry's `uuid`. The message text is the record's `message.content` when
   it is a string, otherwise the concatenation of its `type: "text"` blocks, with any
   `<system-reminder>` block removed. Records of other types, and records without a `uuid`,
   are not evidence targets. Reading is line by line with `JSON.parse` per line, which is the
   runtime's parser, not a hand-written one.
5. **What a rule reference resolves to.** The file must exist and the line must be within it.
   Matching is whitespace-normalized: runs of whitespace, including newlines, collapse to one
   space in both the `quote` and the file text, and the quote must occur in the window that
   begins at the cited line and ends at the first following blank line or after forty lines,
   whichever comes first. A hard-wrapped rule therefore quotes faithfully across its lines.
6. **A hazard is not a source.** An item whose content asserts that a condition, failure mode
   or risk exists is valid only with source `transcript` or `observation`. A seat's claim that
   something could happen is not evidence that it does. Such a claim stays a finding until an
   observation shows the condition in this environment.
7. **A mandated mechanism names what it replaces.** A `derivation` item that mandates a
   mechanism states in `content` the simpler alternative it rules out, and its parents include
   the `transcript` item that asks for it or the `observation` that shows the simpler route
   failing. Wanting a mechanism is not a source.
8. **The check tool.** `tools/check-spec.ts`, committed, run as
   `bun tools/check-spec.ts <spec.yaml> --transcripts <dir>` with optional `--render <path>`
   and `--json`. It parses with `Bun.YAML.parse` and exits non-zero after reporting every
   violation it found, one per line, in file order: it never stops at the first. Violation
   classes: unreadable or malformed YAML; a shape breach of decision 2; a transcript or rule
   reference that fails decision 4 or 5; an observation missing a field; a parent id that does
   not exist; a derivation whose parent chain never reaches a `transcript`, `rule` or
   `observation` item; a cycle among parents. It executes nothing from the spec: a command
   string in an observation is data, never something the tool runs.
9. **The tool's output.** With `--json` it prints an object carrying the counts by kind and by
   source, the ordered list of criterion items as `{ ordinal, id }` with ordinals numbered
   from one in file order, the spec's sha256 and its non-blank line count. Without `--json` it
   prints the same as one summary line. With `--render <path>` it writes the tracked design
   document from the items, omitting `user_words`, `evidence` and `observation.output`.
10. **The provenance seat.** The spec pre-phase gains a third seat, alongside the gap-finder
    and the soundness seat, that receives the spec, the transcript directory and the private
    record. Item by item it judges what the tool cannot: whether the cited words authorize
    what the item claims, whether an item asserting a condition has an observation rather than
    a claim behind it, and whether a mandated mechanism names the simpler route it rules out.
    It re-runs each observation's command, which is read-only by construction, and reports any
    mismatch with the recorded output or exit status, and any observation older than the base
    commit. Its findings are advisory to the root, like the other two seats.
11. **Where the tool runs.** The root runs it before the spec pre-phase and again before the
    implement stage of the main run, and launches neither on a failing spec. The tool proves
    the references resolve. Whether the words mean what the item claims is the provenance
    seat's judgment before code, and the spec-compliance, inverse-spec and finding-verifier
    seats' judgment after it.
12. **Criteria keep their ordinals.** `args.criteriaCount` stays the number of `criterion`
    items and comes from the tool's output rather than a hand count, and a verdict's
    `criterion` stays the integer ordinal the tool assigned. Seats that map a choice back to
    authority name the item `id`: an inverse-spec authorization entry names the id that
    authorizes the choice, or reports that no item does.
13. **The size gate counts the generated document.** The denominator of the code-to-spec ratio
    is the non-blank line count of the tracked generated document, which exists at the
    candidate commit with a blob id, as the gate already requires. The private YAML is never
    measured, because it holds the quoted words.
14. **Runtime.** The tool checks that `Bun.YAML` exists and exits with a diagnostic naming the
    minimum version when it does not. The README states that minimum.
15. **Spec writing produces YAML.** The `immaculate-spec-writing` skill emits this format and
    states the source rules. When a unit reaches implement-review-verify with only a settled
    design in prose, the root writes the YAML before launching: it is the spec the run reads.
    After any amendment the root regenerates the tracked document, and the pre-implement run
    of the tool fails when the generated document differs from the one in the tree.

## Rejected alternatives

* **Markdown spec with a provenance appendix.** The appendix drifts from the prose it
  describes, and nothing binds a sentence to its entry.
* **A hand-written tracked document beside the YAML.** The same content authored twice drifts,
  which is the failure this unit exists to end. It is generated instead.
* **Tracking the YAML.** It quotes the user verbatim, which stays untracked.
* **Letting the tool execute observation commands.** Running command strings out of a spec
  file is a hazard of its own; the provenance seat re-runs them under a seat's read-only
  contract instead.
* **Verdicts keyed by item id.** The structured output contract numbers criteria, and
  renumbering every seat and guard to carry kebab-case ids buys nothing the ordinal mapping
  does not already give.
* **Making the tool the enforcement.** It can check that a reference resolves, never that the
  words mean what the item claims.
* **A fifth source kind for a seat's finding.** That is the hole this unit closes: a finding
  becomes a source only once an observation confirms its condition.

## Boundaries

The unit changes `skills/implement-review-verify/SKILL.md`, the spec-compliance, inverse-spec
and finding-verifier templates, `skills/immaculate-spec-writing/SKILL.md`, adds
`tools/check-spec.ts` and a provenance seat template under `agents/`, extends `tests/`, states
the runtime minimum in the README and bumps the plugin version. Existing Markdown design
documents stay as they are; no unit is migrated retroactively.

This unit bootstraps the format it defines, so its own spec is this Markdown document and
decision 1 does not apply to it: no tool can check a YAML spec until this unit ships one. Every
unit after it authors `.cache/specs/<unit>.yaml` and generates its tracked document from it. The wording sweep of pin, pins
and pinned is not part of this unit: it is unrelated to provenance, its permitted replacements
do not fit every sense in the tree, and bundling it would inflate a unit whose whole subject is
scope that nobody asked for.

## Acceptance criteria

1. `tools/check-spec.ts` parses with `Bun.YAML.parse`, adds no dependency, contains no
   hand-written parsing of YAML or JSON, executes nothing from the spec, and reports every
   violation it found before exiting non-zero.
2. The tool enforces the file and item shape of decision 2, including unknown keys, unknown
   enum values, wrong types and empty required strings.
3. The tool resolves transcript evidence exactly as decision 4 states, including the record
   type, the uuid match, string and block-array content, and system-reminder removal.
4. The tool resolves rule references exactly as decision 5 states, including the
   whitespace-normalized window across hard-wrapped lines.
5. The tool validates observations for their four fields, parents for existence, chains for
   termination in a transcript, rule or observation item, and parents for cycles.
6. The tool's `--json` output carries counts by kind and source, the ordered criterion
   `{ ordinal, id }` list, the sha256 and the non-blank line count; `--render` writes the
   tracked document without quoted words, evidence or observation output.
7. The tool checks for `Bun.YAML` and exits with a diagnostic naming the minimum version when
   it is absent, and the README states that minimum.
8. The skill states decisions 1, 3, 6, 7, 10 to 13 and 15: the YAML spec read from disk, the
   four source kinds, the hazard and mechanism rules, the provenance seat in the pre-phase,
   the two points where the tool runs, that a failing spec launches nothing, the criterion
   ordinals, the size-gate denominator and the regeneration rule.
9. The spec-compliance, inverse-spec and finding-verifier templates state decision 12, and an
   inverse-spec authorization entry names the authorizing item id or reports its absence.
10. A provenance seat template exists under `agents/` stating decision 10, and the pre-phase
    skeleton in the skill launches it beside the other two seats.
11. `skills/immaculate-spec-writing/SKILL.md` emits the format and states the source rules.
12. Tests cover: a valid spec exercising every kind and every source; one spec per violation
    class of decision 8; one spec carrying several violations at once, asserting that all of
    them are reported in file order with a non-zero exit; malformed YAML; a missing file; the
    `--json` and `--render` outputs; and the wording of the skill and the four templates.
    `bun test tests/` passes.
13. The plugin version is bumped. Existing behavior is preserved: seat input boundaries, the
    one pass, source coverage, the verifier's guards, writer commit rules, the structured
    stage output contracts and the integer criterion ordinals.
