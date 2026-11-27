---
name: running-copy-phase
description: Text for product: copy contract, written text and checks it passes
---

- Give even a single string an intent, writing system and named source line
- Agents for this work: `workflow-skills:copywriter` writes, `workflow-skills:copy-source-verify`
  checks facts, `workflow-skills:copy-critic` audits text

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
  `workflow-skills:writing-product-text`, e.g. name used for each thing and how each slot is built
- Phrase every rule **positively, with a check that passes or fails**. Model needs replacement
  named, since name for bad habit teaches it nothing

## Specify the SENTENCE instead of the vibe

Writer can act on how a sentence is built, cannot act on a mood.

**Adjectives for texture in a prompt, e.g. "punchy", "snappy", "bold", "crisp", directly produce the
three-fragment pattern, although they were meant to avoid it** ("Verified. Ready. Go."). Word for
texture refers to nothing on which model can base a sentence, so model falls back on most marked
surface pattern known to it.

- Same rule for length: **set the length limit for the whole SLOT, never per line.** Writer reads
  character limit per line as "one fragment per line" and produces staccato pattern directly

## Voice and tone are INPUTS, never hardcoded

- Take voice and tone from three inputs supplied per project, copied VERBATIM to every writer:
  1. **One sentence giving the speaker and the situation**, e.g. "a knowledgeable friend explaining
     this across a table". Speaker and situation can be checked, "warm but professional" cannot
  2. **2–3 admired samples**, so writer can match *spread of sentence lengths*
  3. **A SOURCE block**: document with facts

## Required variants

- Ask for **structurally distinct variants** of strings named in
  `workflow-skills:writing-product-text`
- Pick variant that ships yourself, by intent of slot, SOURCE and writing system

## Multilingual (only if the product ships more than one locale)

- Ban meta-characters reserved by string library unescaped, e.g. separators for plurals or
  context, delimiters for interpolation. One left unescaped can silently cut rendered string short
- Every locale has exactly same set of keys. Missing key shows raw key path to visitor

## What the finished copy passes

- **Mechanical check: a committed tool run with ONE COMMAND**, recomputing everything from files:
  key parity across locales, length limits for slots, syntax rules, forbidden literals, leaked
  source language. Value identical to the one in pivot language counts as suspect unless empty
- Every factual claim matches document with facts *and* live artifact, in every language. Every
  superlative has proof. **What was observed counts, never what was recalled:** wording of real
  artifacts is fetched, transcribed and labeled "observed"
- Every sentence names its source line, has subject and finite verb, and carries no marker of
  machine-written text
- No item of whole list of work is missing entirely

## The forbidden-literals manifest

- When copy replaces placeholder prose from design draft, list **distinctive phrases** of draft as
  explicit ban list for mechanical check, all locales and calques included
- Exempt generic words of interface, e.g. "Sign in", "Learn more"

## Laws

- **Write the copy first, and let implementation use only finished strings.** Never commit
  placeholder prose to tree
- **Create every key empty.** Let copy fill it
  - Placeholder text inside a key looks like finished copy to everyone who comes across it later.
    Writer skips key, critic finds sentence to audit, product ships with placeholder
- **Show the user every slot reported by the copywriter for redesign**, with part of screen the
  copywriter named, listed apart from slot never written
- Do not implement screen containing that slot until redesigned slot has copy

## Rules in other skills

- Follow `workflow-skills:writing-product-text` for rules of text written in copy phase
