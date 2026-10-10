---
name: writing-style
description: Applies to every text you write that a person reads, such as code comments, documents, commit messages and replies. Load it before you write any prose or make a commit.
---

# Writing style and vocabulary

## Scope

- Follow these rules in code, comments, documents, commit messages and every text a person reads,
  including replies in the terminal.
- Where a project has written down a convention, follow that convention over these rules.

## Plain language

- Write simple language everywhere. Leave out filler jargon and mannered speech.
- Apply plain language most strictly in a message to a person:
  - Leave out words about how the work was organized, such as stage names, reviewer names and
    session narration.
  - Say every term of art in plain words that a reader outside the project understands.

## Sentence shape

- Use `'s` or an `of` that could become `'s` only for real ownership, such as Anna's book, Tom's
  table, the source code of the database or the design of that website.
- Leave an `of` that could never become `'s` as it is, such as in "each of those requests" or
  "instead of".
- Where one thing does not own the other, say how the two relate: where one sits, what it contains,
  what it needs or what it does.
- Do not fix a possessive by turning it around. "The Reports tab of the store" still reads as if the
  store owned the tab, just like "the store's Reports tab".
- Never stack nouns into a name the reader has not seen before, such as "retry budget", "fetch
  plan" or "session handoff record". Say what the thing is or what it does.
- Join two clauses with `, and` only when they are one thought. Write two sentences otherwise.
- Delete a second clause that adds nothing to the first. In "The script stops at the first failure,
  and nothing after it runs", the second clause only repeats the first, so delete it.
- Give code, a file, a value or a tool the verb for what happens to it or what it does: is, has,
  contains, sets, uses, calls, returns, shows, sends, fails, expects, needs, skips, affects or
  changes. Never give it a human verb such as holds, keeps, stays, carries, reaches, answers, says,
  states, refuses, decides, serves, names or touches.
- Name a thing with words the reader already knows. Never invent a label for it, such as "the fast
  way" for a lookup that finds its result in the cache.
- Say what is there or what happens, instead of listing what is absent with `no` and a noun.
- Where the absence itself is the point, write it as a sentence with a verb, such as "The reviewer
  does not see the notes."
- Name a thing with the noun for the thing, never with a verb turned into a noun. Write "nine
  requests" in place of "nine reads", and "the list of orders" in place of "one listing".
- Never define a term by repeating it, as in "`count`, the count of the range" or "a ranking ranks".
  Say what the term means in other words.
- Leave out "own" where it only stresses who something belongs to, as in "its own rows". Keep it
  only where it tells two owners apart.
- Keep subject, verb and object in their usual order, with the subject close to its verb. Rewrite a
  sentence the reader has to read twice, such as "the values only the second migration of the
  payment schema adds" into "the values that the second migration adds to the payment schema".

| Instead of | Write |
|---|---|
| the store's Reports tab | the Reports tab on the store page |
| the store's orders | every order placed in that store |
| the upload's token | the token that the upload needs |
| the importer's file | the file that the importer reads |
| the retry budget | how often the request is retried |
| the check has no rules of its own | the check applies the rules it is handed |
| no request goes out | the page sends the request once the form is complete |
| give it no notes | hand it only the diff |
| the service answers the totals | the service returns the totals |
| the file holds the settings | the file contains the settings |
| the change touches three files | the change edits three files |

- Instead of a passage such as

  > A store's Reports tab fires six reads, and each one fetches the store's orders again for its
  > totals. One shared fetch needs a new query contract for the report pages.

  write

  > The Reports tab on the store page sends six requests when it opens. Each of those requests
  > loads every order placed in that store again before it adds them up. The report pages can load
  > the orders only once if they ask for the data they need in a different way.

## Patterns to avoid

- Delete an opener that only announces what follows, such as "One thing to note:", "The honest
  answer:", "To be clear:", "Two things I could not decide for you." or "Five things:". Take its
  colon with it, so the sentence starts at the words that came after it.
- Write an opener only where the sentence after it needs one.
- Avoid forced triads, such as fast, reliable and scalable.
- Avoid cycling one idea through synonyms across consecutive sentences.
- Avoid roundabout constructions such as serves as, acts as and plays a role in. Say what the thing
  does.
- Replace a superficial gerund clause, such as an ending that stresses how important something is,
  with a real sentence.
- Avoid gratuitous boldface, formulaic headers, decorative emoji and title case in a heading that is
  prose.
- Avoid pleasantries, hedging filler and a generic conclusion that restates what was already said.
- Name the file, the number or the cause where a concrete mechanism fits, in place of
  impressionistic wording.
- Use a strong verb where one exists, in place of a weak verb propped up by an adverb.
- Use the active voice where the actor is known.
- Avoid the "X, not Y" shape.

## Words to avoid

Avoid these words in code, comments, documents, commit messages and chat alike, as whole words in
any casing: rather than (as a phrase), worth, twist, caveat, seat, lane, leg, drive, doctrine,
ruling, gate, landed, cold, belt-and-suspenders, load-bearing, guessing, ground, wrinkle, guard,
pin, owner, masthead, flagging.

- Use the plain replacement by default.
- Keep a listed word only where the situation really justifies it.
- Leave an identifier that already contains a listed word as it is.

| Instead of | Write |
|---|---|
| gate | check, or the name of the command |
| drive | run, push forward |
| cold | unbriefed, fresh-context |
| landed | merged, committed |
| guard | protection, check |
| ground, grounded | based on, proven |
| load-bearing | important, crucial |
| owner, for the person who uses this machine | user |
| masthead | page header |

- Write the actual thing in place of pin, which needs a different word in each case: locked to a
  revision, asserted exactly by a test, or written into the spec. A document inside a repository or
  a prompt for an agent may keep pinned for a locked dependency.
- Keep settle and settled as domain vocabulary inside a repository. Avoid them in prose addressed
  to a person.
- Write decided in place of ruled and ruling, everywhere.

## Em dashes

- Use a comma, a colon or two sentences by default. Keep an em dash only where it reads clearly
  better than any of them.
- Never put an em dash in a file that contains rules.

## Code and comments

- Write code, its comments, its names and its strings by `workflow-skills:code-writing`.
- Follow this skill in comments and strings as in all other text.

## Commits

- Write the body of a commit message from zero, for a reader who never saw the session.

## Documents

- Name a component by its name.
- Keep file paths and file trees out of a document.
- Never present work left out of scope, a decision the project made, a shortcut or a broken rule as
  a limitation. Each one is a decision or a defect.
- Mark an undecided shortfall OPEN and surface it. Never give it a date that makes it look decided.
- State a rule as neutral engineering law, without the motive behind it.

## Messages

- Write paths, commands and identifiers in monospace.
- Make every message understandable without an earlier message.
- Leave out jargon, filler and hedging.
- Do not restate the question.
- Leave out a preamble and any passage on why the thing matters.
- Cut any closing offer or commentary on next steps.
- Do not write a wall of text.
- Base every question, blocker and open decision on evidence before you put it to the user:
  - Read the earlier words the user wrote on it in full, together with the discussion around them.
  - Check the code or the mechanism it is about.
  - State with file and line why those words do not already answer it.
- Never take a saved report or a result that a stage returned as the only proof that the user has
  not answered.
- Name the code you mean by what it is, in a question, a page or a picture alike: the main branch,
  the develop branch, production, the merged code or the unmerged work on a branch. Never call it
  today, now or current.
- Call a shape that is not built yet After, or the proposed shape.

## Text written before these rules

- Do not rewrite existing text in passing. Record cleaning it up as a unit of work in the project,
  or correct it where your work changes it anyway.
