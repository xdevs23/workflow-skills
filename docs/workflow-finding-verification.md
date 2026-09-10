# Verify and consolidate findings before fixing

## Required behavior

Keep routine finding verification inside the workflow. A read-only `finding-verifier`
checks and consolidates every reviewer's findings against the code and human directives,
with the specification as a derived description of the required implementation. A
separate fixer receives only its approved corrections. The root handles exceptions,
not every review round.

[Directive authority](directive-authority.md) governs specification fidelity, critical
inverse-spec findings and the root's question-premise checks. Human directives veto
conflicting specifications and prompts; writing or accepting a spec does not create
decision authority. Neither the verifier nor the root may ignore specification reviews
or use the spec alone to dismiss contradictory directives. The verifier, fixer and root
ignore supplied categorization and treat every inverse-spec finding as CRITICAL. Every
one requires root handling, including apparent false positives and findings whose spec
has since changed. Original private directives remain intact and enforceable.

The main sequence is Implement → Review → Verify → Fix. Review includes the concern
reviewers, quality, inverse-spec, rule reader and cold alternatives on a clean committed
snapshot. The mandatory roaster runs alongside Fix, reading only immutable Git objects at
the pre-fix SHA and receiving the approved fix list. Its findings join the next Verify
pass against the resulting snapshot. After a committed fix, repeat Review → Verify before
claiming closure. The cold spec-review pre-run remains separate and unchanged.

## Responsibilities

- **Reviewers detect.** Spec compliance checks explicit requirements forward into the
  implementation. Inverse-spec traces implementation choices back to authorization.
  Quality remains unbriefed. The rule reader checks full changed files against rules.
- **The finding verifier verifies and consolidates.** Inspect the actual code and
  authority sources, merge duplicate findings without losing their source IDs, resolve
  conflicts using evidence, and disposition every source finding exactly once. A
  reviewer-assigned severity or lane is not permission to edit. Inverse-spec findings
  always retain CRITICAL classification, including mixed-source consolidated groups;
  directive conflicts are hard flags, never advisory records. All inverse-spec decisions,
  with their source identities and evidence or counterevidence, remain unresolved root
  handoffs rather than routine internal rejections or cleanup.
- **The fixer fixes approved work only.** Independently check each approved correction,
  preserve its constraints, and return `fixed`, `rejected` or `blocked` for each key.
  It cannot broaden scope, edit authority documents or turn raw reports into work orders.
  Received inverse-spec corrections remain CRITICAL regardless of upstream labels or spec
  edits; a rejected or blocked correction retains its origin and counterevidence for root.
- **The root resolves exceptions.** Every inverse-spec finding, demonstrated impossibility,
  verifier/fixer disagreement and bounded non-convergence returns with evidence. The root
  handles each inverse-spec finding by correcting the spec to describe an existing human
  decision faithfully, or asking about a genuinely unsettled choice after checking its
  premises. Counterevidence remains part of that handling, not permission to drop a finding.
  A failed required reviewer or invalid handoff stops the run as incomplete verification.
  Neither uncertainty nor a failed check is silently treated as approval.

## Execution roles

The orchestrator owns skill loading, workflow construction, scheduling and completion checks.
Each stage performs only its assigned role and returns its result; it never launches workflows
or subagents, including indirectly through a skill or shell command. Enclosing orchestration
is responsibility for remaining checks, not evidence that those checks have passed.

The caller supplies required stage instructions when the stage cannot load them, without
briefing cold reviewers or widening source access. A matching skill may supply instructions,
not a second orchestration duty. Missing orchestration tools alone do not block an executable
stage. Genuinely missing assignment capabilities or instructions, missing authorization and
conflicting applicable requirements remain explicit limitations. Inherited workflow mandates
must be scoped to orchestrators at their source, not overridden by lower-priority child prompts.

## Immutable snapshots and concurrent roasting

Implementer and fixer have narrow permission to create new scoped commits in the isolated
worktree after checks, returning `startSha`, a full `snapshotSha` and clean status with quoted
Git evidence. Start clean; stage explicit paths only; inspect the staged diff; preserve
hooks and signing. No broad add, unrelated changes, amend, reset, rebase, merge, branch
switching or push. Genuine no-ops and proof-only passes reuse the starting SHA rather than
creating empty commits. Local TODO.md and scratch remain ignored and untracked. Check failures,
commit failures or dirty results cannot become successful snapshot handoffs.

