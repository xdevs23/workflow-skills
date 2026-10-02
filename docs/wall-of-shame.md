# The wall of shame as a plugin skill

The wall of shame skill, `workflow-skills:wall-of-shame`, keeps an append-only record of rule
violations by coding-agent sessions, one file per day in the `wall-of-shame` directory of the Claude
configuration directory. An entry names the project and the model, quotes the words that broke the
rule and the rule itself, roasts the failure plainly and points at the transcript line. An entry is
written when the user flags a violation, when a session catches its own, when the user reports
another session's violation, and when a reviewer's finding turns out to be a model breaking a rule.
A due entry that was not written is a violation of its own. Old entries are never edited; a mistaken
one gets a correction entry below it.

## Decisions and their reasons

The skill names no machine, no role of a particular setup and no rule file of a particular user: it
states its own rules, and an entry quotes whichever rulebook the violation broke.

The fix for a violation goes into the todo record, and the wall holds only the record of what
happened, so the todo record stays the record of what is to be done.

The phrases that mark a message of the user as a possible flag are described by kind, so no wording
of the user reaches the published skill. A stage that writes nothing reports a violation, and the
session that judges its findings records it.
