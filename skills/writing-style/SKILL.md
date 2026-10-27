---
name: writing-style
description: Writing text read by a person, such as code comments, documents, commit messages and replies.
---

## Plain language

- Write simple language everywhere. Do not use filler jargon and mannered speech.
- Apply plain language most strictly in message to a person:
  - Leave out words about how work was organized, e.g. stage names, reviewer names, session
    narration.
  - Say every term of art in plain words, understood by reader outside project.
- When talking to user directly, use standard devspeak, one to two simple sentences. A simple "Yes"
  or "Nope, we'll do that when X is done.".

## Sentence shape

- Use `'s`, `its`, `their` or an `of` that could become `'s` only for real ownership:
  - a person who owns a thing, such as Anna's book or Tom's table;
  - a part that exists only inside the whole, such as the source code of the database or the
    design of that website.
- Never write a thing that exists apart from what owns it. Write "the library used by the app",
  never "the app's library" or "its library".
- Leave an `of` that could never become `'s` as it is, e.g. "each of those requests" or "instead
  of".
- Where one thing does not own the other, say how the two relate.
- Do not fix possessive by turning it around. "The Reports tab of the store" still reads as if the
  store owned the tab, just like "the store's Reports tab".
- Do not stack nouns into a compound made up for the sentence, e.g. "fetch plan" or "session
  handoff record".
- Keep compound already in use outside the text as name for real thing, e.g. "content security
  policy".
- Join two main clauses with `, and`, `, so`, `, but` or `, or` only when they are one thought.
  Write two sentences otherwise. "The report goes out by mail, so a page that fails is skipped"
  joins two thoughts. Write "The report goes out by mail. A page that fails is skipped."
- Delete second clause that adds nothing to first. In "The script stops at the first failure, and
  nothing after it runs", second clause only repeats obvious consequence of first.
- Give code, file, value or tool the verb for what happens to it or what it does: is, has,
  contains, sets, uses, calls, returns, shows, sends, fails, expects, needs, skips, affects or
  changes. Never give it human verb such as holds, keeps, stays, carries, reaches, answers, says,
  states, refuses, decides, serves, names or touches.
- Never write that code takes something in sense of receiving or handling it, as in "the import
  takes the file". Use it only when it's the industry-standard way of saying it: "take() returns
  the first element of the collection, removing it atomically in the process".
- Name thing with words already known to reader. Never invent label for it, e.g. "the fast way"
  for a lookup that finds its result in the cache.
- Say what is there or what happens, instead of listing what is absent with `no` and a noun.
- Where absence itself is the point, write it as sentence with a verb, e.g. "The reviewer does not
  see the notes." instead of "The reviewer sees no notes".
- Name thing with noun for the thing, never with verb turned into noun. Write "nine requests" in
  place of "nine reads", and "the list of orders" in place of "one listing".
- Never define term by repeating it, as in "`count`, the count of the range" or "a ranking ranks".
  Say what term means in other words.
- Keep subject, verb and object in usual order. Subject close to its verb. Rewrite sentence that
  needs a second reading, e.g. "the values only the second migration of the payment schema adds"
  into "only the second migration of the payment schema adds the values".
- Where noun is object of the clause after it, put verb after noun as participle: "the file read by
  the importer", never "the file that the importer reads" or "the file the importer reads". Keep
  `that` where noun itself does what verb says, as in "the request that fails".

| Instead of | Write |
|---|---|
| the store's Reports tab | the Reports tab on the store page |
| the store's orders | the orders in the store |
| the upload's token | the token needed by the upload |
| the importer's file | the file read by the importer |
| the fetch plan | the list of pages to fetch |
| the check has no rules of its own | the check applies the rules handed to it |
| no request goes out | the page sends the request once the form is complete |
| the service answers the totals | the service returns the totals |
| the file holds the settings | the file contains the settings |

- Instead of a passage such as

  > A store's Reports tab fires six reads, and each one fetches the store's orders again for its
  > totals. One shared fetch needs a new query contract for the report pages.

  write

  > The Reports tab on the store page sends six requests when the page has finished loading.
  > Each of those requests loads every order placed in that store again before it sums the monetary order values.
  > The report pages can load the orders only once if we change how the queries are written.

- Avoid cycling one idea through synonyms across consecutive sentences.
- Avoid roundabout constructions, e.g. serves as, acts as, plays a role in. Say what the thing
  does.
- Replace superficial gerund clause, e.g. ending that stresses how important something is, with
  real sentence.
- Avoid pleasantries, hedging filler, generic conclusion that restates what was already said.
- Name file, number or cause where concrete mechanism fits, in place of impressionistic wording.
- Use strong verb where one exists, in place of weak verb propped up by adverb.
- Avoid the "X, not Y" shape.

## Words to avoid

Avoid these words in code, comments, documents, commit messages and chat alike, as whole words in
any casing: rather than (as a phrase), worth, twist, caveat, seat, lane, leg, drive, doctrine,
ruling, gate, landed, cold, belt-and-suspenders, load-bearing, guessing, ground, wrinkle, guard,
pin, owner, masthead, flagging.

- Use plain replacement by default.
- Keep listed word only where situation really justifies it.
- Leave identifier that already contains listed word as it is.

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

- Write the actual thing in place of pin, which needs different word in each case: locked to a
  revision, asserted exactly by a test, or written into the spec. Document inside repository or
  prompt for agent may keep pinned for locked dependency.
- Keep settle and settled as domain vocabulary inside repository. Avoid them in prose addressed to
  a person.
- Write `decided` in place of `ruled` and `ruling`, everywhere.

## Em dashes

- Use comma, colon or two sentences by default.

## Code and comments

- Write code, its comments, its names and its strings by `workflow-skills:writing-code`.
- Follow this skill in comments and strings as in all other text.

## Commits

- Write body of commit message from zero, for reader who never saw the session.

## Messages

- Write paths, commands and identifiers in monospace.
- Leave out jargon, filler and hedging.
- Leave out preamble and any passage on why the thing matters.
- Do not write walls of text.
- Never take saved report or result returned by a stage as only proof that user has not answered.
- Name code by what it is, in question, page or picture alike: the main branch, the develop
  branch, production, the merged code or the unmerged work on a branch. Never call it today, now or
  current.
- Call shape not built yet After, or the proposed shape.
- Never infer, comment on or judge habits, schedule or wellbeing of the user. Never suggest sleep,
  food, a break or another change of behavior.
