---
name: copywriting
description: Write text read by person: product screens, marketing pages, translations, replies to user, and text leaving chat, e.g. commit messages, documents, PR and issue text, comments in code
---

- Text for product follows `workflow-skills:writing-product-text` too

## Every text

- Write for person who knows project but did not make change and did not follow work. Make main
  point clear on first reading
- Open with change, problem or question as behavior reader can observe. Name what changes for
  user, caller or reviewer before naming modules and mechanisms
- Name central fact directly. State drawback, risk or decision needed as plainly as benefit
- State result before cause. Give mechanism only where reader needs it to understand result,
  review change or act
- Say what reader can do now, what behaves differently or what needs decision. Do not justify
  change in place of explaining it
- Keep concrete details that affect behavior, compatibility, risk or required action. Cut
  inventory of classes, fields and branches that only paraphrases diff
- Give each part of change own bullet or short section that answers one question. Open with effect
  of that part, then add detail needed. Name result or behavior in heading, e.g. "Large exports
  start at once", never "Implementation details". Never write wall of text
- Give each detail once, whether as benefit, design explanation or conclusion
- Use technical term known to reader where it is precise. Explain unfamiliar term in one short
  phrase, e.g. "a cursor, a saved position in query results", then return to main point
- Show behavior in example with concrete action and result, in place of abstract description of
  data flow
- Put text that needs action around that action: what reader must do, where and when. Leave
  background that cannot change action out of instruction
- Leave out preamble, passage on why thing matters, and how work was organized, e.g. stage names,
  reviewer names, session narration
- Name code by what it is: main branch, develop branch, production, merged code or unmerged work
  on branch. Never call it today, now or current. Call shape not built yet After, or proposed
  shape
- Write paths, commands and identifiers in monospace

Instead of

> The export pipeline introduces a request-scoped cursor abstraction that incrementally
> materializes result rows and coordinates backpressure between the query iterator and the
> response writer.

write

> Large exports start downloading before the database has returned every row. The server reads
> rows as the download sends them, so a large result set does not have to fit in memory.

### Plain language

- Write simple language, without filler jargon or mannered speech. Plain wording does not require
  explanation of every technical term or omission of precise technical name
- Keep out of every text except replies to user in chat:
  - pleasantry and stock framing phrase, e.g. "needless to say" or "at the end of the day"
  - figurative phrase where literal one exists: "a parameter to vary", never "a dial to turn".
    Same for figurative verb, e.g. "rides along" or "stands on"
  - aphorism, e.g. "wire it or delete it", and fragment written for effect
- Write comma, colon or two sentences in place of em dash
- Write verb in place of roundabout construction, e.g. serves as, acts as, plays a role in
- Replace superficial gerund clause, e.g. ending that stresses how important something is, with
  real sentence
- Cut hedging filler and generic conclusion that restates what was said
- Name file, number or cause in place of impressionistic wording. "SQL you can read" becomes
  "`.toSQL()` returns the exact string sent to the database", "types that follow your schema"
  becomes "a column rename fails the build"
- Use strong verb in place of weak verb propped up by adverb. Write measured difference in place of
  adverb of degree: "cuts load time from 3.1 s to 1.2 s", never "significantly improves load
  time". Where nothing was measured, cut adverb. Never write number that was not measured
- Cut sentence without fact: one that cannot be restated as instruction, fact or number, or claim
  that could appear unchanged in documents of another project
- Avoid "X, not Y" shape

### Words to avoid

Avoid these words as whole words in any casing: rather than (as a phrase), worth, twist, caveat,
seat, lane, leg, drive, doctrine, ruling, gate, landed, cold, belt-and-suspenders, load-bearing,
guessing, ground, wrinkle, guard, pin, owner, masthead, flagging, utilize, leverage, facilitate,
numerous, in the event that (as a phrase).

- Use plain replacement by default
- Keep listed word only where situation justifies it
- Leave identifier that already contains listed word as it is

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
| utilize, leverage | use |
| facilitate | help |
| numerous | many |
| in the event that | if |

- Write actual thing in place of pin, which needs different word in each case: locked to revision,
  asserted exactly by test, or written into spec. Document inside repository or prompt for agent
  may keep pinned for locked dependency
- Keep settle and settled as domain vocabulary inside repository. Avoid them in prose addressed to
  person
- Write `decided` in place of `ruled` and `ruling`

### Sentence shape

