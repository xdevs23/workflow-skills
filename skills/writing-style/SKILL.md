---
name: writing-style
description: The writing style and vocabulary every piece of text produced follows, covering code comments, documents, commit messages and replies a person reads. Load it before writing any prose or committing.
---

# Writing style and vocabulary

## Scope

- Follow these rules in code, comments, documents, commit messages and every text a person reads,
  including replies in the terminal.
- Follow a project's own convention over these rules where the project states it explicitly.

## Code and comments

- Write code, its comments, its names and its strings by `workflow-skills:code-writing`. The words
  and patterns of this skill apply to comments and strings as to all other text.

## Commits

- Write a commit message body from zero, for a reader with no memory of the session.

## Documents

- Name a component by its name, and put no file path and no file tree in a document.
- Never write scoped-out work, a project decision, a shortcut or a broken rule as a limitation. Each
  is a decision or a defect.
- Mark a shortfall nobody has decided on OPEN, surface it, and give it no date that makes it look
  settled.
- State a rule as neutral engineering law, without the motive behind it.

## Messages

- Write paths, commands and identifiers in monospace.
- Make every message understandable on its own, without an earlier message.
- Use no jargon, no filler and no hedging, and do not restate the question.
- Write no preamble, no passage on why the thing matters, no offer or next-step commentary at the
  end, and no wall of text.
- Base every question, blocker and open decision on evidence before you put it to the user: read the
  user's earlier words on it in full, with the discussion around them, check the code or mechanism
  it is about, and state with file and line why those words do not already answer it. A saved report
  or a stage's result never shows by itself that the user has not answered.
- Name a state of the code by what it is, in a question, a page or a picture alike: the main branch,
  the develop branch, production, the merged code, or the unmerged work on a branch. Never call a
  state today, now or current.
- Call the shape nobody has built yet After, or the proposed shape.

## Words to avoid

Avoid these words in code, comments, documents, commit messages and chat alike, as whole words in
any casing: rather than (as a phrase), worth, twist, caveat, seat, lane, leg, drive, doctrine,
ruling, gate, landed, cold, belt-and-suspenders, load-bearing, guessing, ground, wrinkle, guard,
pin, owner, masthead, flagging, and the "X, not Y" shape.

- Use the plain replacement by default. A use of a listed word can stand only where the situation
  justifies it, and the justification has to be real.
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
| owner, for the person this machine answers to | user |
| masthead | page header |

- Write the actual thing in place of pin, which has no single replacement: locked to a revision,
  asserted exactly by a test, or written into the spec. A repository-internal document or an agent
  prompt may keep pinned for a locked dependency.
- Use settle and settled inside a repository as domain vocabulary, and avoid them in prose
  addressed to a person.
- Avoid ruled and ruling everywhere, and write decided.

## Patterns to avoid

- Delete an announcement preamble, an opener whose only job is to introduce what follows, whole
  with its colon, and begin the sentence at what came after it. Examples: "One thing to note:", "The
  honest answer:", "To be clear:", "Two things I could not decide for you.", "Five things:". Write
  no opener the sentence after it always stands without.
- Avoid forced triads, such as fast, reliable and scalable, and one idea cycled through synonyms
  across consecutive sentences.
- Avoid roundabout constructions such as serves as, acts as and plays a role in. Say what the thing
  does.
- Replace a superficial gerund clause, such as an ending that highlights the importance of
  something, with a real sentence.
- Avoid gratuitous boldface, formulaic headers, decorative emoji, and title case in a heading that
  is prose.
- Avoid pleasantries, hedging filler, and a generic conclusion that restates what was already said.
- Name the file, the number or the cause where a concrete mechanism fits, in place of
  impressionistic wording.
- Use a strong verb where one exists, in place of a weak verb propped up by an adverb, and the
  active voice where the actor is known.

## Em dashes

- Use a comma, a colon or two sentences by default. Keep an em dash only where it earns its place.
- Put no em dash in a file that states rules.

## Umbrella rule

- Write simple language everywhere, with no filler jargon and no mannered speech.
- Apply this most strictly to a message to a person: keep process vocabulary out of it, and say
  every term of art in plain words a reader outside the project would understand.

## Text written before this file

- Do not rewrite existing text in passing. Put it into the project's own clean-up unit, or correct
  it where a piece of work touches it anyway.
