# Part 16: the project's own records

A harness is only used when the project's records say it exists and when it is required. The
adopting project therefore adds two records: an entry in its instructions and a harness contract
with its scene documentation. Both are tracked documents of the project, and both state rules as
neutral engineering law.

## The entry in the project's instructions

The project's instructions, the file its agents and contributors read first, gain one entry for the
harness. The entry names the harness and the command that runs it, requires the harness for every
change to rendered output, and points to the harness contract. It states the working practice in a
few sentences: pick or curate a scene, capture the unchanged interface, implement only the approved
change, capture again, compare, and open the images. It names the location of exploratory scenes as
the harness directory inside the project cache, the location `workflow-skills:local-cache` defines.

A project that requires visual evidence on pull requests states that rule where its pull request
rules live: for every changed surface one evidence sheet from a capture on the base commit and one
on the candidate, listed as an attachment and shown under its own heading in the description, and
the exception for a pull request whose commits change no rendered output, which says so in its
description.

## The harness contract

The harness contract is the project's own document of its harness. It is written during adoption and
kept current with every change to the harness or its scenes. It holds the following sections, each
a record of this project's facts:

1. Status and purpose: what the harness answers, what it is not, and what has and has not been
   verified, with the verification boundary of part 13 stated openly.
2. Integration points: the filled table of the survey of part 1.
3. Operator flow and commands: every verb with a complete example invocation from the repository
   root, what each prints, the capture name rules, and the exact runtime, engine and library
   versions the project locked.
4. Implementation responsibilities: the components and what each owns, with the adaptation points
   of every guide part and their values.
5. Scene documentation: one entry per scene.
6. Samples and privacy, when the harness has a refresh.
7. Drift, receipts and comparison, including the recorded comparison options and the diff coloring
   parameters; a change to the coloring's radius or margin is recorded here as a tooling decision.
8. Rejected alternatives with their reasons, as part 18 lists them.
9. Acceptance criteria, as part 17 generalizes them.
10. Recorded verification: for each criterion or group of criteria, the captures and runs that
    verified it and what they showed, with observed product findings listed apart.
11. Engineering process: the working practice, where exploratory scenes live, where reports and
    comparisons are written, and the rule that capture and comparison names are exclusive.
12. Production impact: that the harness changes no application behavior or data and needs no
    migration, and how the production artifact is inspected.

## Scene documentation

Every scene has one entry, and a scene without an entry is not yet curated. The entry holds the
scene's question, stated as the concrete interface question it answers; what it opens or mounts, the
real route or screen for a page scene and the real component with its container for a component
scene; the fixture, with the main record's shape, the edge values it carries and every declared
response or the statement that it declares none; the variants, where they differ from the shared
set; the interactions in order; the named checkpoints with what each captures; the required checks
with their tolerances; and the diagnostic measurements with the product findings they record.

An entry says when the scene was curated ahead of a change and when a later change extended it, so a
reader knows which checkpoints prove which change. A checkpoint that proves a layout stayed the same
says so, such as the wide layout's checkpoints staying pixel-identical when only the narrow layout
changes.

A diagnostic finding has no approved fix in the scene entry. The entry records it as a product
finding, neither acceptable nor repaired, until a product decision turns its requirement into a
required check.

For example, an entry for an item editor scene states the question whether the rows of the item's
attribute list fill their rows and whether a save sends exactly the changed attributes. It opens the
real editor route with a synthetic item carrying short attributes, one long unbroken value and one
attribute in a second language with longer words, over the complete shell responses. It captures the
loaded shell, the attribute list, the edited list, the saved list and the list after a reload. It
requires every row's controls to reach both edges of the row's content box within one pixel, the
save body to contain only the attribute list, and the reload to show the saved values.

## Web realization in the reference

The reference kept its contract as one Markdown document in the application's documentation folder
and its instructions entry as a short rule in the repository's agent instructions file. Its contract
ended with a table of recorded synthetic verification per group of acceptance criteria and a
separate observed product finding for its long-value scene.

## Native and terminal realizations

The records are the same for every platform. A native or terminal project names its emulator or
simulator images, device profiles or terminal emulator in the operator section, and its scene
entries name screens, views or terminal states in place of routes.
