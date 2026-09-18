# Work execution rules

## Required result

Twelve recorded rules about how work runs reach the tree, each one written into the skill or the
template that already governs its subject. No rule is a tool, a script or a schema field: each one
is a judgment a reader applies, so each one is prose in the file whose reader applies it.

## The twelve rules and where each lives

1. **Screen before escalating.** The root is the judge and acts on its own conclusion. A finding
   from a reviewer or a critic is a claim: the root verifies it, then fixes it or rejects it with a
   stated reason, and never passes the claim itself to the user as a question. Anything headed for
   the user passes one screen first: is the item in fact a rule violation or an architecture
   problem that another read of the recorded words would close? A choice the recorded words settle
   is never asked, and a choice the record genuinely leaves open still reaches the user after the
   screen. It lives in the root question-premise section of the implement-review-verify skill,
   beside the drift and decide-or-ask material it restates.
2. **A reviewer suggests and never decides.** A review seat proposes, the finding verifier
   authorizes, and the user decides anything that changes what the product does. Behavior nobody
   approved is a decision. Behavior added without authority is removed as an unauthorized addition,
   which the inverse-spec template already prescribes, and only a choice that removing the behavior
   cannot close reaches the user. It lives in the review phase section of the skill and in the
   correctness, cleanliness, spec-compliance and inverse-spec templates, each in its own words.
3. **The quality bar.** A change is measured against modularity; an architecture whose structure
   carries the cases instead of conditionals bolted onto one generic path; a generic mechanism that
   never learns the specifics of one concrete type; and package names that describe the project
   instead of a person. It lives in its own quality bar section of the skill, immediately before
   the rationale section.
4. **Native mechanisms over invented markers.** Where the platform, the library or the tool already
   expresses the thing, that expression is used. A sentinel value, a magic string or a marker
   invented to carry meaning the native mechanism already carries is a defect, because every reader
   and every later tool has to be taught the private convention. It lives in the same quality bar
   section.
5. **Two relocations mean the cause is untouched.** When the work record shows the same defect
   moved twice, the third change fixes its cause instead of moving it again, and a third relocation
   is refused with the cause reported. The count lives in the work record entry, which is amended
   instead of duplicated. The rule lives in the remaining-items and follow-up section of the skill,
   where a defect surviving into a later run is recorded.
6. **No claim about an external system without observation.** A statement that an external system
   misbehaved requires an observation of that system misbehaving, quoted. A symptom is evidence
   that something happened, never evidence of which component caused it, so an attribution drawn
   from a symptom is a hypothesis and is labelled one. It extends law 12, which already states that
   code-reading loses to observation.
7. **The shape of a decision request.** An ask is one short sentence with the question alone on its
   own line. An answer approves only what it literally names, so a change of scope or shape spends
   the previous yes and needs a new one. The construction that pairs a question with a stated
   intention to proceed anyway is forbidden in any wording. It extends the decide-or-ask material
   in the root question-premise section.
8. **Every active run is inspected at least every thirty minutes.** The observation is the run's
   journal and the per-agent transcript files in the run directory. The signal is an agent whose
   transcript has not grown and whose stage has produced no journal line for the interval. The
   response is to read that agent's transcript, then either stop the run and record why, or record
   why it is still progressing. This is separate from the twenty-minute soft ceiling on one agent's
   task, which is measured after the fact and stays unchanged. It lives in its own in-flight
   subsection immediately before the post-run timing review.
9. **The reviewer rule reaches the templates.** Rule 2 appears in the correctness, cleanliness,
   spec-compliance and inverse-spec templates. The unbriefed templates are excluded by design:
   quality, cold alternatives and the roaster receive no briefing text, and the duplicate checker
   and the rule reader are covered by the skill section alone.
10. **What a spec establishes before it is written.** Before drafting: whether the thing is already
    implemented; what already exists that the work can build on; what needs refactoring first; what
    the work conflicts with; and how the applicable rules shape it. Each answer comes from reading
    the codebase and the rules, never from memory. It lives in the inputs section of the
    spec-writing skill.
11. **Keys start empty.** An i18n key is created empty and the copy pass fills it. Placeholder text
    in a key is forbidden because it reads as finished copy. It lives in the laws section of the
    copywriting skill, beside the law that copy comes first.
12. **The check tolerates an empty key.** An empty value is the declared starting state of a key,
    so the source-language leak check treats identical empty values across locales as the expected
    state instead of a suspected leak. It lives in the multilingual section of the copywriting
    skill and builds nothing new: it states how the existing check reads the state rule 11 creates.

## Decisions

1. **Placement follows subject.** Each rule goes to the file that already governs what it is about,
   so a reader who arrives at that file through search or a prompt meets the rule where the
   decision it constrains is made.
2. **One decision recorded once stays with the duplicate checker.** The fifth item of the recorded
   quality bar is deliberately absent from the quality bar section: the duplicate checker template
   and the review phase section already own that lens, and the section names that seat instead of
   repeating the rule.
3. **Nothing here becomes a check or a schema field.** Every one of the twelve is a judgment a
   reader applies.

## Rejected alternatives

* **All twelve in the writing-style skill.** Most of these rules govern how work runs and not how
  text reads, and putting them in one file contradicts the placement decision above.
* **A new skill for work execution.** Each subject already has a file that governs it: the implement
  workflow governs reviews, fixes and escalation; the spec skill governs spec preparation; the
  copywriting skill governs strings. A thirteenth skill would split each subject across two files.
* **A new numbered law for the external-system rule.** The laws are cross-referenced by number and
  asserted by the suite, and law 12 already states the observation principle the rule extends. A
  seventeenth law would restate a law instead of adding one.
* **Repeating one decision recorded once in the quality bar.** The duplicate checker already owns
  it, and repeating it would break the bar's own third item on its first reading.
* **Enforcing the rules with script checks or schema fields.** A check that could verify a judgment
  of this kind does not exist, and inventing a marker for one is exactly what rule 4 bans.
* **A new test file.** The documented test command in the README names both existing test files, so
  a third file would leave that command incomplete.

## Boundaries

The unit adds rules. It sweeps no existing wording, renames nothing, and revisits none of the
vocabulary the older skills are built on. Where a rule contradicts a sentence already in one of its
destinations, the contradiction is reported instead of resolved by rewriting unrelated prose.

## Acceptance criteria

1. The root question-premise section states rule 1, including the boundary that a choice genuinely
   left open still reaches the user after the screen.
2. The review phase section states rule 2, including that unapproved behavior is a decision and
   that behavior added without authority is removed instead of asked about.
3. The skill carries a quality bar section immediately before the rationale section, stating the
   four items of rule 3 and naming the duplicate checker as the place the fifth lives.
4. The same section states rule 4.
5. The remaining-items and follow-up section states rule 5, written against the work record entry.
6. Law 12 states rule 6.
7. The decide-or-ask material states rule 7.
8. An in-flight subsection sits immediately before the post-run timing review and states the
   observation, the signal, the response and the distinction from the twenty-minute per-agent
   ceiling, which is unchanged.
9. The correctness, cleanliness, spec-compliance and inverse-spec templates each state rule 2.
10. The spec-writing skill's inputs state the five checks of rule 10.
11. The copywriting skill's laws state rule 11.
12. The copywriting skill's multilingual section states rule 12.
13. This document states the twelve rules, their placement and the rejected alternatives, carries
    no verbatim user words, and is linked from the quality bar section and the in-flight
    subsection.
14. `tests/workflow-routing.test.js` asserts criteria 1 to 13.
15. The plugin version is bumped, and every file outside the destinations named above is unchanged.