The root supplies the immutable base SHA. The roaster reads base/snapshot Git objects only,
using `git diff --no-ext-diff --no-textconv`, `git ls-tree`, `git show SHA:path` and pinned
`git grep`. It has only Bash, not filesystem Read/Grep/Glob tools; it may not run source-tree
scripts, build, follow symlinks into the filesystem or invoke external diff/textconv helpers.
The fixer's expected HEAD movement is harmless because the roaster never uses moving refs.
This is a prompt/tool contract, not a shell security sandbox.

Capture the pre-fix SHA and approved list before launching fixer and roaster together. The
list is planned work, not proof: avoid repeating assigned defects, but flag inadequate
corrections, interactions and gaps. Await both tasks even if one fails. Preserve any available
result and report a missing or unprocessed roast explicitly rather than silently completing.
The verifier independently checks the resulting clean commit and rechecks stale roast receipts
against its current code; already-fixed findings are rejected with evidence.

An empty fix list still launches proof and roast together, then verification of the roast.
Ordinary reviews are reused when that proof-only snapshot has not changed. No second roast
of the final commit is required merely to repeat the post-fix independent review: every
fix/proof pass has its concurrent roast, and every roast must be processed before completion.
The fix budget counts code-fix passes; a final verification may still attest the last pass
and process its roast even when no further code-fix budget remains.

## Handoff and termination

The script assigns immutable source IDs by round, seat and finding index. The verifier
returns consolidated decisions, each naming one or more source IDs. Every input ID must
appear exactly once: missing, duplicate or invented IDs are protocol failures.

Decisions are `approve-fix`, `reject`, `needs-decision`, `root-action`, `cleanup`, or
`record`. An approval includes verified evidence, authority citations and exact quotes,
the permitted correction, constraints and an acceptance check. `record` is for genuinely
non-blocking observations; it cannot dispose of a confirmed must-fix or critical defect.
`cleanup` records verified out-of-scope work for the final cleanup handoff rather than
expanding this unit. Rejections require counterevidence, not a tone or taste label.

Directive conflicts hard-flag the affected work, whether the conflicting text is a spec
or an assignment prompt. Missing necessary directive evidence requires root action;
neither case can be relabeled as a nonblocking spec suggestion. Other blocking decisions
require a genuinely unresolved choice or impossibility. An optional improvement to an
otherwise faithful spec is nonblocking: ordinary implementation and reviews continue.
The existing authority pre-check is strengthened, not replaced by another approval gate.
Stages never edit the spec; the root records only human decisions and corrects transcription
errors without inventing new scope. Ordinary evidence-backed rejections, consolidation and
successful fixes remain internal. Inverse-spec findings are the explicit exception: every
one reaches root with its evidence and counterevidence regardless of disposition. Neither
`reject`, `cleanup`, `record`, a successful code fix nor an edited spec retires that handoff.
Enforcement continues against the original directives after root corrections; later human
decisions can supersede earlier instructions only with preserved source provenance.

The verifier also independently checks each prior fix claim and returns a closure verdict.
The script requires exactly one verdict per pending key. A fix still unresolved after
independent checking returns as a failure to converge; the fixer is not repeatedly sent
an unchanged demand. New findings may form another approved list within the round budget.

The script owns persisted history and passes relevant prior dispositions to the verifier
as untrusted context. Ordinary detection seats stay cold across rounds: no prior findings or
fixer explanations, only an updated snapshot reference. The roaster is deliberately informed
by the current approved fix list. Each source ID retains its original snapshot; a carried
roast is not relabeled as a finding on the post-fix commit. Consolidation happens in the
verifier, not through heuristic string matching or silent retirement of a reworded finding.

Any exit after writes without independent verification reports pending fixed keys as
`unverified` and the tree as unreviewed. A proof-only pass has no approval to write. A green
suite is necessary evidence, not proof that every requirement has been independently checked.
Reports and structured results remain in workflow journal artifacts. The final return carries
counts, proof, cleanup entries and genuine exceptions with stage labels for retrieving details,
not another copy of every raw reviewer report into the root's context. No separate queue
service or new runtime pause mechanism is needed.

## Rule compliance and cleanup

