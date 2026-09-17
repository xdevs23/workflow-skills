---
name: writing-style
description: The writing style and vocabulary every piece of text produced with this plugin follows, covering code comments, documents, commit messages and replies a person reads. Load it before writing any prose or committing.
---

# Writing style and vocabulary

## Scope

These rules bind code, comments, documents, commit messages, and every piece of text a person
reads, including replies in the terminal. A project that states its own convention explicitly wins
over this file.

## Code and comments

A comment describes what code can't express.

Names are plain words. Invented metaphors are out.

Nothing internal reaches a tracked file. No absolute paths, no facts about a session, no model
names, no details of a local setup.

A string addressed to a model addresses the model, and carries no repository paths.

An i18n key gets a comment at its reference site stating the intent of the string.

## Commits

The body is written from zero, for a reader with no memory of the session, in simple language, without mannered speech.

Process vocabulary, actor words such as owner, founder and admin as well as the word "ruled" stay out of the body.

A commit never carries the name of any model unless the commit is specifically about a model.

## Documents

A document names components by their names. It carries no file paths and no file trees.

Scoped-out work, project decisions, shortcuts and broken rules are never written as limitations.
They are decisions, or they are defects. A shortfall nobody has decided on is marked OPEN and
surfaced, never given a date that makes it look settled.

A document that states a rule is neutral engineering law. The motive behind the rule stays out.

## Words to avoid

The list below is banned in code, comments, documents, commit messages and chat alike, whole word,
any casing.

rather than (as a phrase), worth, twist, caveat, seat, lane, leg, drive, doctrine, ruling, gate,
landed, cold, belt-and-suspenders, load-bearing, guessing, ground, wrinkle, guard, pin, owner,
masthead, flagging, the "X, not Y" shape.

The list is not absolute. A use can stand when the situation justifies it, and the justification
has to be real. The default is the plain replacement.

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

The word pin has no single replacement, because it has meant three different things in one day,
which is the proof that it means nothing. Say the actual thing: locked to a revision, asserted
exactly by a test, written into the spec. A repository-internal document or an agent prompt may
keep pinned as working vocabulary for a locked dependency.

Settle and settled are allowed inside a repository as domain vocabulary and
avoided in prose addressed to a person. Ruled and ruling are avoided everywhere, in favour of
decided.

An identifier that already contains one of these words is exempt.

## Patterns to avoid

Announcement preambles. An opener whose only job is to introduce what follows gets deleted whole,
including its colon, and the sentence begins at what came after it. "Worth saying plainly:", "One
thing to note:", "The honest answer:", "To be clear:", "Two things I could not decide for you.", "Five things:".
If the sentence after the colon always stands without it, don't write it.

Forced triads, such as fast, reliable and scalable, and the same idea cycled through synonyms
across consecutive sentences.

Roundabout constructions: serves as, acts as, plays a role in. Say what the thing does.

Superficial gerund clauses, such as an ending that highlights the importance of something. Write a
real sentence instead.

Gratuitous boldface, formulaic headers, decorative emoji, and title case in a heading that is prose.

Pleasantries, hedging filler, and a generic conclusion that restates what was already said.

Impressionistic wording where a concrete mechanism fits. Name the file, the number, the cause.

A weak verb propped up by an adverb where a strong verb exists. The passive voice where the actor
is known.

## Em dashes

Reduced, not banned. The default is a comma, a colon, or two sentences, and every em dash kept has
to earn its place. A file that states rules carries none.

## Umbrella rule

No filler jargon anywhere, and simple language everywhere.

Messages to a person come first. They carry no process vocabulary, and every term of art is said in
plain words a reader outside the project would understand.

## Text written before this file

Existing text is not rewritten in passing. It goes into the project's own clean-up unit, or it is
corrected where a piece of work touches it anyway.

