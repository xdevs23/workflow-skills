# Working in this repository

This repository is a plugin: its product is the Markdown that skills and agent templates are
written in. A wording defect here is a behavior defect in every session that loads the skill, so
the prose rules below bind every document in the tree: `skills/`, `agents/` and the README alike.

## Every sentence carries a fact

**Delete any sentence whose only content is that more text follows.** *"These are the mechanics"*,
*"Here is how it works"*, *"The rules are below"* — each announces a structure already on the
screen, occupies a line, and leaves nothing behind when cut. A section opens on its first real
sentence. Sentences like these survive every edit precisely because nothing in them can be wrong.

Delete a sentence and ask what fact was lost; if the answer is none, it was never carrying one.

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
contains only what the skill is for.
`skills/babysit-pr/SKILL.md` is the example.

## Skills and agent templates read as short notes

**Every file under `skills/` and `agents/` is written in a compressed register of short working
notes.** Articles, forms of "to be" and auxiliary verbs are dropped, a subject clear from the
context is left out, stops are short, and a fragment may stand as a sentence. Every instruction,
condition, negation, quantity and order is kept, and headings, qualified names, tool names, paths,
commands and code are copied verbatim. The frontmatter description of a skill or an agent template
is written in the same register, with its meaning kept.

**`workflow-skills:writing-style` binds inside the register.** The register lifts four of its
demands only: articles, forms of "to be" and auxiliaries, a subject clear from the context, and
complete sentences. Every other rule of that skill applies, among them the verbs for code, the
participle after a noun that is the object of the clause, absence written with a verb, the ban on
made-up noun compounds, on "serves as" and on the "X, not Y" shape, and the list of words to avoid.

**Negations are written in full**, as "do not", "is not" and "cannot", never as a contraction.

**Compression ends where meaning blurs.** Keep the verb, the `that` or the article wherever
dropping it leaves a claim without a verb, stacks nouns, or leaves `only`, `never` or a hedge
without a clear reach. Never write a bare "should have", which can mean that a thing ought to exist
or that it still has to be added. Relate two nouns with `of` or `by`. "Run the linter on every file
edited by the change, and never commit a file rejected by the linter" becomes "Run linter on every
file edited by change. Never commit file rejected by linter."
