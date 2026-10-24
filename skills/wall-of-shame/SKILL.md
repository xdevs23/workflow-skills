---
name: wall-of-shame
description: Applies when the user or you point out a rule violation, and when the user voices frustration with your work or you overstep.
---

# The wall of shame

**Load the `workflow-skills:writing-style` skill first.** The rules in it apply to every comment,
document, commit message and reply you write while you follow this skill. Load it whenever you work
with this plugin.

The wall of shame is a set of append-only files in the `wall-of-shame` directory inside the Claude
configuration directory, one file per day, each named after its date in ISO 8601 form. Each entry
describes one rule violation by a session of a coding agent on the machine: the model, the words
written by the model and quoted from the transcript, the broken rule quoted from the file that
contains it, a plain roast of the failure, and the line in the transcript.

- Follow every rule by what it is for. Getting a result forbidden by a rule through another route,
  such as a cast hidden in a helper, a type widened until a value fits or a term redefined until
  the work passes, breaks the rule just as the forbidden form does. When a rule stands in the way
  of your work, name it where you report your work, and never go around it.

## Why it exists

Rules alone do not stop repeat violations. A session breaks a rule already in the context of that
session, apologises, and breaks it again. The wall turns each violation into a permanent record
tied to a model, a session and a line in a transcript, so the record can be checked and cannot be
argued away later. Recurring entries show which rules sessions keep breaking and which wording
fails. The user changes the rules based on that evidence. The user can also follow how well each
model follows the rules over time.

Hooks, scripts and harness settings never write or read the files automatically. The wall works only as long as
you follow this skill.

## When you write an entry

- Append an entry in the same turn when the user points out a violation of yours.
- Append an entry without being told when you catch yourself breaking a rule.
- When a finding returned by a reviewer turns out to come from a model breaking a rule, record it
  as a violation by that model.
- Expect a stage that writes nothing, such as a reviewer, to report the violation. Record it when
  you read the findings returned by the reviewers.
- Read a message of the user as a possible report of a violation when it reminds you of something
  said before, orders you to stop or to revert, says something was never said or approved, is
  written in capitals, or speaks of disappointment, of invention or of something that makes no
  sense. Decide whether it concerns a violation before you write the entry.
- Record each owed entry that was not written as one more violation, in a separate entry.

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
- Quote the rule in **Broke:** word for word, with its section where it has one. One entry may
  quote several rules.
- Name in **Roast:** the failure and why it was avoidable, which is usually that the rule was in
  context. Say it as bluntly as you would to someone who broke a rule right in front of them.
- Aim the roast at the output of the model.
- Point **Where:** at the transcript file in the `projects` directory inside the Claude
  configuration directory and at the line, so anyone can open the original.

## Changes to the wall

- Never edit an old entry, which includes deleting, rewording or softening it.
- Add a correction entry below a mistaken entry.
- Never change the rules quoted in an entry. Rules change only at the user's word.
- Put the fix for a violation to the user, and record it in the todo record defined by
  `workflow-skills:todo-md` once the user approves it.
- Put a new rule into the rules files.
- Write into the wall only the record of what happened.
