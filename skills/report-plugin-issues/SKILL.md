---
name: report-plugin-issues
description: Applies when you find a problem with the workflow-skills plugin itself, such as one of its skills, scripts, agent templates or tools failing, contradicting itself or standing in the way of the work.
---

# Reporting issues and obstacles in the workflow-skills plugin

**Load the `workflow-skills:writing-style` skill first.** It binds every comment, document, commit
message and reply this skill produces, and it is not optional when working with this plugin.

Every problem you find in the plugin becomes an issue on its GitHub repository,
`xdevs23/workflow-skills`.

- File an issue for every problem you find in the plugin itself, such as a shipped script that fails
  or judges its input wrongly, a check that stops a run for a reason the plugin's rules do not give,
  two rules that contradict each other, a skill or template that states something the code does not
  do, or a tool or command the plugin names that is missing.
- Never patch the plugin's scripts silently to get past a problem. File the issue instead.
- When you work as a stage that writes nothing, such as a reviewer, report the problem in what you
  return, and the session that runs you files the issue.

## An issue that already exists

- Search the open issues for the problem with this command:
  `gh issue list --repo xdevs23/workflow-skills --search "<words>"`.
- When an open issue already describes the problem, add what you found to it as a comment instead
  of filing a new issue, with this command:
  `gh issue comment <number> --repo xdevs23/workflow-skills --body-file <file>`.

## What the issue says

- Give the issue a title that names the problem in plain words.
- Describe one problem per issue.
- State the plugin version from its manifest, and the skill, script, template or tool where the
  problem sits.
- State what you did, what happened and what the plugin's own text says should happen, with the
  error text quoted.

## What stays out

- Keep out everything of the project you work in: its name, paths, code, data, people and decisions.
- Keep out everything `workflow-skills:hygiene` keeps out of a public post.
- Rewrite every example and every quoted error into a made-up one of the same shape before it goes
  into the issue.

## Filing

- Open the body of every issue and every comment with the note alert that
  `workflow-skills:pr-comment-replies` describes.
- Write the body to a file in the project cache that `workflow-skills:local-cache` defines.
- File the issue directly with
  `gh issue create --repo xdevs23/workflow-skills --title "<title>" --body-file <file>`.
- Tell the user the number of the issue or comment you posted.
