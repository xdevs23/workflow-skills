# Rules summary

This file contains a short form of the rules in `workflow-skills:engineering-principles`,
`workflow-skills:code-writing`, `workflow-skills:writing-style` and `workflow-skills:hygiene`.
Those four skills contain the full rules. The reviewers check every change against them.

- Build only what the task needs, at the smallest size at which the code is still clean. Remove
  code that is unused, unasked for or overbuilt.
- Read the code first, reuse what the project has, and write every part once.
- Add a new kind of thing through a registry. Never name a concrete case in shared code. Convert
  data wherever it crosses from one layer to another.
- Keep data, logic and presentation apart, give each component one job, and keep business logic out
  of endpoints, command handlers and adapters.
- Make each decision in one place, and keep the truth in durable state. Derive state from the data
  it follows from, and never store it next to that data.
- Write one change in one transaction, record before you act, and never synchronize by time.
- Fix a hazard in the architecture itself. Never fix it with a hack, a band-aid, a workaround or a
  protective check. Do not add a special case where the existing path covers the case.
- Type all data. Define a closed set of values once, as an enum in the module for the concept it
  belongs to. Convert text to that enum once, where the text enters the program.
- Never write a parser by hand for an established format. Build output from typed parts.
- Never set a limit yourself. Accept an external limit only with its official source, its cost, the
  date the source was checked and approval from a person.
- Fail loud and closed. Handle or pass on every error, and deny an unknown identity every
  permission.
- Keep secrets unprintable and out of every tracked file, log and message. Keep transport security
  on.
- Give every error that a person sees a next step. Retry a failure automatically only when it is
  known to be temporary.
- Fix every known defect, keep what works, and never relax an invariant.
- Never put text on a product screen that explains the product.
- Test an expectation on input that the test builds. Never test the text stored in a file. Keep
  tests deterministic, fast and off the network.
- Prove a change on the code path that really runs, and state for every claim how you know it.
- Write code that reads like the code around it. Use plain names, write comments only for what the
  code can't show, and use the idioms of the language and the form it has for a closed set.
- Write simple language. Leave out filler, jargon, preambles and mannered speech.
- Use `'s` or an `of` that could become `'s` only for real ownership, such as Anna's book.
  Everywhere else, say how two things relate: where one sits, what it contains, what it needs or
  what it does.
- Say what a thing is or does in place of stacking nouns into a new name.
- Join two clauses with `, and` only when they are one thought. Write two sentences otherwise.
  Delete a second clause that adds nothing.
- Say what is there or what happens in place of listing absences with `no` and a noun. Where the
  absence itself is the point, write it as a sentence with its own verb.
- Give code, a file, a value or a tool the verb for what it does or what happens to it, such as is,
  has, contains, returns or uses. Never give it a human verb such as holds, keeps, states, answers
  or decides.
- Name a thing with words the reader already knows. Never invent a label for it.
- Use a comma, a colon or two sentences by default in place of an em dash. Never put an em dash in a
  file that contains rules.
- Avoid the words in the list in `workflow-skills:writing-style`, such as gate, guard, pin, cold,
  landed, load-bearing and owner.
- Keep the user's words, facts about the local setup, local absolute paths, model names and secrets
  out of every tracked file and commit.
- Describe the technical change in a commit message. Leave out process vocabulary, model names and
  the `Co-Authored-By` line.
