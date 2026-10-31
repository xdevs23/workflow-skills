---
name: copywriting
description: Write user-facing text for product screens, marketing pages and translations. Not for logs or code comments
---

# Copywriting: copy first, then implement

- Run copy phase as a `Workflow()`: one intent phase, fan-out of writers with one writer per area
  and locale, mechanical check, verification reviewers running in parallel, and a user who decides
  what ships.

## When to use it

- Use it for **every increment that adds text read by people to a product.**
- **Run the copy phase BEFORE implementation**, so implementation uses *finished* strings.
  Placeholder copy in tree ends up on rendered production screens, as placeholders always do.
- Decide, verify and key every string added by increment before implementer starts.
- Hand copy artifact, with notes, to `workflow-skills:implementer` agent started by
  `workflow-skills:implement`.
- Do NOT use it for internal text, e.g. logs, code comments, errors shown to developers. That text
  is part of *codebase* and never appears in product.
- Treat every text visible to a user as in scope, however small the change. Size of change sets
  only how many writers run.
- Give even a single string an intent, writing system and named source line. It gets one writer
  and the critic in place of full phase.

## The two-layer contract

- Write copy contract as two separate documents, intent catalog and writing system. Never mix them.

### Intent catalog: per increment, the WHAT

- Write one intent catalog per increment.
- Give every visible string a key and an intent stated at level of the goal, with these parts:
  - **what the string must communicate**: the claim, phrasing left open;
  - **where the reader is**: point reached by reader on meeting the string, and what reader needs
    next;
  - **the constraints**: interpolation parameters, casing rules and a **length limit for the whole
    slot**;
  - **the shape of the data**: how lines break, where values are interpolated, which plural forms
    exist;
  - **whether the key is a copy key or invariant data.** Proper nouns, product names, numerals and
    identifiers = invariant data, which is never rewritten or "translated". Every other key = copy
    key;
  - **the surface**: either product screen, where reader uses product, onboarding and error states
    included, or marketing page, where reader decides whether to use product.
- For slot on product screen, write as intent what reader reads or does in that slot.
- **Never put example prose or imagery from the designer into an intent.** Rule is crucial. Intent
  prescribing imagery turns writer into translator of a draft by someone else, where writer should
  write from the goal. State goal of the communication, leave sentence to writer.

### Writing system: global, the HOW

- Write writing system as one document. Phrase every rule **positively, with a check that passes
  or fails**.
- Never phrase rule as prohibition, e.g. "don't be salesy". Such rules fail.
- Give writing system a **shared layer** for every surface:
  - Prefer nouns, verbs and numbers over adjectives.
  - Write in second person, active voice, present tense.
  - Make every button label complete the sentence "I want to ___".
  - Use one name for each thing, everywhere.
  - Then cut, read text aloud, test it on a stranger.
- Give it a **product-screen layer**, every string in it a label, action or state for reader to act
  on:
  - Copy into layer, word for word, bullets in `workflow-skills:building-screens` with definition of
    text that explains a product and rule for wording a state.
  - Sentence explaining product fails check in this layer.
- Give it a **marketing-page layer**:
  - Give each page one action.
  - Make headline name the **outcome for the reader**.
  - Test headline by putting competitor in place of product: when headline still fits unchanged, it
    is empty.
  - Put proof for every claim within one screen of the claim.
  - Build text from words used by customers, quoted exactly.
  - Name objections openly instead of hoping nobody raises them.
- Give it a **generation layer**:
  - Load SOURCE block before asking for a single word. Every claim traces back to a source line.
  - Specify construction of each sentence: every sentence has subject and finite verb, 8–22 words,
    lengths alternate across slot.
  - Name punctuation to use: periods, commas, colons, question marks. Write change of direction in
    one sentence with colon, or as two sentences.
  - Require **at least one concrete detail** in each section of marketing page: number, name or
    observable detail taken from SOURCE.
  - Describe how each slot is built, with number of words allowed in it.
  - Supply 2–3 admired samples, so writer can match spread of sentence lengths in them.
  - Require variants for important strings: headline, hero, primary call to action.
  - Run separate critic with fresh context.
  - Do mechanical pass over punctuation **last**, by hand. Convert habitual em dashes, en dashes,
    semicolons and the "not just X, it's Y" frame.

## Specify the SENTENCE instead of the vibe

Describe the sentence in prompt. Writer can act on how a sentence is built, cannot act on a mood.

**Adjectives for texture in a prompt, e.g. "punchy", "snappy", "bold", "crisp", directly produce the
three-fragment pattern, although they were meant to avoid it** ("Verified. Ready. Go."). Word for
texture refers to nothing on which model can base a sentence, so model falls back on most marked
surface pattern known to it.

