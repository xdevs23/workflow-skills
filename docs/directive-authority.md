# Directive authority and specification fidelity

## Required result

This document defines the target behavior, not a claim that the existing templates
or routing already satisfy it. Root and orchestrator name the same human-facing
coordinator, distinct from delegated stages.

A specification describes the implementation required by the human's decisions.
It does not make decisions, and its author gains no decision authority by writing
it. Human directives take precedence over a specification, assignment prompt,
review disposition or implemented behavior. A conflicting specification is an
error to correct, not evidence that a different decision was approved.

The orchestrator may document decisions the human made, but may not insert its
own product, architecture, persistence, security or operational choices as settled
requirements. Proposals and unresolved choices are not approved scope. Ordinary
implementation derivations must remain within the established requirements;
they cannot introduce a new decision under the label of an implementation detail.

Directive interpretation includes the surrounding discussion, supplied examples
and applicable project requirements. Absence of a particular keyword does not
license behavior that contradicts the established context. Conversely, an example
does not authorize unrelated features. The relevant context and the reasoning from
it must be checked, not replaced by an orchestrator's summary.

## Conflict reporting and review

Every discovered disagreement between human directives and instructions is a
critical authority conflict, including conflicts in the specification or the
orchestrator's assignment. It is explicitly hard-flagged and cannot become a nit,
soft ambiguity, optional suggestion or accepted limitation. The affected work
cannot proceed on the conflicting instructions or be accepted as complete.
A writer that discovers the conflict before editing stops without modifying the
tree; one discovering it later stops further conflicting writes and reports any
existing changes. The root resolves the instructions before that work resumes.
Hard-flagged reports and structured findings remain available in the exception
handoff with their originating stage and evidence, even when the cycle stops
before ordinary verification. Stopping must not erase the findings that caused it.

Spec compliance and inverse-spec review both check the private directive record
as well as the specification. Spec compliance retains its forward requirement
coverage; inverse-spec retains its reverse authorization check. Neither accepts
an assistant-authored specification as proof of a human decision. All inverse-spec
findings are CRITICAL, regardless of phrasing or perceived operational impact.
A no-findings report is still legitimate; critical severity is not a finding quota.

Every finding and report-level conflict from these reviews remains accounted for
through verification, correction and final acceptance. The verifier, fixer and
root each ignore the supplied categorization of inverse-spec findings and handle
all of them as CRITICAL. No finding is dismissed because it was labeled a nit,
soft ambiguity, optional suggestion or already covered by an edited spec.
Duplicate consolidation preserves all source identities and critical status.

Every inverse-spec finding requires root resolution: the spec is amended to
faithfully describe existing human decisions, or a genuinely unsettled decision
is put to the human after the question-premise check. Counterevidence to an
apparent false positive is preserved for root resolution, not used to silently
drop the finding. An edited spec is not sufficient closure: enforcement continues
against the original directives and context. The fixer retains inverse-spec origin
and critical status on received corrections even if an earlier stage downgraded
them; an absent source finding remains visible to the root rather than becoming
an unauthorized direct fix.

The root may correct a specification to faithfully reflect existing human
decisions. A new decision requires human authorization. Neither an amendment nor
a passing implementation test retroactively authorizes an unsupported addition.
Delegated implementers, reviewers and fixers do not edit the task specification.

## Questions and acceptance

Before presenting a question, trade-off, limitation or request for acceptance,
the orchestrator checks its premises against the human's directives and context.
When the record challenges a premise, the root investigates the mismatch first.
It identifies unsupported scope and reports deviations from the requested result
plainly, rather than presenting consequences of an invented mechanism as a new
choice the human must make. A question already settled by the record is not asked
again. Only a genuinely unresolved choice is presented as a decision request.
The private question check identifies the proposed question, its premises, the
relevant directive/context references, related spec/inverse-spec findings, and
whether the record already answers or contradicts it. Challenged premises are
resolved or explicitly reported as deviations before a new decision is requested.
This is an orchestrator obligation: tests can check the supplied instructions and
structured routing, but cannot prove that a future model interpreted context
correctly or actually performed this conversational check.

A preference to improve an otherwise faithful specification remains nonblocking.
It is distinct from an actual directive conflict or an unauthorized decision.
An implementation that does not yet satisfy coherent requirements remains normal
work for review and correction, not automatically an authority conflict.

## Confidentiality and boundaries

Verbatim directives and private context remain in ignored, untracked records unless
publication is explicitly authorized. Repository specifications contain technical
requirements, not conversational quotations, personal examples or private incident
narratives. Tests use synthetic scenarios unrelated to private incidents.

The root supplies the private record from the actual conversation, preserving
relevant directives, surrounding qualifications and supplied examples without
selective omission. References identify their source and ordering; summaries are
labeled and never substitute for available verbatim evidence. Applicable project
requirements are referenced alongside, not relabeled as human quotations. Record
content is fixed for a review cycle; new directives invalidate affected reviews
and approvals. Original verbatim directives are retained: never erase, truncate,
rewrite or selectively omit them to make a spec or implementation pass. Later
human decisions may supersede earlier instructions with explicit provenance;
an assistant's spec edits cannot. An inaccessible or incomplete necessary record is an explicit
root-action limitation that prevents acceptance, not permission to trust the spec.
No new storage service or public source-record format is required.

Authority-aware stages receive the relevant private record and may not claim
fidelity when necessary evidence is unavailable. Deliberately unbriefed quality,
cold-alternative and cold spec-review inputs retain their existing boundaries;
authority-aware checks do not depend on those unbriefed roles acquiring new inputs.

These requirements strengthen the existing authority pre-check, reviewer routing,
verification guards and root acceptance checks. They do not introduce a second
pre-write approval ceremony, mandatory human triage of every routine finding,
or permission to bypass the existing correction and snapshot safeguards.

## Acceptance criteria

1. Spec-writing and implementation instructions define specifications as derived
   descriptions, not independent sources of product or architecture decisions.
2. Root-authored decisions cannot enter a specification as approved human scope.
   Context and examples are considered without inventing unrelated requirements.
3. Both specification reviewers receive the private directive reference and flag
   directive conflicts explicitly, even when the implementation matches the spec.
4. Every inverse-spec source finding remains CRITICAL through consolidation;
   a mislabeled nit cannot become an advisory record or disappear in cleanup.
5. Directive conflicts in either a prompt or a spec stop acceptance and conflicting
   work. Structured findings and report-only hard flags cannot bypass the guard.
6. Every spec and inverse-spec source finding has an explicit evidence-backed
   disposition. False-positive rejection does not treat the spec as a veto over
   directives, and unresolved findings are not reported as accepted behavior.
7. The root checks question premises against the directive record before asking
   for a decision, with an explicit account of discovered implementation deviations.
8. Ordinary supported implementation derivations and nonblocking documentation
   suggestions remain distinct from conflicts; normal review and correction continue.
9. Tests check the verifier, fixer and root's unconditional inverse-spec instructions,
   preserved directive evidence, prompt/directive and spec/directive hard flags,
   report-only conflicts and existing clean and approved-correction paths. Any
   routing enforcement uses the known source identity, not a prose classifier,
   new severity taxonomy or inferred keyword match.
10. Privacy, unbriefed input boundaries, scoped writer permissions, source coverage,
    post-fix closure, concurrent immutable roasting and root acceptance remain intact.
