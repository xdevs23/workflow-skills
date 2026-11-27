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
  into this one
- **Reminders**: `/reminders` sends Claude a text on a schedule or after an event;
  `/reminders-import` brings reminders of an earlier session of the project into this one
- **Ideas**: Claude records your words that shape an entry in TODO.md or a goal, so they outlast
  compactions. Once the entry is finished or you clear the goal, the ideas recorded for it stay as
  project ideas, each naming the entry or goal it was for, and Claude reads them with every entry
  and goal. `/ideas` lists them by entry, goal and project, and only you delete an idea, there
- **Autonomy**: `/autonomy always` lets Claude finish work end to end without questions in the
  whole project, `/autonomy #161` in one entry of TODO.md and the entries under it, and
  `/autonomy G5` for one goal. A grant for the project or an entry applies in every session
  of the project, and a grant for a goal in the session of that goal. `/autonomy` shows where it
  applies and `/autonomy off` removes every grant. Every system prompt describes autonomy, and a
  note in the conversation tells Claude where it applies each time that changes. Everything else
  follows the agent mode set for this session
- **Agent mode**: `/agent-mode` sets how Claude works in this session. `/agent-mode` alone shows
  the mode, and the footer under the prompt shows it before its buttons: `swarm` in violet,
  `orchestrator` in blue, `single` in green
  - In `orchestrator`, the default, Claude follows `workflow-skills:implement`, as every session
    did before
  - In `swarm`, Claude hands every unit of work to a subagent of the type `workflow-skills:lead`
    and supervises it, as `workflow-skills:orchestrate` describes
  - In `single`, `workflow-skills:implement` is not active. Claude makes the change itself,
    whatever its size, and starts subagents and workflows, writes entries of TODO.md, records ideas
    and draws drafts only when you ask for them or grant autonomy over work that needs them
  - The rules that the plugin checks on each tool call, such as those of
    `workflow-skills:writing-code`, apply in every mode
  - The mode applies to the main conversation of this session and to no subagent it starts
  - A session started by `/clear` or a fork starts in `orchestrator`, and a resumed session keeps
    the mode set for it
  - Every system prompt describes the modes, and a note in the conversation tells Claude which one
    applies each time that changes
- **Requests**: Claude sends a request for work that only you can do outside the session, such as
  power-cycling a board, and keeps working. Press Done in the Requests pane or run
  `/reply <number>`, with a reply after it if Claude needs one
- **Roast**: `/roast` writes where the result of Claude's work falls short, such as code that is
  wrong or unclean, or work that does not do what you asked for. It judges the result and not the
  way Claude got there, and sends the roast to Claude after your comment if you add one. The roast
  opens with a line for Claude: the roaster, a side agent, wrote it, and Claude is to check each
  point, fix each point that holds, and say what shows that a point does not hold. A roast states
  what the transcript shows to be wrong, without advice or doubts of the roaster. During a turn,
  Claude reads it with the next tool result. After you stopped Claude with Esc, the roast starts a
  new turn. `/roast <point>` puts a point you found yourself into the roast. The roast leaves out
  each claim of the point that the transcript does not show. Where the transcript shows none of
  them, the Roast pane shows the reason in place of the roast, and you cannot send the roast. After
  `/idle-roast on`, Claude gets a roast of what blocks the work once it has been idle for about five
  minutes. The switch applies to this session only, and `/idle-roast off` switches it off. Every
  roast reads the open goals from the board: it tells Claude to mark a finished goal as done, and
  names what is missing on a goal that Claude left alone while fewer than three units of work run,
  or while a running unit has a lower priority or is no longer needed. When a compaction starts, a fork roasts
  the chat before it, and Claude gets that roast after the summary, so Claude still sees the
  mistakes made before the compaction. A subagent of the type `workflow-skills:lead` gets a roast
  after each compaction of its own conversation, written by a second run of that compaction, which
  reads the conversation of the lead from its cache. The roast also goes to the main conversation,
  which started the lead. A lead gets no idle roast: the engine forks only the main conversation,
  and a copy of the conversation of the lead would be paid in full on every roast

## License

MIT
