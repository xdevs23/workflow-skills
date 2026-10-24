---
name: copywriting
description: Write text shown to people on a product screen or a marketing page, such as onboarding, interface states and translations. Not for logs or code comments.
---

# Copywriting: copy first, then implement

- **Load the `workflow-skills:writing-style` skill first.** It applies to every comment, document,
  commit message and reply written under this skill, and it is not optional when you work with
  this plugin.
- Run the copy phase as a `Workflow()` with one intent phase, a fan-out of writers with one writer
  per area and locale, a mechanical check, verification reviewers running in parallel, and a user
  who decides what ships.

## When to use it

- Use it for **every increment that adds text read by people to a product.**
- **Run the copy phase BEFORE implementation**, so implementation uses *finished* strings.
  Placeholder copy in the tree ends up on rendered production screens, as placeholders always do.
- Decide, verify and key every string added by the increment before the implementer starts.
- Hand the copy artifact, together with the notes, to the `workflow-skills:implementer` agent
  started by `workflow-skills:implement`.
- Do NOT use it for internal text, such as logs, code comments and errors shown to developers. That
  text is part of the *codebase* and never appears in the product.
- Treat every text visible to a user as in scope, however small the change. The size of the change
  sets only how many writers run.
- Give even a single string an intent, the writing system and a named source line. It gets one
  writer and the critic in place of a full phase.

## The two-layer contract

- Write the copy contract as two separate documents, the intent catalog and the writing system, and
  never mix them.

### Intent catalog: per increment, the WHAT

- Write one intent catalog per increment.
- Give every visible string a key and an intent stated at the level of the goal, with these parts:
  - **what the string must communicate**: the claim, leaving the phrasing open;
  - **where the reader is**: the point the reader has reached on meeting the string, and what the
    reader needs next;
  - **the constraints**: the interpolation parameters, the casing rules and a **length limit for
    the whole slot**;
  - **the shape of the data**: how lines break, where values are interpolated and which plural
    forms exist;
  - **whether the key is a copy key or invariant data.** Proper nouns, product names, numerals and
    identifiers are invariant data, which nobody rewrites or "translates". Every other key is a copy
    key;
  - **the surface**: either a product screen, where the reader uses the product, including
    onboarding and error states, or a marketing page, where the reader decides whether to use the
    product.
- For a slot on a product screen, write as the intent what the reader reads or does in that slot.
- **Never put example prose or imagery from the designer into an intent.** This rule is crucial.
  An intent that prescribes imagery turns the writer into a translator of a draft by someone else,
  where the writer should write from the goal. State the goal of the communication, and leave the
  sentence to the writer.

### Writing system: global, the HOW

- Write the writing system as one document, and phrase every rule **positively, with a check that
  passes or fails**.
- Never phrase a rule as a prohibition, such as "don't be salesy". Such rules fail.
- Give the writing system a **shared layer** for every surface:
  - Prefer nouns, verbs and numbers over adjectives.
  - Write in the second person, active voice, present tense.
  - Make every button label complete the sentence "I want to ___".
  - Use one name for each thing, everywhere.
  - Then cut, read the text aloud and test it on a stranger.
- Give it a **product-screen layer**, in which every string is a label, an action or a state for
  the reader to act on:
  - Copy into the layer, word for word, the bullets in `workflow-skills:engineering-principles`
    with the definition of text that explains a product and the rule for wording a state.
  - A sentence that explains the product fails the check in this layer.
- Give it a **marketing-page layer**:
  - Give each page one action.
  - Make the headline name the **outcome for the reader**.
  - Test the headline by putting a competitor in place of the product: when the headline still
    fits unchanged, it is empty.
  - Put the proof for every claim within one screen of the claim.
  - Build the text from words customers used, quoted exactly.
  - Name the objections openly instead of hoping nobody raises them.
- Give it a **generation layer**:
  - Load the SOURCE block before you ask for a single word. Every claim traces back to a source
    line.
  - Specify the construction of each sentence: every sentence has a subject and a finite verb, has
    8–22 words, and the lengths alternate across the slot.
  - Name the punctuation to use: periods, commas, colons and question marks. Write a change of
    direction in one sentence with a colon, or as two sentences.
  - Require **at least one concrete detail** in each section of a marketing page: a number, a name
    or an observable detail taken from SOURCE.
  - Describe how each slot is built, with the number of words allowed in it.
  - Supply 2–3 admired samples, so the writer can match the spread of sentence lengths in them.
  - Require variants for the important strings: the headline, the hero and the primary call to
    action.
  - Run a separate critic with a fresh context.
  - Do the mechanical pass over punctuation **last**, by hand, and convert the habitual em dashes,
    en dashes and semicolons and the "not just X, it's Y" frame.

## Specify the SENTENCE instead of the vibe

Describe the sentence in the prompt, because a writer can act on how a sentence is built and cannot
act on a mood.

**Adjectives for texture in a prompt, such as "punchy", "snappy", "bold" and "crisp", produce
directly the three-fragment pattern they were meant to avoid** ("Verified. Ready. Go."). A texture
word refers to nothing the model can base a sentence on, so the model falls back on the most marked
surface pattern known to it.

