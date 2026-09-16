# Unit specs carry provenance per item

## Required result

A unit spec is a YAML list of items. Every item names where it comes from: words the user
said, a rule in a file, a fact observed in this environment, or other items it follows from.
A committed tool checks those references before any stage runs, so an item that nothing
supports cannot enter a spec and cannot become code. This builds on
[directive authority](directive-authority.md) and [one pass](single-pass-workflow.md).

The failure this exists for: a reviewer raises a hypothesis, the root records it as a
confirmed defect, it becomes a spec requirement, an implementer builds it faithfully, and
every seat passes it because each seat measures the code against the spec. The spec is the
only authority the review apparatus measures against, and nothing measures the spec.

## Decisions

1. **Location and form.** The spec of a unit is `.cache/specs/<unit>.yaml`, untracked,
   because it quotes the user verbatim. A tracked design document under `docs/` stays a
   quote-free technical record derived from it, as today. The YAML is a list of items under a
   top-level `items:` key; a `unit:` string names the unit.
2. **Item shape.** Every item carries `id` (unique, kebab-case), `kind`, `content` (Markdown,
   one requirement or decision) and `source`. `kind` is an enum of `requirement`, `criterion`
   (an acceptance criterion), `rejected` (an alternative not taken, with `reason`) and
   `boundary` (a limit of the unit).
3. **Source kinds.** `source` is an enum of exactly four values, each with its own required
   fields:
   * `transcript`: `evidence`, a non-empty list of `{ file, line, uuid }`, and `user_words`,
     the verbatim words, which must appear in the message at that line.
   * `rule`: `rule: { file, line }` and `quote`, the rule's words at that line.
   * `observation`: `observation: { command, output, date }`, a fact observed in this
     environment by running that command.
   * `derivation`: `parents`, a non-empty list of item ids it follows from.
   Nothing else validates.
4. **A hazard is not a source.** An item whose content asserts that a condition, failure mode
   or risk exists is valid only with source `transcript` or `observation`. A seat's claim that
   something could happen is not evidence that it does. Such a claim is recorded as a finding
   and stays there until an observation shows the condition in this environment.
5. **A mandated mechanism names what it replaces.** A `derivation` item that mandates a
   mechanism (a module, a patch, a layer, a tool) states in `content` the simpler alternative
   it rules out, and its parents include the `transcript` item that asks for it or the
   `observation` that shows the simpler route failing. Wanting a mechanism is not a source.
6. **The check tool.** `tools/check-spec.ts`, committed, run as `bun tools/check-spec.ts
   <spec.yaml>`. It parses with `Bun.YAML.parse` (present in the pinned Bun, so no dependency
   and no hand-written parser) and reports every violation, one per line, exiting non-zero on
   any: a duplicate or missing id; a field required by the item's source kind that is absent;
   a transcript evidence entry whose file or line does not exist, whose `uuid` does not match
   the message at that line, or whose message text does not contain `user_words` verbatim; a
   rule reference whose file or line does not exist or whose line does not contain `quote`; an
   observation missing a command, output or date; a parent id that does not exist; a
   derivation whose parent chain never reaches a `transcript`, `rule` or `observation` item; a
   cycle among parents. It prints a one-line summary of item counts by kind and by source.
7. **Where it runs.** The root runs the tool before the cold spec review and again before the
   implement stage of the main run, and does not launch either on a failing spec. The tool
   proves the spec is usable and traceable. It does not judge meaning: whether an item's words
   authorize what the item claims stays with the spec-compliance seat, the inverse-spec seat
   and the finding verifier.
8. **Seats read items by id.** The skill's shared authority constant names the YAML spec as
   the authority and tells every authority-aware seat to read it from disk. The
   spec-compliance, inverse-spec and finding-verifier templates work item by item: a
   spec-compliance verdict names the criterion item it judges, an inverse-spec authorization
   entry names the item id that authorizes a choice, and an inverse-spec finding whose
   authorizing item is missing, or whose item has no source in the user's words, is CRITICAL
   as any other.
9. **Criteria count comes from the spec.** `args.criteriaCount` is the number of items whose
   kind is `criterion`, obtained from the tool's summary rather than counted by hand.
10. **The size gate counts the YAML.** The denominator of the code-to-spec ratio is the number
    of non-blank lines in the YAML spec.
11. **Spec writing produces YAML.** The `immaculate-spec-writing` skill emits this format and
    states the source rules above; its output is the file the workflow consumes.
12. **Wording sweep.** The words pin, pins and pinned are replaced across the remaining 24
    sites in `skills/`, `agents/`, `docs/`, `tests/` and `README.md` with the permitted
    wording: immutable snapshot, immutable start SHA, wording check.

## Rejected alternatives

* **Markdown spec with a provenance appendix.** The appendix drifts from the prose it
  describes, and nothing binds a sentence to its entry. Per-item structure is what makes the
  reference checkable.
* **Tracking the YAML spec in Git.** It quotes the user verbatim, which stays untracked.
* **Hand-written YAML parsing.** Banned, and unnecessary: the runtime parses YAML.
* **Making the tool the enforcement.** It can check that a reference resolves, never that the
  words mean what the item claims. Seats do that, and saying otherwise would license removing
  them.
* **A fifth source kind for a seat's finding.** That is the hole this unit closes: a finding
  becomes a source only once an observation confirms its condition.

## Boundaries

The unit changes `skills/implement-review-verify/SKILL.md`, the spec-compliance, inverse-spec
and finding-verifier templates, `skills/immaculate-spec-writing/SKILL.md`, adds
`tools/check-spec.ts`, extends `tests/`, performs the wording sweep and bumps the plugin
version. Existing Markdown design documents under `docs/` stay as they are: they are design
records, not unit specs. No workflow is migrated retroactively.

## Acceptance criteria

1. `tools/check-spec.ts` implements decision 6 in full, parses with `Bun.YAML.parse`, adds no
   dependency, contains no hand-written parsing of YAML, JSON or transcript files, and exits
   non-zero listing every violation it found.
2. The tool validates the four source kinds of decision 3 with their required fields, and
   rejects any other `source` or `kind` value.
3. The tool resolves a transcript evidence entry to its message, matches the uuid and confirms
   `user_words` appears verbatim there; it resolves a rule reference and confirms the quote;
   it confirms every parent exists, that every derivation chain terminates in a transcript,
   rule or observation item, and that no cycle exists.
4. The tool prints counts by kind and by source, including the criterion count decision 9 uses.
5. The skill states decisions 1 to 5, 7, 9 and 10: the spec is the YAML file read from disk,
   the four source kinds, the hazard rule, the mechanism rule, the two points where the tool
   runs and that a failing spec launches nothing, the criterion count and the size-gate
   denominator.
6. The three named templates state decision 8, and an inverse-spec finding names the item id
   that authorizes a choice or reports its absence.
7. `skills/immaculate-spec-writing/SKILL.md` emits the format and states the source rules.
8. Tests cover the tool against a valid spec and against one spec per violation class of
   decision 6, and cover the skill and template wording. `bun test tests/` passes.
9. No occurrence of pin, pins or pinned remains in `skills/`, `agents/`, `docs/`, `tests/` or
   `README.md`.
10. The plugin version is bumped. Existing behavior is preserved: seat input boundaries, the
    one pass, source coverage, the verifier's guards, writer commit rules and the structured
    stage output contracts.
