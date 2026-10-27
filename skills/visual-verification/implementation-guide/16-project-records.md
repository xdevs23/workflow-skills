# The records in the project

Harness used only when records in project show harness exists and is required. So project adopting
harness adds two records: entry in project instructions, and harness contract with scene
documentation. Both tracked documents in project. In both, rules written as neutral engineering law.

## The entry in the project instructions

Project instructions, file read first by agents and contributors of project, gain one entry for
harness. Entry gives name of harness and command that runs it, requires harness for every change to
rendered output, links to harness contract. Describes working practice in a few sentences: pick or
curate scene, capture unchanged interface, implement only approved change, capture again, compare,
open images. Gives harness directory inside project cache, location defined by
`workflow-skills:local-cache`, as location of exploratory scenes.

Project requiring visual evidence on pull requests writes that rule next to other rules for pull
requests in project. Rule requires, for every changed surface, one evidence sheet from capture on
base commit and one on candidate, listed as attachment, shown under separate heading in description.
Also contains exception for pull request whose commits do not change rendered output. Such pull
request mentions that in description.

## The harness contract

Harness contract: document describing harness adopted by project. Written during adoption, updated
with every change to harness or its scenes. Contains these sections, each a record of facts about
this project:

1. Status and purpose: what harness is for, what it is not, what has and has not been verified, with
   verification boundary of optional real samples written out openly.
2. Integration points: filled table from integration survey.
3. Operator flow and commands: every verb with complete example invocation from repository root,
   what each prints, rules for capture names, exact runtime, engine and library versions locked by
   project.
4. Implementation responsibilities: components and what each is responsible for, with adaptation
   points named in every part of guide and values chosen for them.
5. Scene documentation: one entry per scene.
6. Samples and privacy, when harness has refresh.
7. Drift, receipts and comparison, including recorded comparison options and parameters of diff
   coloring. Change to radius or margin of coloring recorded here as tooling decision.
8. Acceptance criteria, in general form given in part on acceptance criteria.
9. Recorded verification: for each criterion or group of criteria, captures and runs that verified
   it and what they showed, observed product findings listed separately.
10. Engineering process: working practice, where exploratory scenes are, where reports and
    comparisons written, rule that capture and comparison names are exclusive.
11. Production impact: that harness does not change application behavior or data, does not need a
    migration, and how production artifact inspected.

## Scene documentation

Every scene has one entry. Scene without entry is not curated yet. Entry contains:

* question for scene, written as concrete interface question checked by scene;
* what scene opens or mounts: real route or screen for page scene, real component with its container
  for component scene;
* fixture, with shape of main record, edge values in fixture, and every declared response or
  statement that fixture declares none;
* variants, where they differ from shared set;
* interactions in order;
* named checkpoints with what each captures;
* required checks with their tolerances;
* diagnostic measurements with product findings recorded by them.

Entry records when scene curated ahead of a change and when later change extended it, so reader
knows which checkpoints prove which change. For checkpoint proving a layout did not change, entry
records that fact. E.g. checkpoints of wide layout pixel-identical when only narrow layout changes.

Scene entry does not contain approved fix for diagnostic finding. Records finding as product
finding, neither acceptable nor repaired, until product decision turns requirement behind finding
into required check.

E.g. entry for item editor scene contains question whether rows in attribute list of item fill their
rows, and whether save sends exactly changed attributes. Scene opens real editor route with
synthetic item: short attributes, one long unbroken value, one attribute in second language with
longer words, over complete shell responses. Captures loaded shell, attribute list, edited list,
saved list, list after reload. Requires controls in every row to extend to both edges of content box
of row within one pixel, save body to contain only attribute list, reload to show saved values.

## Web realization in the reference

In reference, contract was one Markdown document in documentation folder of application.
Instructions entry: short rule in agent instructions file of repository. Contract ended with table
of synthetic verification recorded for each group of acceptance criteria, and with separate observed
product finding for scene with long value.

## Native and terminal realizations

Records same for every platform. In operator section, native or terminal project lists emulator or
simulator images, device profiles or terminal emulator used by project. Scene entries describe
screens, views or terminal states in place of routes.
