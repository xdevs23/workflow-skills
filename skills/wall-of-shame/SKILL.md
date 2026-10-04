---
name: wall-of-shame
description: Applies when a rule violation is flagged, by the user or by yourself, and when the user voices frustration with your work or you overstep.
---

# The wall of shame

**Load the `workflow-skills:writing-style` skill first.** It binds every comment, document, commit
message and reply this skill produces, and it is not optional when working with this plugin.

The wall of shame is a set of append-only files in the `wall-of-shame` directory of the Claude
configuration directory, one per day, each named after its date in ISO 8601 form. Each entry
records one rule violation of a coding-agent session on the machine: the model, its words quoted
from the transcript, the rule it broke quoted from where it lives, a plain roast of the failure,
and the transcript line.

## Why it exists

Rules alone do not stop repeat violations. A session breaks a rule it has in context, apologises,
and breaks it again. The wall turns each violation into a permanent record tied to a model, a
session and a transcript line, so the record can be checked and cannot be argued away later.
Recurring entries show which rules sessions keep breaking and which wording fails, and the user
changes the rules from that evidence. The user can also follow how well each model keeps to the
rules over time.

Nothing writes or reads the files automatically: no hook, script or harness setting does. The wall
works only because you follow this skill.

## When you write an entry

- Append an entry in the same turn when the user flags a violation of yours.
- Append an entry without being told when you catch a violation of your own.
- When the user reports a violation of another session to you, append it after reading that
  session's transcript for its verbatim words, their date and time, and their line.
- When a reviewer's finding turns out to come from a model breaking a rule, record it as that
  model's violation. A stage that writes nothing, such as a reviewer, reports the violation, and you
  record it when you record the run's remaining items.
- Read a message of the user as a possible flag when it reminds you of something said before,
  orders you to stop or to revert, says something was never said or approved, is written in
  capitals, or speaks of disappointment, of invention or of something that makes no sense. Decide
  whether it concerns a violation before you write the entry.
- Record a due entry you did not write as a violation of its own, in an entry of its own.

## The entry

Each entry is a level-2 heading followed by four labelled paragraphs:

```markdown
## <date and time> · <project> · <model>: <one-line summary>

**Said:** the offending words, verbatim from the transcript.

**Broke:** the rule, quoted from the rules file or rulebook it lives in.

**Roast:** what went wrong, stated plainly and bluntly.

**Where:** <transcript file>:<line>
```

- Write in the heading the date and time of the offending words, taken from the transcript, in the
  user's timezone in ISO 8601 with its offset.
- Name in the heading the project and the exact model ID, with a note where the role matters, such
  as root session, implementer or rule reader.
- Copy the words in **Said:** verbatim from the transcript. A command or a line of code counts as
  words.
- Quote the rule in **Broke:** word for word, with its section where it has one. One entry may cite
  several rules.
- Name in **Roast:** the failure and why it was avoidable, which is usually that the rule was in
  context. Say it as bluntly as you would to someone who broke a rule that stood in front of them,
  and aim it at the output of the model.
- Point **Where:** at the transcript file in the `projects` directory of the Claude configuration
  directory and at the line, so anyone can open the original.

## What the wall does not allow

- Never edit an old entry: nothing is deleted, reworded or softened. A mistaken entry gets a
  correction entry below it.
- Never change the rules an entry cites. Rule changes are made at the user's word.
- Put the fix for a violation into the todo record that `workflow-skills:todo-md` defines, and a new
  rule into the rules files. The wall holds only the record of what happened.
