---
name: writing-product-text
description: Write text for product: product screen, marketing page or translation
---

- Write each string from intent written for it
- Never rewrite or translate invariant data: proper nouns, product names, numerals and identifiers

## Every surface

- Prefer nouns, verbs and numbers over adjectives
- Write in second person, present tense
- Make every button label complete the sentence "I want to ___"
- Cut every word whose removal keeps the fact of its sentence

## Product screens

- Follow bullets in `workflow-skills:ux-design` that define text which explains a product, and rule
  for wording a state

## Marketing pages

- Give each page one action
- Make headline name the **outcome for the reader**
- Test headline by putting competitor in place of product: when headline still fits unchanged, it
  is empty
- Put proof for every claim on same screen as claim
- Build text from words used by customers, quoted exactly
- Name objections openly instead of hoping nobody raises them

## Sentences

- Give every sentence of running text, outside labels, actions and states, subject and finite verb,
  8–22 words. Alternate lengths across slot
- Use periods, commas, colons, question marks
- Put **at least one concrete detail** in each section of marketing page: number, name or
  observable detail taken from SOURCE
- Keep to length limit given by intent of slot, counted for whole slot
- Break line where sentence *wraps*, never where it *ends*
- Do mechanical pass over punctuation **last**, by hand. Convert habitual en dashes, semicolons and
  the "not just X, it's Y" frame

## Voice and source

- Write as speaker in situation given by voice inputs of project
- Match *spread of sentence lengths* of admired samples. Never imitate them phrase for phrase
- Trace every claim to a line of SOURCE block. Leave out claim without source line, and say so.
  Name line used for each claim

## Required variants

- Write **structurally distinct variants** for important strings when asked: headline, hero,
  primary call to action. Each variant comes with source line used for it
- Standard set of five headline variants: outcome, question asked by reader, quote from a customer,
  mechanism, number
- Count variant as structurally distinct only when its construction differs. Same sentence in other
  words does not count

## Locales

- Write each locale natively from intent. Never translate from pivot language, and never from one
  locale into another. Approved string in source language only renders intent in *that language*.
  Translating from pivot gives translated register to every other locale at once
- Never leave meta-character reserved by string library unescaped, e.g. separator for plurals or
  context, delimiter for interpolation
- Store strings in regular case. Apply uppercase in CSS, since stored case is lost in every locale
  with different casing rules

## Rules in other skills

- Follow `workflow-skills:copywriting` for rules that apply to every text
