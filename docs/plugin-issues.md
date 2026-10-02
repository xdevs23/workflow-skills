# Reporting problems with the plugin

The skill `workflow-skills:report-plugin-issues` turns every problem a session finds in the plugin
itself into an issue on the plugin's GitHub repository. It applies when a shipped script fails or
judges its input wrongly, when a check stops a run for a reason the rules do not give, when rules
contradict each other, when a skill or template states something the code does not do, and when a
tool or command the plugin names is missing.

A session never patches the plugin's scripts silently to get past a problem: it files the issue
instead. It first searches the open issues, and when one already describes the problem, it adds what
it found as a comment instead of filing a new issue. An issue holds one problem: a title that names
it, the plugin version, the place in the plugin, and what happened against what the plugin's text
says should happen, with the error quoted. Everything of the project at hand, the user's words,
transcripts, the local setup and every secret stay out, and every example is rewritten into a
made-up one.

## Decisions and their reasons

Patching the plugin's scripts silently is against the rules, so a problem found in the plugin is
reported as an issue on its repository instead.

The session files the issue directly, and the body of every issue and comment opens with the note
alert of `workflow-skills:pr-comment-replies`, so a reader can tell an agent wrote it. A stage that
writes nothing reports the problem, and the session that runs it files the issue.

## Alternatives the user rejected

- Patching the plugin's scripts silently to get past a problem was rejected for an issue on the
  plugin's repository.
- Showing the user every issue before it is filed was rejected for filing it directly, with the note
  alert at the top.
