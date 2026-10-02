---
name: writing-style
description: The writing style and vocabulary every piece of text produced follows, covering code comments, documents, commit messages and replies a person reads. Load it before writing any prose or committing.
---

# Writing style and vocabulary

## Scope

These rules bind code, comments, documents, commit messages, and every piece of text a person
reads, including replies in the terminal. A project that states its own convention explicitly wins
over this file.

## Code and comments

- Describe in a comment what the code can't express.
- Name things with plain words, and invent no metaphors.
- Follow `workflow-skills:hygiene` for what may reach a tracked file or leave the machine at all.
- Address a string meant for a model to the model, and put no repository paths in it.
- Give an i18n key a comment at its reference site stating the intent of the string.

## Commits

- Write the body from zero, for a reader with no memory of the session, in simple language, without
  mannered speech.

## Documents

- Name components by their names, and put no file paths and no file trees in a document.
- Never write scoped-out work, project decisions, shortcuts or broken rules as limitations. They are
  decisions, or they are defects.
- Mark a shortfall nobody has decided on OPEN and surface it, and never give it a date that makes it
  look settled.
- State a rule as neutral engineering law, and keep the motive behind the rule out.

## Messages

- Write paths, commands and identifiers in monospace.
- Make every message stand on its own, so it never depends on an earlier one to be understood.
- Use no jargon, no filler and no hedging, and do not restate the question.
- Write no preamble, no passage explaining why the thing matters, and no offer or next-step
  commentary at the end.
- Write no walls of text.
- Write no mannered speech.

## Words to avoid

Avoid the words of this list in code, comments, documents, commit messages and chat alike, whole
word, any casing:

rather than (as a phrase), worth, twist, caveat, seat, lane, leg, drive, doctrine, ruling, gate,
landed, cold, belt-and-suspenders, load-bearing, guessing, ground, wrinkle, guard, pin, owner,
masthead, flagging, the "X, not Y" shape.

- Use the plain replacement by default. The list is not absolute: a use can stand when the
  situation justifies it, and the justification has to be real.

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

- Say the actual thing in place of pin: locked to a revision, asserted exactly by a test, written
  into the spec. The word has no single replacement, because it has meant three different things in
  one day, which is the proof that it means nothing. A repository-internal document or an agent
  prompt may keep pinned as working vocabulary for a locked dependency.
- Use settle and settled inside a repository as domain vocabulary, and avoid them in prose addressed
  to a person.
- Avoid ruled and ruling everywhere, in favour of decided.
- Leave an identifier that already contains one of these words as it is: it is exempt.

## Patterns to avoid

- Delete announcement preambles. An opener whose only job is to introduce what follows gets deleted
  whole, including its colon, and the sentence begins at what came after it. "One thing to note:",
  "The honest answer:", "To be clear:", "Two things I could not decide for you.", "Five things:". If
  the sentence after the colon always stands without it, don't write it.
- Avoid forced triads, such as fast, reliable and scalable, and the same idea cycled through
  synonyms across consecutive sentences.
- Avoid roundabout constructions: serves as, acts as, plays a role in. Say what the thing does.
- Replace a superficial gerund clause, such as an ending that highlights the importance of
  something, with a real sentence.
- Avoid gratuitous boldface, formulaic headers, decorative emoji, and title case in a heading that
  is prose.
- Avoid pleasantries, hedging filler, and a generic conclusion that restates what was already said.
- Name the file, the number, the cause where a concrete mechanism fits, in place of impressionistic
  wording.
- Use a strong verb where one exists, in place of a weak verb propped up by an adverb, and the
  active voice where the actor is known.

## Em dashes

- Use a comma, a colon, or two sentences by default. Em dashes are reduced, not banned, and every em
  dash you keep has to earn its place.
- Put no em dash in a file that states rules.

## Umbrella rule

- Use no filler jargon anywhere, and simple language everywhere.
- Put messages to a person first. Keep process vocabulary out of them, and say every term of art in
  plain words a reader outside the project would understand.

## Text written before this file

- Do not rewrite existing text in passing. Put it into the project's own clean-up unit, or correct
  it where a piece of work touches it anyway.
