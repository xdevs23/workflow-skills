# Working in this repository

Product of this plugin: Markdown of skills and agent templates. Wording defect = behavior defect.
Rules below bind `skills/`, `agents/` and README.

## Every sentence carries a fact

- Delete sentence that only announces more text, e.g. "Here is how it works"
- Delete sentence that repeats rule already stated, also as its negation or consequence. Keep
  reason that adds fact rule does not
- Cut words that add nothing, e.g. "truly", "really". Short phrase over long one
- Open skill on its first rule, without heading repeating its name

## Skills and agent templates

- Address reader as "you", in imperative. Never "the agent", "the root", "the orchestrator". Other
  agents keep their names
- One rule to a bullet, instruction first. Prose only for passages that explain why
- Name skill or agent type by qualified name, e.g. `workflow-skills:copywriting`
- Frontmatter description: only what skill is for, in same register
- Write in compressed register: drop articles, forms of "to be", auxiliary verbs and subject clear
  from context. Keep every instruction, condition, negation, quantity and order. Copy headings,
  qualified names, tool names, paths, commands and code verbatim. `workflow-skills:copywriting`
  does not apply
- Write negations in full: "do not", "is not", "cannot"
- End bullet without full stop
- Stop compressing where meaning blurs: keep verb, `that` or article where dropping it leaves claim
  without verb, stacks nouns, or leaves `only`, `never` or hedge without clear reach. Never write
  bare "should have"
- Relate two nouns with `of` or `by`, except for user: "user words", never "user's words" or
  "words of user". `nix run .#check` refuses both

## No tests

- Add no tests. Overrides `workflow-skills:writing-tests` and every step in other skills that
  writes, runs or asks for tests
- Check change to hooks module with `nix run .#check` and by operating changed behavior in live
  session
