# The root makes no decisions

The orchestrating session of the implement-review-verify workflow decides nothing about a unit's
code or product. The user decides what genuinely needs a decision: a product decision, a change of
the product's scope or of what the user sees and does. Every other choice is made by the stage that
writes the code, with the user's words, the rules and the plugin's skills as its guide.

## What the orchestrating session does

The orchestrating session assembles the unit spec from the user's words, launches runs, attests the
fixes a fixer reports, records what a run returns, and passes questions on. It puts no decision of
its own into a spec, and it reads no finding, open decision or roast finding to sort, check or decide
it. A question reaches the user only as a stage raised it: the implementer's sense-check flag or a
question a fix run's fixer returned. The session shows it as the stage wrote it, with no recommended
option of its own.

## How findings are handled

What a run returns to be fixed goes, as its journal holds it, to a fix run. The spec tool writes the
fix list from the parent run's journal with `--make-fix-list`: every decision of the finding verifier
except a cleanup decision and an approved correction its fixer reported fixed, every finding of the
review seats in a run without a verifier, such as a review pass, and every finding of the roaster
and the diff check. The list names the spec the parent run checked. Nobody adds, removes or edits an
entry, and nothing is attached to one, so no reading of the orchestrating session steers the fix.
Cleanup decisions name work outside the unit and go to the todo record as units of their own.

A fix run's fixer receives every entry and the parent unit's spec. It resolves each entry with the
user's words, the rule sources and the engineering-principles and code-writing skills as its guide.
Before it returns anything but a fix, it looks for every applicable rule and skill that says what to
do or authorizes the change. A rule or a skill that calls for ripping code out authorizes the
rewrite, and the rewritten code does the same thing in the same way as the code it replaces. The
fixer returns a question only for a product decision that no rule, skill or word of the user
decides, and only after checking that the question is valid: whether to keep a known defect, to
break a rule because the existing code is already bad, to update many places instead of fixing the
one place they should all read from, to tolerate input without a technical reason, to revert an
improvement or to reopen approved work is never a valid question.

A read-only diff check maps every change of the fix to an entry. A change that maps to no entry, or
that changes the product's scope or what the user sees and does where neither the entry, the user's
words nor a rule calls for it, is a CRITICAL finding, and it goes to the next fix run like every
other finding.

## The implementer

The implementer reads the same two skills as its guide. Before its sense check fails, it looks for
every applicable rule and skill. Where the user's words, a rule or a skill call for rebuilding the
code the request would grow, it rebuilds it to the same behavior. Only a product decision none of
them decide fails the check, and the flag reaches the user as the implementer wrote it.

## Decisions

**The root decides nothing.** A root that read the rules itself and wrote its readings into specs
as decisions put its own interpretation of a rule between the user's words and the implementer, and
the review stopped such runs as specs with assistant decisions in them. The stage that writes the
code is the one that applies the rules, and the review checks what it built.

**Findings go to the fix run unread.** A finding is a claim, and the fixer is the stage that checks a
claim against the tree. A root that sorted findings or attached its own pointers biased the fix
toward a solution it could only assume.

**The invalid-spec rule stays.** An assistant entry that decides a product or architecture question
no user entry decides still makes a spec invalid. With the root deciding nothing, the rule stops
exactly the decisions the root must not make.

**The root still attests fixes.** Reading a fixer's commits and running the checks verifies a claim
and decides nothing.

## Rejected alternatives

**A choice an applicable rule decides counts as decided in the spec.** Reason: rule-based choices are
implementation details the implementer makes; the agents read the rules themselves, and a root that
writes its reading of a rule into the spec as a decision can twist the rule.

**The fix run keeps its scope check, with the new job of sorting entries into those the rules settle
and those that need the user.** Reason: resolving the findings and checking whether a question is
valid is the implementer's job, so the fixer sorts and resolves every entry itself.