- Replace vibe with a **specification of the construction**: every sentence has subject and finite
  verb, 8–22 words, lengths alternate across slot. Specification makes pattern *structurally
  impossible*, where a ban would only discourage it.
- Same rule for length: **set the length limit for the whole SLOT, never per line.** Writer reads
  character limit per line as "one fragment per line" and produces staccato pattern directly.
- Break line where sentence *wraps*, never where it *ends*.

## Voice and tone are INPUTS, never hardcoded

- Take voice and tone from three inputs supplied per project. Copy them VERBATIM into every copy
  prompt:
  1. **One sentence giving the speaker and the situation**, e.g. "a knowledgeable friend explaining
     this across a table", never adjectives for texture. Speaker and situation can be checked,
     "warm but professional" cannot.
  2. **2–3 admired samples**, so writer can match *spread of sentence lengths*. Writer does not
     imitate them phrase for phrase.
  3. **A SOURCE block**: document with facts, every claim must trace back to it, line by line.
     Claim without source line is left out. Writer names line used for each claim.

## Required variants and the choice made by a person

- Have model produce **structurally distinct variants** for important strings: headline, hero,
  primary call to action. Each variant comes with source line used for it. Model never returns just
  *one* answer.
- Standard set of five headline variants: outcome, question asked by reader, quote from a customer,
  mechanism, number.
- Count variant as structurally distinct only when its construction differs. Same sentence in other
  words does not count.
- **Let a person choose the one that ships.** For hero and headline, model supplies candidates,
  user picks one. Never optimize this step away as bottleneck: generating variants costs little,
  and picking is exactly the part where a model cannot base its choice on evidence.

## Multilingual (only if the product ships more than one locale)

- Skip all multilingual rules for product with single locale.
- **Run one agent per locale, with all locales in ONE parallel phase, and let each agent write
  NATIVELY from the intent.**
- Never translate from pivot language, and never from one locale into another. Approved string in
  source language is only the version of intent written in *that language*. Translating from pivot
  gives translated register to every other locale at once.
- **Check the syntax rules mechanically.** String libraries reserve meta-characters, e.g.
  separators for plurals or context, delimiters for interpolation. One left unescaped can silently
  cut rendered string short, without error anywhere. Ban them unescaped, grep for them in check.
- Check **key parity** too: every locale has exactly same set of keys. Missing key shows raw key
  path to visitor.

## Verification: what makes this a workflow

- Verify in four stages, in this order: tool, two agents, person.

1. **Mechanical check: a committed tool run with ONE COMMAND.** Reviewer does not do this check.
   Tool RECOMPUTES everything from files: key parity across locales, length limits for slots,
   syntax rules, grep for forbidden literals, check for leaked source language. Value identical to
   the one in pivot language is suspect unless empty. Commit tool as script, put exact command for
   it in every prompt. Tool runs without prompt template. **The tool never uses a self-report from a
   writer as evidence.** Self-report only helps detect truncated or dishonest run.
2. **Source-verify reviewer** (`agentType:'workflow-skills:copy-source-verify'`): run it on a
   **model strong on detail, never the smallest one**. Checks every factual claim against document
   with facts *and* against live artifact. Checks register in every language, including languages
   read by nobody on team. Standard example: wording suggesting temporary state where product
   promises permanent one. Requires proof for every superlative. **Use what was observed, never
   what was recalled:** fetch and transcribe wording of real artifacts, label such data "observed",
   never let an agent cite an authority not checked by it.
3. **Critic with a fresh context** (`agentType:'workflow-skills:copy-critic'`): reviewer that never
   saw the writing happen. Names source line for each sentence, lists every sentence without
   subject and finite verb, counts markers of machine-written text. Audits, never rewrites.
4. **The user reads the important strings before they ship.** Step is mandatory.

- Run **completeness pass** alongside stages 2 and 3, inside Verify and always **before** user. In
  it, ask one question about whole list of work, once and explicitly: "which item is missing
  entirely?" Check of single items cannot see an absent item by its structure, and missing item is
  worst kind of defect to ship.

## The forbidden-literals manifest

- When copy replaces placeholder prose from design draft, list **distinctive phrases** of draft as
  explicit ban list for grep, all locales and calques included.
- Exempt generic words of interface, e.g. "Sign in", "Learn more".
- Run manifest in mechanical check. "Don't copy the draft" can only be enforced by executable
  check. Manifest is that check.

## The shape

Workflow runs five phases: **Intent → Write → Check → Verify → User.**

- **Intent**: write or decide intent catalog before any writer starts. Do not start any writer
  without it.
  Without intents stated as goals, each writer invents separate standard, critic has nothing to
  check against.
