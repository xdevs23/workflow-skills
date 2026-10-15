---
name: report-plugin-issues
description: Applies when you find a problem with the workflow-skills plugin itself, such as one of its skills, scripts, agent templates or tools failing, contradicting itself or blocking the work.
---

# Reporting issues and obstacles in the workflow-skills plugin

**Load the `workflow-skills:writing-style` skill first.** The rules in it apply to every comment,
document, commit message and reply you write while you follow this skill. Load it whenever you work
with this plugin.

- File every problem you find in the plugin itself as an issue on the GitHub repository
  `xdevs23/workflow-skills`, which contains the plugin. Such problems include a shipped script that
  fails or wrongly judges the input it is given, a check that stops a run for a reason not given in
  the rules of the plugin, two rules that contradict each other, a skill or template that describes
  something not done by the code, and a tool or command named by the plugin but missing.
- Never patch the plugin's scripts silently to get past a problem. File the issue instead.
- When you work as a stage that writes nothing, such as a reviewer, report the problem in your
  result. The session that runs you files the issue.

## An issue that already exists

- Search the open issues for the problem with this command:
  `gh issue list --repo xdevs23/workflow-skills --search "<words>"`.
- When an open issue already describes the problem, add what you found to it as a comment instead
  of filing a new issue, with this command:
  `gh issue comment <number> --repo xdevs23/workflow-skills --body-file <file>`.

## Contents of the issue

- Title the issue with the problem in plain words.
- Describe one problem per issue.
- State the version of the plugin, from the plugin manifest.
- Name the skill, script, template or tool with the problem.
- State what you did, what happened and what should happen according to the text of the plugin,
  and quote the error message.

## What to keep out

- Keep out everything about the project in which you work: the name of the project, its paths, code,
  data and decisions, and the people involved in it.
- Follow `workflow-skills:hygiene` for what must stay out of a public post.
- Rewrite every example and every quoted error into a made-up one of the same shape before it goes
  into the issue.

## Filing

- Open the body of every issue and every comment with the note alert described in
  `workflow-skills:pr-comment-replies`.
- Write the body to a file in the project cache defined by `workflow-skills:local-cache`.
- File the issue directly with
  `gh issue create --repo xdevs23/workflow-skills --title "<title>" --body-file <file>`.
- Tell the user the number of the posted issue or comment.