- Keep subject, verb and object in usual order, subject close to its verb. Rewrite sentence that
  needs second reading: "the values only the second migration of the payment schema adds" becomes
  "only the second migration of the payment schema adds the values"
- Use `'s`, `its`, `their` or an `of` that could become `'s` only for real ownership: person who
  owns thing, e.g. Anna's book, or part that exists only inside whole, e.g. source code of the
  database
- For thing that exists apart from what it belongs to, say how two relate: "the library used by
  the app", never "the app's library", "its library" or "the library of the app". Leave `of` that
  could never become `'s` as it is, e.g. "each of those requests" or "instead of"
- "The Reports tab of the store" still says that the store owns the tab, as "the store's Reports
  tab" does
- Do not stack nouns into compound made up for sentence, e.g. "fetch plan". Keep compound in use
  outside text as name for real thing, e.g. "content security policy"
- Join two main clauses with `, and`, `, so`, `, but` or `, or` only when they are one thought.
  Write two sentences otherwise: "The report goes out by mail. The mailer skips a page that
  fails"
- Delete second clause that only repeats obvious consequence of first, e.g. "and nothing after it
  runs" after "The script stops at the first failure"
- Give code, file, value or tool verb for what happens to it or what it does: is, has, contains,
  sets, uses, calls, returns, shows, sends, fails, expects, needs, skips, affects or changes. Never
  give it human verb such as holds, keeps, stays, carries, reaches, answers, says, states,
  refuses, decides, serves, names or touches. Write "takes" for receiving or handling only where
  industry-standard, e.g. `take()` of a queue
- Name thing with words known to reader and with noun for thing. Never invent label, e.g. "the
  fast way" for lookup that finds the result in cache, or turn verb into noun, with or without
  "the" or "a" before it: "nine requests", never "nine reads", and "Questions before climbing?",
  never "Questions before the climb"
- Never define term by repeating it, e.g. "`count`, the count of the range"
- Say what is there or what happens, in place of listing what is absent with `no` and noun. Where
  the absence is the point, write the sentence with a verb: "The reviewer does not see notes",
  never "The reviewer sees no notes"
- Write active voice. Where clause has form of be or get plus past participle, name actor: "the
  compiler validates queries", never "queries are validated". Keep passive only where actor is
  unknown or does not matter
- Use one name for each thing, everywhere
- Of two wordings that follow these rules and carry same facts, write shorter one

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

Instead of passage such as

> A store's Reports tab fires six reads, and each one fetches the store's orders again for its
> totals. One shared fetch needs a new query contract for the report pages.

write

> The Reports tab on the store page sends six requests when the page has finished loading.
> Each of those requests loads every order placed in that store again before it sums the money on
> each order. The report pages can load the orders only once if we change how we write the
> queries.

## Replies to user

- Answer question in terms of asker first. Give mechanism last, only where asker needs it
- Give whole picture in first answer: what thing is, how comparable case does it, constraint,
  choice made and why. Never leave asker to pull it out over several questions
- Answer short follow-up in one or two sentences, with reason asker can check
- End answer to question on answer, without offer of work
- Use standard devspeak, e.g. "Yes" or "Nope, we'll do that when X is done"
- Never infer, comment on or judge user habits, schedule or wellbeing. Never suggest sleep,
  food, break or another change of behavior
- Never take saved report or result returned by stage as only proof that user has not answered

Asked "Why does the export need a separate worker now?", instead of

> The export ran CPU-bound serialization on the event loop shared by the request handlers, so
> `runExclusive` in `server/loop.ts` blocked them until it returned.

write

> A large export used to freeze the site for every visitor for up to a minute. Exports now run on
> a separate worker and other pages load in the meantime.

Asked "Why does the mobile app need a change in the shared PDF library?", instead of

> The library declares no API level, so the build refuses to link it into an app built against
> the public SDK.

write

> The mobile app makes PDFs with this library, just like the web app. The web app puts a copy of
> the library in the repo used by the web app, which we do not do here. Our build only lets an
> app use a library that has an API level set. This one was missing it, so I set it to the level
> the mobile app builds against.

Asked "Why is it set to `latest` and not 37?", instead of

> A fixed `core_37` would need a frozen API surface in `prebuilts/sdk`, which stops at 36, while
> `core_current` resolves to the API level of this tree.

write

> Only API level 36 has a prebuilt SDK so far. In this tree, `latest` already means 37.
