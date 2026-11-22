# workflow-skills

Claude Code plugin with skills and hooks for multi-agent engineering workflows.

## Quickstart

```text
/plugin marketplace add xdevs23/workflow-skills
/plugin install workflow-skills@workflow-skills
```

Then run a skill, such as `/workflow-skills:implement`.

## Features

- **Software engineering**: changes built by agents in parallel, reviewed, tested and committed
- **Design**: drafts of screens and web pages to pick from
- **Copywriting**: rules for plain wording in commit messages, documents and comments in code;
  product and marketing text, checked for style and facts
- **Goals**: `/goals` sets what Claude works toward until you clear it, and `/goals <text>` adds
  a goal without the pane; `/goals-import` brings open goals of an earlier session of the project
  into this one. After Claude has been idle for 30 minutes, a fresh agent checks the open goals
  against the project, marks the goals it finds done and sends the rest to Claude
- **Reminders**: `/reminders` sends Claude a text on a schedule or after an event;
  `/reminders-import` brings reminders of an earlier session of the project into this one
- **Ideas**: Claude records your words that shape an entry in TODO.md, so they outlast
  compactions, and deletes them once the entry is finished. Clearing a goal deletes the ideas
  recorded for the entries attached to it. `/ideas` lists them by entry, and you can delete any one
  of them there
- **Requests**: Claude sends a request for work that only you can do outside the session, such as
  power-cycling a board, and keeps working. Press Done in the Requests pane or run
  `/reply <number>`, with a reply after it if Claude needs one
- **Roast**: `/roast` writes where Claude disregarded the rules it was given or the facts in its
  context, and sends it to Claude after your comment if you add one. The roast opens with a line
  for Claude: the roaster, a side agent, wrote it, and it does not have your authority. During a
  turn, Claude reads it with the next tool result. After you stopped Claude with Esc, the roast
  starts a new turn. `/roast <point>` puts a point you found yourself into the roast. The roast
  leaves out each claim of the point that the transcript does not show. Where the transcript shows
  none of them, the Roast pane shows the reason in place of the roast, and you cannot send the
  roast. After `/idle-roast on`, Claude gets a roast of what blocks the work once it has been idle
  for about five minutes. The switch applies to this session only, and `/idle-roast off` switches
  it off. When a compaction starts, a fork roasts the chat before it, and Claude gets that roast
  after the summary, so Claude still sees the mistakes made before the compaction

## License

MIT