- Replace the vibe with a **specification of the construction**: every sentence has a subject and a
  finite verb, has 8–22 words, and the lengths alternate across the slot. The specification makes
  the pattern *structurally impossible*, where a ban would only discourage it.
- Apply the same rule to length: **set the length limit for the whole SLOT, never per line.** A
  writer reads a character limit per line as "one fragment per line" and produces the staccato
  pattern directly.
- Break a line where a sentence *wraps*, never where it *ends*.

## Voice and tone are INPUTS, never hardcoded

- Take voice and tone from three inputs supplied for each project, and copy them VERBATIM into
  every copy prompt:
  1. **One sentence giving the speaker and the situation**, such as "a knowledgeable friend
     explaining this across a table", never adjectives for texture. A speaker and a situation can
     be checked, while "warm but professional" cannot.
  2. **2–3 admired samples**, so the writer can match the *spread of sentence lengths*. The writer
     does not imitate them phrase for phrase.
  3. **A SOURCE block**: the document with the facts, to which every claim must trace back, line
     by line. A claim without a source line is left out. The writer names the line used for each
     claim.

This skill does not define the voice. A skill that hardcodes a voice contains a brand guideline.

## Required variants and the choice made by a person

- Have the model produce **structurally distinct variants** for the important strings, which are
  the headline, the hero and the primary call to action. Each variant comes with the source line
  used for it. The model never returns just *one* answer.
- The standard set of five variants for a headline is the outcome, the question asked by the
  reader, a quote from a customer, the mechanism and a number.
- Count a variant as structurally distinct only when its construction differs. The same sentence
  in other words does not count.
- **Let a person choose the one that ships.** For the hero and the headline, the model supplies
  candidates and the user picks one. Never optimize this step away as a bottleneck: generating
  variants costs little, and picking is exactly the part a model cannot base on evidence.

## Multilingual (only if the product ships more than one locale)

- Skip all multilingual rules for a product with a single locale.
- **Run one agent per locale, with all locales in ONE parallel phase, and let each agent write
  NATIVELY from the intent.**
- Never translate from a pivot language, and never translate from one locale into another. An
  approved string in the source language is only the version of the intent written in *that
  language*. Translating from a pivot gives a translated register to every other locale at once.
- Put the intent into a **comment where the component source references the key**, so whoever
  writes the string again later can read what it was meant to do.
- **Check the syntax rules mechanically.** String libraries reserve meta-characters, such as the
  separators for plurals or context and the delimiters for interpolation. One of them left
  unescaped can cut a rendered string short silently, without an error anywhere. Ban them
  unescaped, and grep for them in the check.
- Check **key parity** as well: every locale has exactly the same set of keys. A missing key shows
  the raw key path to a visitor.

## Verification: what makes this a workflow

- Verify in four stages, in this order: a tool, two agents, a person.

1. **Mechanical check: a committed tool run with ONE COMMAND.** A reviewer does not do this check.
   The tool RECOMPUTES everything from the files: key parity across locales, the length limits for
   the slots, the syntax rules, the grep for forbidden literals, and a check for leaked source
   language. A value identical to the one in the pivot language is suspect unless it is empty.
   Commit the tool as a script and put the exact command for it in every prompt. The tool runs
   without a prompt template. **The tool never uses a self-report from a writer as evidence.** A
   self-report only helps to detect a truncated or dishonest run.
2. **Source-verify reviewer** (`agentType:'workflow-skills:copy-source-verify'`): run it on a
   **model strong on detail, never the smallest one**. It checks every factual claim against the
   document with the facts *and* against the live artifact. It checks the register in every
   language, including languages read by nobody on the team. The standard example is wording that
   suggests a temporary state where the product promises a permanent one. It requires proof for
   every superlative. **Use what was observed, never what was recalled:** fetch and transcribe the
   wording of real artifacts, label such data "observed", and never let an agent cite an authority
   it did not check.
3. **Critic with a fresh context** (`agentType:'workflow-skills:copy-critic'`): a reviewer that
   never saw the writing happen. It names the source line for each sentence, lists every sentence
   without a subject and a finite verb, and counts the markers of machine-written text. It audits
   and never rewrites.
4. **The user reads the important strings before they ship.** This step is mandatory.

- Run the **completeness pass** alongside stages 2 and 3, inside Verify and always **before** the
  user. In it, ask one question about the whole list of work, once and explicitly: "which item is
  missing entirely?" A check of single items cannot see an absent item by its structure, and a
  missing item is the worst kind of defect to ship.

## The forbidden-literals manifest

- When the copy replaces placeholder prose from a design draft, list the **distinctive phrases** of
  the draft as an explicit ban list for grep, including all locales and calques.
- Exempt the generic words of the interface, such as "Sign in" and "Learn more".
- Run the manifest in the mechanical check. "Don't copy the draft" can only be enforced by an
  executable check. The manifest is that check.

## The shape

The workflow runs five phases: **Intent → Write → Check → Verify → User.**

- **Intent**: write or decide the intent catalog before any writer starts, and start no writer
  without it. Without intents stated as goals, each writer invents a separate standard and the
  critic has nothing to check against.
