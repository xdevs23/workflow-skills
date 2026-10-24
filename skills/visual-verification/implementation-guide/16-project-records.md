# The records in the project

A harness is used only when the records in the project show that the harness exists and that it is
required. The project that adopts the harness therefore adds two records: an entry in the project
instructions and a harness contract with the scene documentation. Both are tracked documents in the
project. In both, rules are written as neutral engineering law.

## The entry in the project instructions

The project instructions, the file read first by agents and contributors of the project, gain one
entry for the harness. The entry gives the name of the harness and the command that runs it,
requires the harness for every change to rendered output, and links to the harness contract. It
describes the working practice in a few sentences: pick or curate a scene, capture the unchanged
interface, implement only the approved change, capture again, compare, and open the images. It
gives the harness directory inside the project cache, the location defined by
`workflow-skills:local-cache`, as the location of exploratory scenes.

A project that requires visual evidence on pull requests writes that rule next to the other rules
for pull requests in the project. The rule requires, for every changed surface, one evidence sheet
from a capture on the base commit and one on the candidate, listed as an attachment and shown under
a separate heading in the description. It also contains the exception for a pull request whose
commits do not change rendered output. Such a pull request mentions that in its description.

## The harness contract

The harness contract is the document that describes the harness adopted by the project. It is
written during adoption and updated with every change to the harness or its scenes. It contains
these sections, each a record of facts about this project:

1. Status and purpose: what the harness is for, what it is not, and what has and has not been
   verified, with the verification boundary of the optional real samples written out openly.
2. Integration points: the filled table from the integration survey.
3. Operator flow and commands: every verb with a complete example invocation from the repository
   root, what each prints, the rules for capture names, and the exact runtime, engine and library
   versions locked by the project.
4. Implementation responsibilities: the components and what each is responsible for, with the
   adaptation points named in every part of the guide and the values chosen for them.
5. Scene documentation: one entry per scene.
6. Samples and privacy, when the harness has a refresh.
7. Drift, receipts and comparison, including the recorded comparison options and the parameters of
   the diff coloring. A change to the radius or the margin of the coloring is recorded here as a
   tooling decision.
8. Acceptance criteria, in the general form given in the part on the acceptance criteria.
9. Recorded verification: for each criterion or group of criteria, the captures and runs that
   verified it and what they showed, with observed product findings listed separately.
10. Engineering process: the working practice, where exploratory scenes are, where reports and
    comparisons are written, and the rule that capture and comparison names are exclusive.
11. Production impact: that the harness does not change application behavior or data and does not
    need a migration, and how the production artifact is inspected.

## Scene documentation

Every scene has one entry. A scene without an entry is not curated yet. The entry contains:

* the question for the scene, written as the concrete interface question checked by the scene;
* what the scene opens or mounts: the real route or screen for a page scene, and the real component
  with its container for a component scene;
* the fixture, with the shape of the main record, the edge values in the fixture, and every declared
  response or the statement that the fixture declares none;
* the variants, where they differ from the shared set;
* the interactions in order;
* the named checkpoints with what each captures;
* the required checks with their tolerances;
* the diagnostic measurements with the product findings recorded by them.

An entry records when the scene was curated ahead of a change and when a later change extended it,
so a reader knows which checkpoints prove which change. For a checkpoint that proves a layout did
not change, the entry records that fact. For example, the checkpoints of the wide layout are
pixel-identical when only the narrow layout changes.

The scene entry does not contain an approved fix for a diagnostic finding. It records the finding as
a product finding, neither acceptable nor repaired, until a product decision turns the requirement
behind the finding into a required check.

For example, an entry for an item editor scene contains the question whether the rows in the
attribute list of the item fill their rows and whether a save sends exactly the changed attributes.
The scene opens the real editor route with a synthetic item that has short attributes, one long
unbroken value and one attribute in a second language with longer words, over the complete shell
responses. It captures the loaded shell, the attribute list, the edited list, the saved list and the
list after a reload. It requires the controls in every row to extend to both edges of the content
box of the row within one pixel, the save body to contain only the attribute list, and the reload
to show the saved values.

## Web realization in the reference

In the reference, the contract was one Markdown document in the documentation folder of the
application. The instructions entry was a short rule in the agent instructions file of the
repository. The contract ended with a table of the synthetic verification recorded for each group
of acceptance criteria, and with a separate observed product finding for the scene with a long
value.

## Native and terminal realizations

The records are the same for every platform. In the operator section, a native or terminal project
lists the emulator or simulator images, the device profiles or the terminal emulator used by the
project. The scene entries describe screens, views or terminal states in place of routes.
