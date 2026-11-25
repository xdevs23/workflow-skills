---
name: running-copy-phase
description: Run copy phase: have text for product written by copywriter agents, checked and verified
---

- Hand copy artifact to `workflow-skills:implementer` agent started by
  `workflow-skills:implement`
- How large the change is sets only how many writers run
- Give even a single string an intent, writing system and named source line. It gets one writer
  and the critic in place of full phase

## The two-layer contract

- Write copy contract as two separate documents, intent catalog and writing system

### Intent catalog: per increment, the WHAT

- Write one intent catalog per increment
- Give every visible string a key and an intent stated at level of the goal, with these parts:
  - **what the string must communicate**: the claim, phrasing left open;
  - **where the reader is**: point reached by reader on meeting the string, and what reader needs
    next;
  - **the constraints**: interpolation parameters, casing rules and a **length limit**;
  - **the shape of the data**: how lines break, where values are interpolated, which plural forms
    exist;
  - **whether the key is a copy key or invariant data**, as `workflow-skills:writing-product-text`
    defines invariant data;
  - **the surface**: either product screen, where reader uses product, onboarding and error states
    included, or marketing page, where reader decides whether to use product
- For slot on product screen, write as intent what reader reads or does in that slot
- **Never put example prose or imagery from the designer into an intent.** Intent prescribing
  imagery turns writer into translator of a draft by someone else, where writer should write from
  the goal

### Writing system: global, the HOW

- Write writing system as one document of rules for project that go beyond
  `workflow-skills:writing-product-text`, e.g. name used for each thing and how each slot is built.
  Writers load that skill themselves
- Phrase every rule **positively, with a check that passes or fails**. Model needs replacement
  named, since name for bad habit teaches it nothing
- Load SOURCE block before asking for a single word

## Specify the SENTENCE instead of the vibe

Writer can act on how a sentence is built, cannot act on a mood.

**Adjectives for texture in a prompt, e.g. "punchy", "snappy", "bold", "crisp", directly produce the
three-fragment pattern, although they were meant to avoid it** ("Verified. Ready. Go."). Word for
texture refers to nothing on which model can base a sentence, so model falls back on most marked
surface pattern known to it.

- Same rule for length: **set the length limit for the whole SLOT, never per line.** Writer reads
  character limit per line as "one fragment per line" and produces staccato pattern directly

## Voice and tone are INPUTS, never hardcoded

- Take voice and tone from three inputs supplied per project. Copy them VERBATIM into every copy
  prompt:
  1. **One sentence giving the speaker and the situation**, e.g. "a knowledgeable friend explaining
     this across a table". Speaker and situation can be checked, "warm but professional" cannot
  2. **2–3 admired samples**, so writer can match *spread of sentence lengths*
  3. **A SOURCE block**: document with facts

## Required variants

- Ask for **structurally distinct variants** of strings named in
  `workflow-skills:writing-product-text`
- Pick variant that ships yourself, by intent of slot, SOURCE and writing system

## Multilingual (only if the product ships more than one locale)

- **Run all locales in ONE parallel phase**
- **Check the syntax rules mechanically.** String libraries reserve meta-characters, e.g.
  separators for plurals or context, delimiters for interpolation. One left unescaped can silently
  cut rendered string short, without error anywhere. Ban them unescaped, grep for them in check
- Check **key parity** too: every locale has exactly same set of keys. Missing key shows raw key
  path to visitor

## Verification: what makes this a workflow

- Verify in three stages, in this order: tool, then two agents
- **Mechanical check: a committed tool run with ONE COMMAND**
  - Let tool RECOMPUTE everything from files: key parity across locales, length limits for slots,
    syntax rules, grep for forbidden literals, check for leaked source language
  - Treat value identical to the one in pivot language as suspect unless empty
  - Commit tool as script. Put exact command for it in every prompt. Run it without prompt
    template
  - Use self-report of a writer only to detect truncated or dishonest run
- **Source-verify reviewer** (`agentType:'workflow-skills:copy-source-verify'`)
  - Run it on a **model strong on detail, never the smallest one**
  - It checks every factual claim against document with facts *and* against live artifact, and
    register in every language, including languages read by nobody on team. Standard example:
    wording suggesting temporary state where product promises permanent one
  - It requires proof for every superlative
  - **Use what was observed, never what was recalled:** fetch and transcribe wording of real
    artifacts, label such data "observed", never let an agent cite an authority not checked by it
- **Critic with a fresh context** (`agentType:'workflow-skills:copy-critic'`), reviewer that never
  saw the writing happen
  - It names source line for each sentence, lists every sentence without subject and finite verb,
    counts markers of machine-written text
  - It audits, never rewrites
- Run **completeness pass** alongside source-verify reviewer and critic, inside Verify. In it, ask
  one question about whole list of work, once and explicitly: "which item is missing entirely?"
  Check of single items cannot see an absent item by its structure, and missing item is worst kind
  of defect to ship

## The forbidden-literals manifest

- When copy replaces placeholder prose from design draft, list **distinctive phrases** of draft as
  explicit ban list for grep, all locales and calques included
- Exempt generic words of interface, e.g. "Sign in", "Learn more"
- Run manifest in mechanical check. "Do not copy the draft" can only be enforced by executable
  check

## The shape

- Run copy phase as a `Workflow()` in four phases: **Intent → Write → Check → Verify**
- **Intent**: write or decide intent catalog before any writer starts. Without intents stated as
  goals, each writer invents separate standard, critic has nothing to check against
- **Write**: fan out `agentType:'workflow-skills:copywriter'` with **one writer per area and
  locale**. Area = page, screen or flow, or whole strings file when file is small. Writer edits
  i18n strings file directly, fills every slot in its area in one sitting, returns what it changed.
  Give each writer: writing system VERBATIM, intents for its area, voice inputs, SOURCE block
- **Check**: run mechanical check, recomputed from files
- **Verify**: run `workflow-skills:copy-source-verify` and `workflow-skills:copy-critic` in
  parallel, plus completeness pass. Give source-verify reviewer copy, SOURCE block, intents and
  live artifact. Give critic copy, writing system, intents and forbidden-literals manifest

One writer per area and locale, because one agent through a whole batch, N locales or N unrelated
areas, wrote worse towards end and missed items unnoticed. One agent per string, its value copied
into file by script, spent whole context of a writer on five-word label, dozens of times over, and
slots of one screen stopped fitting together, e.g. two slots repeated same noun or dealt with same
question, because no writer wrote them together.

## Laws

- **Write the copy first, and let implementation use only finished strings.** Never commit
  placeholder prose to tree
- **Create every key empty.** Let copy pass fill it
  - Placeholder text inside a key looks like finished copy to everyone who comes across it later.
    Writer skips key, critic finds sentence to audit, product ships with placeholder
- **Show the user every slot reported by the copywriter for redesign**, with part of screen the
  copywriter named
  - Let completeness pass list such slot as held, separately from slot never written
  - Do not implement screen containing that slot until redesigned slot has copy

## Agents

- Give each agent **ONLY the context for its task**, listed in its phase. Agent type carries its
  rules

## Rules in other skills

- Follow `workflow-skills:writing-product-text` for rules of text written in copy phase
