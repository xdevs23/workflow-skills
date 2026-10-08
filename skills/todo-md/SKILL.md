---
name: todo-md
description: Keep track of work, add units of work to the todo list, record project feature requests
---

When the session has a skill named `todo-md` without the plugin prefix, that skill applies and this
one does not. This skill, `workflow-skills:todo-md`, applies only when it is the only `todo-md`
skill available.

`TODO.md` is the durable record of project state. Anyone picking up a project (a new
session, a new contributor, an agent with no history) reads that file first and knows where
things stand. This document says how to write into it.

Where a project defines its own run-state convention or file location, that project's
convention wins.

# 1. What it is, and what it is not

`TODO.md` holds **what is left, and where each item currently stands**.

- Keep local project status in `TODO.md` and nowhere else. An in-session task list disappears when
  the session ends, and private notes are invisible to everyone else, so neither one may hold
  status.
- Record here any fact about project advancement that exists nowhere else.

The file is **gitignored and untracked**: it is a working file on one machine, not repository
content. A fresh clone does not have it. That is deliberate: it changes constantly and it
carries operational detail that should never enter the history.

Four records divide the work between them:

| Record | Holds |
|---|---|
| `TODO.md` | Open work, its order, its current state, and the decisions still owed |
| git history | What changed, and when it was committed |
| design docs (wherever the project keeps them) | The durable design for a change, including the alternatives rejected and why |
| in-session task list | This session's steps only; disposable |

When an item finishes, its **design** stays in the design docs, its **diff** stays in git, and its
`TODO.md` entry shrinks to a receipt.

- Do not re-explain a design here that a design doc already carries.

# 2. Layout of the file

- Keep the file OLDEST FIRST: entries carry ascending ids and the newest entry is the last one in
  the file, so a reader follows the project's history in the order it happened.
- Append to the ledger, and never insert into it.
- Put reference material (header, conventions) first, then the record in id order:

1. **Header**: what the file is, plus the conventions that apply to every entry (reference this skill)
2. **Incidents**: recorded failures kept verbatim so they do not repeat. Each one states what
   happened, the cost, and the sharpened instruction that came out of it. If the incident is structurally
   prevented from happening through code, tests or by construction, remove the entry, and instead
   explain within the resolving change what incident type it addresses.
3. **Current queue**: the active order of work, with the deployment state that precedes it.
   A newer queue block is appended below the older ones and says which it supersedes; the
   older blocks stay.
4. **Deploy state**: what is live where, with commit hashes and verification receipts.
5. **Open sections by area**: the per-item entries, grouped by project area.

# 3. Anatomy of an entry

```
### #142 - Reaction emoji support - RECORDED
<body: what it is, where it stands, what proves it, the full theory if known>
```

- **`### #<number> - <title>`**: the number is the tracker id and never changes. The title says
  what the item *is*, not what state it is in. If the project has its own convention of IDs, keep
  the internal numbering as it is, and add the project's ID on top, for example:
  `#142 - GH #73 - Reaction emoji support - RECORDED`
  `#165 - ABC-210 - User type 'editor' - IN PROGRESS`
- **`— <STATE>`**: the state marker, uppercase, after the separator dash the format uses. See §4.
- **Date**: Do not add a date. Commit messages and mtime already give us the information we need.
- **Body**: prose. What the item is, what has been proven, what is owed. Receipts belong here:
  commit hashes, workflow ids, run numbers, counts from a real run.
- **Origin pointer**: `<transcript>.jsonl:<line>:<promptId or uuid>`, the session transcript and the line of the
  first message of the conversation that raised the item. Every entry carries one: a decision
  or a potential work unit with no pointer is one nobody can trace back to its words.
  Finding the line: search the project's session transcript directory for the promptId or uuid or read the specified line directly.

- Give a sub-item a fourth level (`#### #29.1 — ...`) and the same shape.

## One behavior to a unit

- Give a unit one behavior: something one sentence can state, such as "the profile page shows the
  avatar".
- Split a request that holds several behaviors into sub-units in dot notation under the entry for
  the request, one sub-unit per behavior, each naming the sub-units it builds on:

  ```
  ### #383 - Profile avatars - IN PROGRESS
  #### #383.1 - The profile page shows the avatar - BUILT
  #### #383.2 - The avatar can be replaced - IN PROGRESS
  Builds on #383.1.
  #### #383.3 - A replaced avatar is resized to the page's sizes - QUEUED
  Builds on #383.2.
  ```

- Build each sub-unit in its own worktree, on its own branch, with one or more workflow runs, and
  deliver it as its own pull request, or as its own commits where the project takes no pull
  requests. One behavior per pull request follows from one behavior per unit.
- Record a finding about a behavior the unit does not hold as a unit of its own, never as part of
  the unit that found it.

# 4. The states an entry can take

The state is a fixed enum: either no marker or one of the markers below. Grouped by where the
item sits:

**Recorded**

- `RECORDED`: captured so it is not lost, deliberately not in the queue.

**Waiting on a decision**

- `NEEDS DECISION`: the work cannot proceed until a question is answered or the theory is defined.
  The entry must state the question, and the options, in plain terms or that the theory is missing,
  which would trigger a discussion thread about the feature-.

  A decision that is owed **blocks the item, not the queue**. Skip and flag the item, and move the
  work to the next one. Stopping the whole queue on an open question is a recorded incident, not a
  practice.

**Ready to build**

- `READY`: the design is agreed and written down. The entry names the design doc. Work does not start yet.
- `TODO`/`QUEUED`: the unit can be built at any time, even if the session is wiped and started fresh.

The user's words alone decide whether a unit is ready to build.

- Never decide it yourself.
- When you infer authorization from a prompt of the user because its words are ambiguous, state that
  plainly **in bold** and ask the user to confirm.

**Being built**

- `IN PROGRESS`: under construction. Name the workflow id if one is running, so a later reader can find the transcript.

**Built, not yet live**

- `BUILT`: the code exists and is committed, but has not been confirmed deployed or pushed.

**Live**

- `PUSHED`: Pushed, but deployment is not confirmed. Ask the user if you need confirmation.
- `SHIPPED`: deployed to production, with the commit and the deployment receipt, if available
- `VERIFIED`: observed working in production. This is a stronger claim than `LIVE` and needs
  an observation to back it: a log line, a count, a screenshot reference. Reading the code is
  not verification.

**Stopped**

- `PARKED`: deliberately not being done. State why, so the reason can be re-examined instead of re-derived.

**Held**

An item can be finished but deliberately withheld.

- Mark it `HELD CHANGE` inside the entry it belongs to.
- State exactly what must happen first, and state what would go wrong if it shipped early.
- Keep it out of a commit: a held change is the one case where a correct, passing change must stay
  out of a commit.

## 5. Writing style

- **Write for a reader with no context.** Every entry is read fresh. A reader who was not there
  must be able to act on it without asking anything.
- **State the fact, then the evidence.** A claim with no receipt ages into folklore. Prefer
  "boot clean: zero index-creation failures, backfill matched=6 updated=6" over "deployed fine".
- **Write dates as absolute dates.** Never "today", "last week", "recently". Write `2026-08-08`.
  Give timestamps `Z` with UTC when the hour matters.
- **Spend uppercase, since it carries weight.** Uppercase marks a state, a hard constraint, or
  something that costs money or data if missed. Uppercase everywhere reads as noise and hides the
  parts that matter.
- **Supersede, never rewrite, append below.** A newer queue block says what it supersedes and is
  written after the old one; the old block stays. Ids ascend down the file; nothing is inserted
  above an older entry. History is what makes a decision re-checkable. Delete only what was
  factually wrong, and say so.
- **Keep corrections visible.** When an entry turns out to be wrong, correct it in place and note
  what it said before. Record an item found already shipped, or a claim found false, as such.
- **Accept a limitation only when it is an EXTERNAL system's limit**, and give it its official
  source, the date it was checked, and a sign-off naming whoever model and session wrote it.
  Scoped-out work, a choice the project made, a shortcut or a broken rule is never one, and a
  shortfall relabelled as a dated "decision" is the same laundering one step over.
- **Write plain language.** No filler openers, no compressed jargon. Write enumerations as bullet
  lists, not run-on sentences joined by dashes or semicolons. Do not use mannered speech.

## 6. What never goes in

- **Absolute local paths, machine names, personal details.** Repo-relative paths only.
- **Credentials, endpoints with secrets, internal identifiers that are not needed to act.**
- **Session narration.** "I then asked...", "after the model replied...": none of it. Record
  the decision and its date, not the conversation that produced it.
- **Credentials of any kind**, even though the file is local. They leak by being copied.

- Record operational detail that must never reach a commit (which models or accounts ran a step,
  machine-local specifics) here where it helps, since `TODO.md` itself is gitignored and untracked.
- Never let any of it cross into a tracked file, a doc, or a commit message. The rule that binds is
  the destination.

## 7. When to write

Write into `TODO.md` at these moments, without being asked, at any moment, during and after turns:

- When it doesn't exist, record whatever work is currently in flight, or create an empty file.
- Anything is discussed as a potential work unit, or anything is decided — the same turn,
  with its status marker and its origin pointer, even when the answer was "not now".
- A state changes: something starts, finishes, gets committed or deployed, or gets held.
- A decision is made, or a new one becomes owed.
- The order changes.
- Something is deployed. Record the commit, the run, and what the boot logs showed.
- Something is owed to whoever operates production: a manual step, an index to drop, a
  backfill to run. These are easy to lose and expensive to forget.
- An item turns out to be already done, or wrongly described.

The test for whether an update is needed: **if the session ended right now, would the next
reader know what to do?** If not, the file is stale.