The rule reader checks every changed file in full, including adjacent violations of
applicable project/global rules. Confirmed violations are CRITICAL regardless of existing
house style or age. Operational impact is reported separately from this compliance label.
The verifier approves authorized in-scope corrections; unrelated existing violations become
consolidated cleanup entries, not additional work forced into this unit's fix loop.

The root records those entries in the project's `TODO.md` during the same run, before
reporting the task finished, and schedules cleanup promptly. Each entry identifies the issue,
rule, code receipts, source findings and required correction. Update an existing entry rather
than duplicating it. A recorded issue remains open work, not a completed fix. The handoff also
applies to incomplete workflow exits; if writing is blocked, report that explicitly.

`TODO.md` is local and untracked by default. Track and commit it only on an explicit user
request. The root checks existing contents and tracking status before writing and ensures an
untracked file is ignored through the repository's local Git exclude file where needed.
It does not silently delete or untrack an already-tracked TODO, nor treat a broad staging or
commit command as permission to include it. An existing tracking conflict without recorded
permission is returned for direction. Readers and the verifier remain read-only.

The concrete handoff instructions live in the skill's **Rule violations and local cleanup
records** section. No separate TODO writer or automatic Git mutation is added to the workflow.

## Root completion checks

Cycle completion is separate from acceptance and integration. The workflow returns acceptance
as `pending-root-checks`, even when its review/fix cycle is complete. Root acceptance
accounts for all spec and inverse-spec findings, including early hard-flag exits and
counterevidenced rejections. Spec edits do not waive original directives or finding closure.

Before presenting a question, trade-off, limitation or acceptance request, the root privately
identifies its premises, relevant directive/context references and related spec/inverse-spec
findings. Investigate any challenged premise first, disclose unsupported implementation
plainly, and do not ask again about a decision the record already settles. Ask only about
genuinely unresolved choices, not whether to accept consequences of invented scope. Preserve
the original private record; root edits cannot rewrite, truncate or selectively omit it to
force agreement. Tests establish instruction wiring and routing, not future interpretation.

After every run the root inspects actual stage durations, including retries and cached replay,
names the biggest time sink, and removes avoidable waiting, repeated discovery/checks or rework
at the source within authorized scope. Parallel stage durations are not additive wall time.
Missing timing data is reported honestly. Required checks and cold-review boundaries remain;
no arbitrary time ceiling or automatic model escalation is added.

Before accepting a spec-governed candidate, the root measures added implementation lines divided
by non-blank spec lines, using the final immutable candidate/spec and declared comparison base.
The report identifies the merge base, candidate and spec blob, implementation added/deleted
counts, separate test counts, and exclusions for tests, Markdown documentation, lockfiles,
generated files and binaries. The skill defines the repeatable counting rules and arithmetic
helper. Display one decimal but compare unrounded counts: above **20:1** blocks acceptance;
exactly 20:1 passes only this gate. Missing counts or an empty required spec cannot pass.
A genuinely no-spec targeted patch reports the ratio as not applicable, not a manufactured spec.

On a breach the root first examines inverse-spec findings and traces size to requirements:
remove overbuilt code through the approved correction/review path, or clarify genuinely missing
spec detail where existing authority supports it. Only the root edits the spec. Never pad it to
improve a ratio, retroactively authorize unsupported additions, or weaken required behavior to
shrink code. Remeasure and reverify after changes. Any remaining justified excess needs explicit
approval for that exact candidate/spec, after presenting the diagnosis and concrete savings;
keep conversational approval private. This is a finished-unit gate, not another implementer
pre-check or a reason to block executable work merely over a spec suggestion.

Integration remains project-defined: PR, direct merge, Git bundle, patch file or another explicit
handoff. Snapshot commits do not authorize integration or transmission. Gate breaches remain
visible on draft artifacts and cannot be bypassed by changing delivery format. A project without
a defined route receives a verified candidate with integration pending, not an assumed merge.

Keep worktrees under an ignored project-local directory. Before removal, verify clean state,
preserve meaningful ignored/untracked files, and establish the chosen handoff's durability:
branch containment or integrated content for a merge, the retained PR source and its completion
condition, verified bundle objects/prerequisites, or patch reconstruction against its base.
Required delivery must have evidence of receipt. Artifacts inside the doomed worktree are not
preserved. Read verification results from one tool call, then remove in a separate authorized
call—never a chained check-and-delete or forced removal. Branch deletion is separate permission.