- **Write**: fan out `agentType:'workflow-skills:copywriter'` with **one writer per area and
  locale**. An area is a page, a screen or a flow, or the whole strings file when the file is
  small. The writer edits the i18n strings file directly, fills every slot in its area in one
  sitting and returns what it changed. Give each writer the two lines that name the files of
  `workflow-skills:writing-style` and `workflow-skills:hygiene`, the writing system VERBATIM, the
  intents for its area, the voice inputs and the SOURCE block.
- **Check**: run the mechanical check, recomputed from the files, before the user spends any
  attention.
- **Verify**: run `workflow-skills:copy-source-verify` and `workflow-skills:copy-critic` in
  parallel, plus the completeness pass.
- **User**: the user picks the variants for the important strings and reads them in place.

## Laws

1. **Write the copy first, and let implementation use only finished strings.** Never commit
   placeholder prose to the tree.
2. **Create every key empty.** Create an i18n key with an empty value, and let the copy pass fill
   it. Never put placeholder text inside a key: it looks like finished copy to everyone who comes
   across it later. The writer skips the key, the critic finds a sentence to audit, and the product
   ships with the placeholder.
3. **Give each area one writer, never one per string.** The slots in an area are one piece of
   writing, so one writer fills them all and edits the strings file itself. Never let one writer
   grind through a batch of unrelated areas or of several locales. Always run a completeness pass
   over the list of work at the end of the run.
4. **Trace every claim to a named SOURCE line.** Leave out every claim without a source line.
5. **Recompute every check from the artifacts.** A self-report is never evidence.
6. **Set an explicit model AND effort on every agent, never inherited ones.** Never run the
   source-verify reviewer on the smallest model.
7. **Let the user pick which important strings ship.** The model supplies structurally distinct
   variants.
8. **Show the user every slot reported by the copywriter for redesign**, together with the part of
   the screen named by the copywriter. The completeness pass lists such a slot as held, separately
   from a slot that was never written. Do not implement the screen containing that slot until the
   redesigned slot has copy.

## Agent prompt templates (verbatim base, append-only)

- Every agent spawned by this skill has a fixed template in `agents/`: `agents/copywriter.md`,
  `agents/copy-source-verify.md`, `agents/copy-critic.md`. Use the body of that file **VERBATIM**
  as the start of the agent prompt. The body contains the **authoritative rules** for the agent.
- Invoke each by its qualified agent type: `agentType:'workflow-skills:copywriter'` /
  `'workflow-skills:copy-source-verify'` / `'workflow-skills:copy-critic'`.
- Pass `agent()` **ONLY the context for the task, APPENDED** after that base: the writing system,
  the intent for the item, the voice inputs and the SOURCE block.
- Do NOT modify, reorder or paraphrase the base rules inline.
- Open the string appended for a copywriter with these two lines, where `<plugin root>` is the
  plugin directory containing this skill:

  ```text REQUIRED: before you write, read the files <plugin root>/skills/writing-style/SKILL.md and
  <plugin root>/skills/hygiene/SKILL.md with the Read tool, and follow them in every comment,
  document, commit message and returned string.
  ```

## What did NOT work (keep these)

Each approach in this list was tried and produced worse copy.

- **Pivot translation**, writing one language and translating it outward. It gives a translated
  register to every other locale at the same time, because the source string is only the version
  of the intent written in one language. Writing each locale natively from the intent replaced it.
- **Character limits per line on headlines.** The writer reads "≤16 characters per line" as "one
  fragment per line" and ships the staccato pattern. Set the limit for the whole slot instead. A
  line breaks where a sentence wraps, never where it ends.
- **Adjectives for texture in prompts** ("punchy", "snappy", "bold"). They produce directly the
  rhythm of fragments they were meant to prevent, because they refer to nothing the model can base
  a sentence on. Specify the construction of the sentence instead.
- **One agent grinding through a whole batch in one go**, writing N locales or N unrelated areas of
  the product. Quality drops towards the end. Missing items go unnoticed. Split the work per area
  and per locale, and add a completeness pass, because a check of single slots cannot see a
  missing slot by its structure.
- **One agent per string, returning a value copied into the file by a script.** The whole context
  of a writer goes into a five-word label, dozens of times over. Worse than the cost, the slots of
  one screen stop fitting together, because no writer ever wrote them together: two slots repeat
  the same noun, or both deal with the same question. Make the area the unit of work, and let the
  writer edit the strings file itself.
- **Intents containing imagery from the draft.** The writer then translates the draft instead of
  writing from the goal. Write only the goal of the communication into an intent.
- **Storing uppercase strings.** Casing belongs to presentation. Store regular case and apply
  uppercase in CSS. Otherwise the stored case is lost in every locale that has different casing
  rules.
- **Placeholder copy in the tree.** It ends up on rendered production screens. Run the copy phase
  first, and let implementation use only finished strings.
- **Style rules phrased as prohibitions** ("don't be salesy"). The model needs the replacement
  named, because a name for the bad habit teaches it nothing. Phrase every rule as a "do" with a
  check that passes or fails.
