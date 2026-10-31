---
name: report-plugin-issues
description: Report skill, script, agent template or tool of workflow-skills plugin that fails, contradicts itself or blocks work
---

# Reporting issues and obstacles in the workflow-skills plugin

- File every problem found in plugin itself as issue on GitHub repository
  `xdevs23/workflow-skills`, which contains plugin. Such problems include shipped script that fails
  or wrongly judges input given to it, a check that stops run for reason not given in rules of
  plugin, two rules that contradict each other, skill or template that describes something not
  done by code, and tool or command named by plugin but missing.
- Never patch plugin's scripts silently to get past problem. File issue instead.
- When you work as stage that writes nothing, such as reviewer, report problem in your result.
  Session that runs you files issue.

## An issue that already exists

- Search open issues for problem with this command:
  `gh issue list --repo xdevs23/workflow-skills --search "<words>"`.
- When open issue already describes problem, add what you found to it as comment instead of filing
  new issue, with this command:
  `gh issue comment <number> --repo xdevs23/workflow-skills --body-file <file>`.

## Contents of the issue

- Title issue with problem in plain words.
- Describe one problem per issue.
- State version of plugin, from plugin manifest.
- Name skill, script, template or tool with problem.
- State what you did, what happened, and what should happen according to text of plugin. Quote
  error message.

## What to keep out

- Keep out everything about project in which you work: name of project, its paths, code, data and
  decisions, and people involved in it.
- Follow `workflow-skills:hygiene` for what must be kept out of public post.
- Rewrite every example and every quoted error into made-up one of same shape before it goes into
  issue.

## Filing

- Write body to file in project cache defined by `workflow-skills:local-cache`.
- File issue directly with
  `gh issue create --repo xdevs23/workflow-skills --title "<title>" --body-file <file>`.
- Tell user number of posted issue or comment.