## Boundaries and alternatives

- **Root checkpoint every round — rejected.** Verification against existing authority
  does not need the root's judgment. Routing all reports there consumes root context and
  adds avoidable interruptions. Reserve it for explicit exceptions, including every
  inverse-spec finding, disputes and genuinely unsettled choices.
- **Combined verify/fix agent — rejected.** Consolidation and approval should happen before
  mutation, independently from the agent that implements the correction.
- **Mechanical findings straight to the fixer, adversaries always to the human — rejected.**
  A real authorized correction can originate in any seat; a confident ordinary reviewer
  can also be wrong. All sources pass through the same independent verification.
- **Repurpose `verifier` or `consolidator` — rejected.** Those existing roles verify entire
  document artifacts and faithfully merge research respectively. Their contracts are
  different; changing them would affect unrelated workflows.
- **Treat approval as new authority — rejected.** The verifier interprets the record. It
  cannot authorize a new design choice or retroactively legitimize an unsupported addition.
- **Automatic stage escalation through repeated retries — rejected.** Protocol retries are
  bounded; semantic disagreements return to the root with evidence, not an internal argument.
- **Roast the live tree alongside a writer — rejected.** Receipts could span partially applied
  edits. Pin Git objects instead; a moving HEAD cannot change their contents.
- **Copy or create another worktree just for the roast — rejected.** Scoped commits already
  provide immutable content. Another checkout adds work and cleanup without improving that guarantee.
- **Keep all writers Git-read-only — superseded.** Clean snapshot commits are now required.
  The permission is deliberately narrow and does not extend to readers or integration operations.

## Acceptance criteria

1. Worktree readers finish before verification; only the immutable Git-object roaster overlaps
   the fixer. Both concurrent tasks finish before their results are processed.
2. One verifier receives all source findings and reports, including adversaries.
3. Every source finding belongs to exactly one consolidated decision; invalid coverage fails.
4. Only approvals with evidence, authority, boundaries and acceptance checks reach the fixer.
5. Directive conflicts stop conflicting work and acceptance with preserved evidence;
   demonstrated impossibilities and missing necessary authority also require resolution.
   Optional improvements to a faithful spec do not block ordinary work. Stages leave the
   spec untouched, and the root adds no decisions of its own.
6. Fixer disagreements return to the root with the approved item and counterevidence.
7. Independent closure is required after writes; post-fix exits preserve unverified state.
8. Clean runs and routine consolidation do not require a root checkpoint. Every inverse-spec
   finding remains CRITICAL at verifier, fixer and root regardless of its supplied labels;
   every disposition preserves an unresolved root handoff with source evidence. Rejection,
   cleanup, consolidation and spec edits cannot silently retire it.
9. Quality receives no spec, directives or implementation briefing; other seats retain their
   own input boundaries, and spec compliance does not duplicate inverse-spec authorization.
10. Research/spec-writing instructions preserve human decision ownership and directive veto.
    Existing research coverage, model policy and cold spec pre-review input boundaries remain.
    Gates still run bare after the last write.
11. Confirmed adjacent rule violations retain CRITICAL classification and a same-run cleanup
    handoff without extending the current fix loop; TODO.md stays untracked unless explicitly
    requested tracked and committed. Existing tracked files are not silently removed or untracked.

12. Every successful writer returns a clean immutable scoped commit; proof-only and no-op
    passes reuse their starting SHA. Readers retain no Git mutation permission.
13. Roasting is mandatory for every fix/proof pass, takes the pinned pre-fix SHA and approved
    list, and cannot read the moving source filesystem. Its findings are verified post-fix.
14. Missing, failed, wrong-snapshot or unprocessed roasts prevent completion. Unchanged
    proof-only snapshots do not cause repeated ordinary reviews.
15. Root completion checks inspect real stage timings without weakening review or proof.
16. Above 20:1 added implementation/spec lines blocks acceptance pending root diagnosis and
    correction or explicit candidate-specific approval. Rounded display cannot hide a breach.
17. Integration method is project-selected. Worktree cleanup follows separately inspected
    preservation and handoff evidence, without implicit push, merge or branch-deletion permission.
