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

It is the only place local project status lives. An in-session task list disappears when the session
ends, and private notes are invisible to everyone else, so neither one may hold status. If a
fact about project advancement exists nowhere else, it belongs here.

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

The consequence: when an item finishes, its **design** stays in the design docs, its **diff**
stays in git, and its `TODO.md` entry shrinks to a receipt. Do not re-explain a design here that
a design doc already carries.

# 2. Layout of the file

The file reads OLDEST FIRST: entries carry ascending ids and the newest entry is the last one
in the file, so a reader follows the project's history in the order it happened and the ledger
is appended, never inserted into. Reference material (header, conventions) comes first, then
the record in id order:

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

Sub-items take a fourth level (`#### #29.1 — ...`) and follow the same shape.

# 4. The states an entry can take

The state is a fixed enum: either no marker or one of the markers below. Grouped by where the
item sits:

**Recorded**

- `RECORDED`: captured so it is not lost, deliberately not in the queue.

**Waiting on a decision**

- `NEEDS DECISION`: the work cannot proceed until a question is answered or the theory is defined.
  The entry must state the question, and the options, in plain terms or that the theory is missing,
  which would trigger a discussion thread about the feature-.

  A decision that is owed **blocks the item, not the queue**. The item is skipped and flagged;
  work moves to the next one. Stopping the whole queue on an open question is a recorded
  incident, not a practice.

**Ready to build**

Whether a unit is ready to build is decided by the user's words only, and may not be decided by the agent.
If a user's prompt is inferred as authorization due to ambiguity in the words, you must plainly state it **in bold**
and ask the user to confirm.

- `READY`: the design is agreed and written down. The entry names the design doc. Work does not start yet.
- `TODO`/`QUEUED`: the unit can be built at any time, even if the session is wiped and started fresh.

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

An item can be finished but deliberately withheld. Mark it `HELD CHANGE` inside the entry it
belongs to, state exactly what must happen first, and state what would go wrong if it shipped
early. A held change is the one case where a correct, passing change must stay out of a commit.

## 5. Writing style

**Write for a reader with no context.** Every entry is read fresh. A reader who was not there
must be able to act on it without asking anything.

**State the fact, then the evidence.** A claim with no receipt ages into folklore. Prefer
"boot clean: zero index-creation failures, backfill matched=6 updated=6" over "deployed fine".

**Dates are absolute.** Never "today", "last week", "recently". Write `2026-08-08`. Timestamps
carry `Z` with UTC when the hour matters.

**Uppercase carries weight; spend it.** Uppercase marks a state, a hard constraint, or
something that costs money or data if missed. Uppercase everywhere reads as noise and hides the
parts that matter.

**Supersede, never rewrite, append below.** A newer queue block says what it supersedes and is
written after the old one; the old block stays. Ids ascend down the file; nothing is inserted
above an older entry.
History is what makes a decision re-checkable. Delete only what was factually wrong, and say so.

**Corrections stay visible.** When an entry turns out to be wrong, correct it in place and note
what it said before. An item found already shipped, or a claim found false, is recorded as such.

**An accepted limitation is only ever an EXTERNAL system's limit**, and it carries its official
source, the date it was checked, and a sign-off naming whoever model and session wrote it. Scoped-out work, a
choice the project made, a shortcut or a broken rule is never one, and a shortfall relabelled
as a dated "decision" is the same laundering one step over.

**Plain language.** No filler openers, no compressed jargon. Enumerations are bullet lists, not
run-on sentences joined by dashes or semicolons. Do not use mannered speech.

## 6. What never goes in

- **Absolute local paths, machine names, personal details.** Repo-relative paths only.
- **Credentials, endpoints with secrets, internal identifiers that are not needed to act.**
- **Session narration.** "I then asked...", "after the model replied...": none of it. Record
  the decision and its date, not the conversation that produced it.
- **Credentials of any kind**, even though the file is local. They leak by being copied.

`TODO.md` itself is gitignored and untracked, so operational detail that must never reach a
commit (which models or accounts ran a step, machine-local specifics) may be recorded here
where it helps. The rule that binds is the destination: none of it may cross into a tracked
file, a doc, or a commit message.

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
