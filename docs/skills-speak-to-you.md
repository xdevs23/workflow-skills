# Skills speak to their reader

The babysit-pr skill was the first skill written in this form, and the other skills follow it.

## The reader is "you"

The reader of a skill is the assistant that loaded it, and the system prompt already calls that
assistant "you". The skills used to name the same reader in the third person: "the agent" in the
reply, todo and visual-verification skills, "the root" and "the orchestrating session" in the
spec-writing skill, and both "the root" and "the orchestrator" in the implement-review-verify
skill, sometimes in neighbouring sentences. A third-person name makes the reader translate every
rule back to itself, and two names for one reader make a rule read as somebody else's job.

Every sentence that means the reader now says "you" or is an imperative without a subject. "The
root records every remaining item in the todo record" became "record every remaining item in the
todo record", and "the orchestrator inspects the result itself" became "you inspect the result
yourself". Headings that named the reader changed with the text: the implement-review-verify skill
now has an execution context section on your role and a stage's role, a completion checks section
and a question-premise check section.

The agents a skill starts keep their names: the implementer, the review seats, the finding
verifier, the fixer, the roaster, the copywriter, and the writing and reading stages. In the
implement-review-verify skill a few sentences used to give imperatives to a stage, such as the
instruction to implement, review, verify or fix as assigned. Those sentences now name the stage as
their subject, so every imperative in the skill means its reader and none means a stage.

## Text that keeps its wording

The paragraph near the top of the implement-review-verify skill that reserves the skill for the
root session stays word for word. It speaks to a subagent that happens to load the skill and tells
it that the skill's reader is the root session. A "you" in that paragraph would address the
subagent and could no longer say that.

Strings the shipped scripts send to a stage or check in a result keep their exact form wherever a
skill quotes them. These are the lane value `orchestrator-only`, the stage line that says a stage is not the orchestrator, the verifier action `root-action`, the
exit value `root-resolution` and the fixer prompt line in the example code that sends
disagreements to the root. In a stage's prompt the root is another agent, so it keeps a name there.
The list of what the AUTHORITY constant tells an authority-aware seat is written from the seat's
point of view for the same reason, and it still says that only the orchestrator edits a spec.

The descriptions of what the shipped scripts and the spec tool do, the passages that explain why a
rule exists, and the example code keep their wording where they do not name the reader.

## Rules are bullets

Steps and rules are bullets, one rule to a bullet, and each bullet opens with its instruction and
carries the facts that instruction needs. Passages that explain why a rule exists stay prose,
because a list would break them apart. Rules whose opener was a description now open with the
instruction, such as "Create every key empty" in the copywriting laws and "Never reword a spec so
that it gets past its reviewers" in the spec-writing skill. A bold principle that is itself
normative, such as "Authority lives only in the items", keeps its words.

Markdown joins two lists that follow each other into one. Where a list of rules directly followed a
list of another kind, the skills keep them apart with a sentence that carries content or with a
nested list. In the implement-review-verify skill, the rules that bind all fifteen review seats now
sit under their own subheading after the list of additional seats, and the decision actions of the
finding verifier are a nested list under the rule that it takes one decision per consolidated
group.

## Qualified names

A skill or an agent type named in a skill's text or example code carries the plugin prefix. The
implement-review-verify skill names `workflow-skills:implementer`,
`workflow-skills:finding-verifier` and `workflow-skills:resume-interrupted-run`, and its template
section tells the reader to invoke a role as `agentType:'workflow-skills:<role>'`, which is the form
the shipped scripts already use. The copywriting skill names `workflow-skills:copywriter`,
`workflow-skills:copy-source-verify`, `workflow-skills:copy-critic` and
`workflow-skills:implement-review-verify`, in its prose and in its example agent types. The
babysit-pr, resume-interrupted-run, spec-writing and visual-verification skills name the skills they
refer to the same way.

A name that is not a skill or an agent type stays as it is. The file names of the agent templates
stay file names, and the seat name `roaster` in a source ID stays a label.

## Meaning

Every rule, requirement, number, name, field, command and example the skills stated before is
still there with the same meaning, and no rule is added. The rewrite changes how the text addresses
its reader and how it is laid out.