- **Write**: fan out `agentType:'workflow-skills:copywriter'` with **one writer per area and
  locale**. Area = page, screen or flow, or whole strings file when file is small. Writer edits
  i18n strings file directly, fills every slot in its area in one sitting, returns what it changed.
  Give each writer: line naming file of `workflow-skills:hygiene`, writing system VERBATIM, intents
  for its area, voice inputs, SOURCE block.
- **Check**: run mechanical check, recomputed from files, before user spends any attention.
- **Verify**: run `workflow-skills:copy-source-verify` and `workflow-skills:copy-critic` in
  parallel, plus completeness pass.
- **User**: user picks variants for important strings, reads them in place.

## Laws

1. **Write the copy first, and let implementation use only finished strings.** Never commit
   placeholder prose to tree.
2. **Create every key empty.** Create i18n key with empty value, let copy pass fill it. Never put
   placeholder text inside a key: it looks like finished copy to everyone who comes across it
   later. Writer skips key, critic finds sentence to audit, product ships with placeholder.
3. **Give each area one writer, never one per string.** Slots in an area are one piece of writing,
   so one writer fills them all and edits strings file itself. Never let one writer grind through a
   batch of unrelated areas or of several locales. Always run completeness pass over list of work
   at end of run.
4. **Trace every claim to a named SOURCE line.** Leave out every claim without source line.
5. **Recompute every check from the artifacts.** Self-report is never evidence.
6. **Run every agent as `workflow-skills:workflows` describes.** Never run source-verify reviewer
   on smallest model.
7. **Let the user pick which important strings ship.** Model supplies structurally distinct
   variants.
8. **Show the user every slot reported by the copywriter for redesign**, with part of screen the
   copywriter named. Completeness pass lists such slot as held, separately from slot never written.
   Do not implement screen containing that slot until redesigned slot has copy.

## Agent prompt templates (verbatim base, append-only)

- Every agent spawned by this skill has fixed template in `agents/`: `agents/copywriter.md`,
  `agents/copy-source-verify.md`, `agents/copy-critic.md`. Use body of that file **VERBATIM** as
  start of agent prompt. Body contains **authoritative rules** for agent.
- Invoke each by qualified agent type: `agentType:'workflow-skills:copywriter'` /
  `'workflow-skills:copy-source-verify'` / `'workflow-skills:copy-critic'`.
- Pass `agent()` **ONLY the context for the task, APPENDED** after that base: writing system, intent
  for item, voice inputs, SOURCE block.
- Do NOT modify, reorder or paraphrase base rules inline.
- Open string appended for a copywriter with this line, `<plugin root>` = plugin directory
  containing this skill:

  ```text REQUIRED: before you write, read the file <plugin root>/skills/hygiene/SKILL.md with the
  Read tool, and follow it in every comment, document, commit message and returned string.
  ```

## What did NOT work (keep these)

Each approach below was tried and produced worse copy.

- **Pivot translation**, writing one language and translating it outward. Gives translated register
  to every other locale at once, because source string is only version of intent written in one
  language. Replaced by writing each locale natively from intent.
- **Character limits per line on headlines.** Writer reads "≤16 characters per line" as "one
  fragment per line", ships staccato pattern. Set limit for whole slot instead. Line breaks where
  sentence wraps, never where it ends.
- **Adjectives for texture in prompts** ("punchy", "snappy", "bold"). Directly produce rhythm of
  fragments, although they were meant to prevent it, because they refer to nothing on which model
  can base a sentence.
  Specify construction of sentence instead.
- **One agent grinding through a whole batch in one go**, writing N locales or N unrelated areas of
  product. Quality drops towards end. Missing items go unnoticed. Split work per area and per
  locale, add completeness pass, because check of single slots cannot see missing slot by its
  structure.
- **One agent per string, returning a value copied into the file by a script.** Whole context of a
  writer goes into five-word label, dozens of times over. Worse than cost: slots of one screen stop
  fitting together, because one writer never wrote them together, e.g. two slots repeat same noun,
  or both deal with same question. Make area the unit of work, let writer edit strings file itself.
- **Intents containing imagery from the draft.** Writer then translates draft instead of writing
  from goal. Write only goal of communication into intent.
- **Storing uppercase strings.** Casing belongs to presentation. Store regular case, apply uppercase
  in CSS. Otherwise stored case is lost in every locale with different casing rules.
- **Placeholder copy in the tree.** Ends up on rendered production screens. Run copy phase first,
  let implementation use only finished strings.
- **Style rules phrased as prohibitions** ("don't be salesy"). Model needs replacement named,
  because name for bad habit teaches it nothing. Phrase every rule as "do" with check that passes
  or fails.
