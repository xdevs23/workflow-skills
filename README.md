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
- **Copywriting**: product and marketing text, checked for style and facts
- **Goals**: `/goals` sets what Claude works toward until you clear it, and `/goals <text>` adds
  a goal without the pane; `/goals-import` brings open goals of an earlier session of the project
  into this one
- **Reminders**: `/reminders` sends Claude a text on a schedule or after an event;
  `/reminders-import` brings reminders of an earlier session of the project into this one
- **Questions**: Claude asks and keeps working; answer in the pane or with `/answer`
- **Roast**: `/roast` writes where Claude disregarded the rules it was given or the facts in its
  context, and sends it to Claude as your message, with your comment if you add one. During a
  turn, Claude reads it with the next tool result. After you stopped Claude, it reads the roast
  with your next message.
  `/roast <point>` puts a point you found yourself into the roast. Where the transcript does not
  show the point, or shows it to be unfounded, the Roast pane shows the reason in place of the
  roast, and you cannot send the roast. After `/idle-roast on`, Claude
  gets a roast of what blocks the work once it has been idle for about five minutes. The switch
  applies to this session only, and `/idle-roast off` switches it off

## License

MIT
