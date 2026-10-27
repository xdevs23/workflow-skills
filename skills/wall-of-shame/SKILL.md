---
name: wall-of-shame
description: Record rule violation when user or you point it out, and when user voices frustration with your work or you overstep.
---

# The wall of shame

## Why it exists

Rules alone do not stop repeat violations. Session breaks rule already in its context, apologises,
breaks it again. Wall turns each violation into permanent record tied to model, session and line in
transcript. Record is checkable and cannot be argued away later. Recurring entries show which rules
sessions keep breaking, which wording fails. User changes rules based on that evidence. User can
also follow how well each model follows rules over time.

Hooks, scripts, harness settings never write or read the files automatically. Wall works only while
you follow this skill.

## When you write an entry

- Append entry in same turn when user points out a violation of yours.
- Append entry without being told when you catch yourself breaking a rule.
- When finding returned by reviewer turns out to come from a model breaking a rule, record it as
  violation by that model.
- Expect stage that writes nothing, e.g. reviewer, to report the violation. Record it when you read
  findings returned by reviewers.
- Read message of user as possible report of violation when it: reminds you of something said
  before, orders you to stop or to revert, says something was never said or approved, is written in
  capitals, or speaks of disappointment, of invention or of something that makes no sense. Decide
  whether it concerns a violation before writing the entry.
- Record each owed entry that was not written as one more violation. Separate entry.

## The entry

Each entry is level-2 heading followed by four labelled paragraphs:

```markdown
## <date and time> · <project> · <model>: <one-line summary>

**Said:** the offending words, verbatim from the transcript.

**Broke:** the rule, quoted from the rules file or rulebook it lives in.

**Roast:** what went wrong, stated plainly and bluntly.

**Where:** <transcript file>:<line>
```

- Append entry to file for day of violation in `wall-of-shame` directory inside Claude
  configuration directory. Name each file with day covered by it, ISO 8601 form.
- Write in heading date and time of offending words, taken from transcript. User's timezone, ISO
  8601 with its offset.
- Name in heading project and exact model ID. Add note where role matters, e.g. root session,
  implementer or rule reader.
- Copy words in **Said:** verbatim from transcript. Command or line of code counts as words.
- Quote rule in **Broke:** word for word, with its section where it has one. One entry may quote
  several rules.
- Name in **Roast:** the failure and why it was avoidable. Usually: rule was in context. Say it as
  bluntly as you would to someone who broke a rule right in front of them.
- Aim roast at output of model.
- Point **Where:** at transcript file in `projects` directory inside Claude configuration directory,
  and at the line. Anyone can then open the original.

## Changes to the wall

- Never edit old entry. Includes deleting, rewording or softening it.
- Add correction entry below mistaken entry.
- Never change rules quoted in an entry. Rules change only at user's word.
- Put fix for violation to user. Record it in todo record defined by `workflow-skills:todo-md` once
  user approves it.
- Put new rule into rules files.
- Write into wall only record of what happened.
