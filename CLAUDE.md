# Working in this repository

This repository is a plugin: its product is the Markdown that skills, agent templates and design
records are written in. A wording defect here is a behavior defect in every session that loads the
skill, so the prose rules below bind every document in the tree — `skills/`, `agents/`, `docs/`
and the README alike.

## Prose stands without its heading

**A heading is a label, not the subject of the sentence beneath it.** Every paragraph opens with a
full sentence carrying its own subject, and the whole document still parses with every heading
stripped out. *"Its own tiny run, and it ENDS at the return"* reads as finished prose only because
a heading three lines above supplied the noun; standing alone it is a fragment about nothing.

That matters here more than in most prose. A reader rarely arrives at the top of one of these
documents and reads downward: search, a link, a grep hit or a prompt that quotes one passage all
deliver a paragraph with its heading stripped off. A paragraph that only works underneath its
heading arrives broken.

**Delete any sentence whose only content is that more text follows.** *"These are the mechanics"*,
*"Here is how it works"*, *"The rules are below"* — each announces a structure already on the
screen, occupies a line, and leaves nothing behind when cut. A section opens on its first real
sentence. Sentences like these survive every edit precisely because nothing in them can be wrong.

Both defects are the same habit: writing the layout instead of the content. The test is mechanical.
Strip the headings and read; a paragraph that stops making sense was leaning on one. Delete a
sentence and ask what fact was lost; if the answer is none, it was never carrying one.

## Skills speak to their reader

**A skill tells the assistant that reads it what to do, as "you".** It writes in imperative
sentences: "Watch the pull request", "Run it with `python3`", "Do not act on your own replies". It
never calls its reader "the agent", "the root" or "the orchestrator", and a sentence that needs
no subject drops it. The system prompt already tells the model who "you" is, so a third-person
name only makes the reader translate every rule back to itself. Every other agent keeps its own
name: the subagents, the workflow agents, a stage such as the implementer.

**Steps and rules are bullets, one rule to a bullet.** A bullet opens with its instruction, and
the facts the instruction needs follow in the same bullet. Continuous prose stays for passages
that explain why, which a list would break apart.

**A skill names another skill or an agent type by its qualified name**, such as
`workflow-skills:writing-style` or `workflow-skills:implementer`, and its frontmatter description
says only when the skill applies, not what is inside it.
`skills/babysit-pr/SKILL.md` is written this way and serves as the example.
