---
name: wall-of-shame
description: Record rule violation when user or you point it out, or when user voices frustration or you overstep
---

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
- Expect stage that writes nothing, e.g. reviewer, to report violation. When finding returned by
  reviewer comes from model breaking rule, record it as violation by that model.
- Read message of user as possible report of violation when it: reminds you of something said
  before, orders you to stop or to revert, says something was never said or approved, is written in
  capitals, or speaks of disappointment, of invention or of something that makes no sense. Decide
  whether it concerns a violation before writing the entry.
- Record each owed entry that was not written as one more violation, in entry of its own.

## The entry

Each entry is level-2 heading followed by four labelled paragraphs:

```markdown
## <date and time> · <project> · <model>: <one-line summary>

**Said:** the offending words, verbatim from the transcript.

**Broke:** the rule, quoted from the rules file or rulebook it lives in.

**Roast:** what went wrong, stated plainly and bluntly.

**Where:** <transcript file>:<line>
```

- Append entry to file named for day of violation in ISO 8601 form, in `wall-of-shame` directory
  inside Claude configuration directory.
- Write in heading date and time of offending words, taken from transcript. User's timezone, ISO
  8601 with its offset. Convert timestamp of transcript line with
  `TZ=<timezone of user> date -d '<timestamp>' -Iseconds`.
- Name in heading project and exact model ID. Add note where role matters, e.g. root session,
  implementer or rule reader.
- Count command or line of code as words in **Said:**.
- Include section of rule in **Broke:** where it has one. One entry may quote several rules.
- Name in **Roast:** the failure and why it was avoidable. Usually: rule was in context.
- Aim roast at output of model.
- Point **Where:** at transcript file in `projects` directory inside Claude configuration directory,
  and at the line.

## Changes to the wall

- Never edit old entry. Includes deleting, rewording or softening it.
- Add correction entry below mistaken entry.
- Never change rules quoted in an entry. Rules change only at user's word.
- Propose fix only when user asks for one.
- Put new rule given by user into rules files.
- Write into wall only record of what happened.
