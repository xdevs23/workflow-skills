# Fixed review seats and a model for every agent

The review stage of every implement-review-verify run has fifteen fixed seats, and a copy of the
main script cannot run with fewer, more or other ones. Every agent of the three shipped scripts,
each review seat included, takes its model and effort from its own entry in the marked block, which
the root fills. A copy of any of the three scripts sets the name and description of its run.

## The fifteen seats

The review stage runs seven seats it had before and the eight audit seats: correctness, spec
compliance, the duplicate checker, quality, inverse-spec, the project rule reader, cold
alternatives, separation of concerns, abstraction quality, code smell, type safety, code
cleanliness, missing gaps, domain leakage and type smearing. Each loads the agent template of its
name. Their labels name their stages as `review:<label>` and their source findings as
`<label>:<index>`: `correctness`, `spec`, `dupes`, `quality`, `inverse`, `rules` and
`alternatives`, and for each audit seat the name of its template.

The cleanliness seat is gone. Its template, reviewer-cleanliness, is deleted, and its schema left
the main script with it, because the other seats already cover what it checked. The seats that give
a verdict per acceptance criterion are now correctness, spec compliance and the duplicate checker,
and only correctness and the duplicate checker receive the implementer's object as claims to
verify. Design documents of earlier units still describe the cleanliness seat as it was then.

## The audit seats

The eight audit templates judge the code through one lens each and ask for nothing about the spec.
Each audit seat therefore receives exactly what the quality seat receives: the hygiene floor and
the diff of every repository that moved. The hygiene floor holds the execution boundary, the
read-only Git rules, the rule against writing files, the rule on what a limitation is, the assigned
tree and the order not to wait in the background. An audit seat gets no authority block, no spec,
no private record and no implementer object, since any of them would brief a seat whose template
judges only the code.

The hygiene floor of the main script carries no order to read the writing-style file. The templates
of quality, cold alternatives and the eight audit seats let them open only the diff and the files it
touches, so such an order would send them to a file their templates forbid. Their findings go to the
finding verifier only, and the prose of the diff is checked by the project rule reader, which
receives the order through its authority block and reads the rule sources. The writers and the
other briefed seats keep the order through the authority block as well. The fix run's hygiene
floor keeps it too, because the scope check and the diff check that receive it read the tree.

An audit seat returns the object quality returns, `limitations`, `coverage` and `findings`, under
the quality seat's schema and the same completeness check. Its findings reach the finding verifier
with every other seat's findings, under source IDs of its label such as `code-smell:0`, and the
verifier supplies the recorded words for a kind-bearing finding of an audit seat as it does for
quality and cold alternatives. The eight templates are unchanged. They carry no execution-boundary
paragraph of their own, and their stages receive it through the hygiene floor.

## The seat check

The main script holds the fifteen required labels, `REVIEW_SEATS`, apart from its seat list,
`seatList`, and maps each label to the template its seat loads. The seat list is a function of the
implementer's claims, so the script reads its labels and templates before any agent runs, and the
review stage builds it again with the implementer's object. Before its first agent, the script
compares each label of the seat list, together with its template, with the required pairs and stops
with an error that names both when a seat is missing, added or listed twice, or when a label loads
another template. A label kept with a swapped template would otherwise run the wrong reviewer under
a name the verifier accepts. A sentence in the skill alone would not hold: a root that edits the
script below the marked block has already set such a sentence aside.

The finding verifier's template names all fifteen seats by label and template and checks that its
input holds one seat object for each. A seat whose object is missing is an unresolved issue of kind
root-action that names the seat, and never a seat that found nothing.

The implement-review-verify skill states the rule behind the check. No root leaves a review seat
out, rewrites a seat's template or the prompt text the script gives a seat, or removes anything
from either, whatever the size of the change, and the section on fan-out no longer lets a root drop
any review seat. The one exception is the note that resume-interrupted-run appends to the prompt of
an interrupted agent of a run being resumed, which adds and removes nothing else. The example in
that skill names the spec compliance seat where it named the cleanliness seat.

## A model for every agent

The marked block of each shipped script holds one entry, a model and an effort, for every agent the
script starts. The main script has entries for `gate`, `impl`, `verify`, `fix` and `roast`, and its
`review` entry holds one entry per seat, keyed by the seat's label. The fix-run script has `gate`,
`scope`, `fix`, `roast` and `diff`, and the spec review script has `gate`, `gaps`, `soundness` and
`provenance`. Every model ships as a placeholder in angle brackets, the launch check's included, so
no shipped script and no agent template names a model and the root sets every one.

The helper `checkModels`, with the same text in all three scripts, runs before the first agent. It
stops the run when an entry is missing, when its model or its effort is empty or still a
placeholder, when the block holds an entry for a name the script does not have, such as a seat
outside the fifteen, or when an entry holds any field besides the model and the effort. The stage
options spread the entry, so a field such as `agentType` would replace the template of the agent it
starts. Each review seat then runs on its own entry, so a seat that reads whole files,
such as the rule reader, can get a model with a larger context than the others.

## Names of runs

Each of the three shipped scripts carries `kebab-name` and `one line` as the name and description
of its meta block. A copy of any of them sets a kebab-case name and one line saying what the run
does, and changes nothing else outside its marked block. The fix-run and spec review scripts used to
ship fixed names, so every fix run and every spec review appeared in the workflow list under the
same name.

## A note for the implementer

A note for the implementer, such as the transcript of an earlier attempt it can read, goes into
`implementerPrompt` in the marked block, and nothing below the block changes for it. The
implementer still starts clean at the start commits of the base list, so such a note carries over
committed work only, through the base list, and never uncommitted changes.

## Tests

The routing tests run each shipped script as a copy whose model placeholders hold a model named
after their entry, so every call shows the entry it ran on. They check that the review stage runs
exactly the fifteen seats with their templates, that each audit seat's prompt equals the quality
seat's prompt of hygiene floor and diff, and that an audit seat's finding reaches the verifier under
a source ID of its label. They check that the prompts of quality, cold alternatives and the audit
seats name no writing-style file, that the prompts of the writers and the briefed seats name it
once, and that the fix run's scope check still receives it. They check that no file under the
skills, agents, tools and tests directories, and not the README, names the removed template, and
that the finding verifier's template names the fifteen seats. They check that a copy whose seat
list leaves out, adds or repeats a seat, or gives a seat's label another template, stops before its
first agent, that each seat runs on its own model entry, and that a missing, placeholder or unknown
model entry, or an entry with a field besides the model and the effort, stops each of the three
scripts before its first agent. They check that no shipped script and no agent template names a
model, and that a copy of each script sets its own meta name and description.

## Rejected alternatives

Keeping cleanliness as a seat with its separation-of-concerns part removed was rejected. Once it
was clear that the other seats cover what it checked, the seat was removed entirely.

One review model for all seats, with the root picking a model whose context fits the largest seat
on a large change, was rejected. The root sets the model of every single agent, each review seat
included.
