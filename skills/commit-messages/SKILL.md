---
name: commit-messages
description: Write commit message
---

- Write every message from zero, for reader who never read code, never took part in project and
  never saw session
- Never refer to thing known only inside session, by name or label given to it during work. Say
  what thing is, or leave it out
- Follow `workflow-skills:writing-style` and `workflow-skills:hygiene` in subject and body alike

## Subject line

- Write subject as plain imperative clause, never as conventional-commit `type(scope):`
- Write subject in one of these shapes:
  - `<imperative clause>`
  - `<scope>: <imperative clause>`
  - `<scope>: <sub-scope>: <imperative clause>`, with nested scopes in lowercase
  - `<scope>: <verb> X, <verb> Y`, joined by comma, for several verbs
  - unprefixed clause starting with capital letter, for broad change without single scope
- Name in scope a place: subsystem, or directory hierarchy collapsed to segments that contain
  information
- Give change affecting whole repository no prefix, or prefix `treewide:`
- Put extra facts into body. Do not add them after a dash in subject
- Keep subject at 72 characters ideally, with soft limit 80 and hard limit 120

## Body

- Write body in prose paragraphs, five parts, each present and distinguishable:
  - Before: what world was and did, in past tense
  - After: what world is and does now
  - What: contents of diff in plain language, so reader who never opens diff knows what is in
    it
  - Why: observation or motivation, what was seen going wrong or missing that made this the fix
  - Why useful: what change prevents or enables from now on, for people who plan the product
    and the work of the team. Never announce this part with label
- Back every claim of better performance or efficiency with numbers measured before and after
  change, with what was measured and how. Never claim gain that was not measured
- The last paragraph may say what change deliberately does not do, where that boundary matters
- Prefer periods over semicolons
- Use unambiguous language: expand compressed words
- Write lists as bullets `* ...`
- Keep body shorter than diff, unless change needs a real explanation
- Omit body for change that affects documentation only
- Break body lines at word boundary, at most 80 characters. Never break inside word or link

## Test lines

- End body with `Test:` lines, one per thing actually exercised: what was tested and which
  command ran
- Write each `Test:` line as past fact
- Never name test that would have run, should run or did not run
- Write `Test: none` when nothing was tested
- Break `Test:` line longer than 80 characters into several lines, ending every line but last
  with backslash and indenting continuation lines
- Break only between arguments, where backslash leaves command runnable, never inside quoted
  string or word, so joined lines are exactly command that ran
