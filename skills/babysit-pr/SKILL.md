---
name: babysit-pr
description: Watches a submitted pull request until it is closed or merged, and acts on every comment, review and failed check that reaches it.
---

# Babysit a pull request

**Load the `workflow-skills:writing-style` skill first.** It binds every comment, document, commit
message and reply this skill produces, and it is not optional when working with this plugin.

This skill starts once a pull request exists. It does not create the pull request and does not say
how the pull request is updated: a change reaches the pull request the way the project or a
dedicated skill prescribes. It does not say who pushes a change or how a push is approved.

## Start and watch

- Watch the pull request with `watch-prs`, the pull request watcher this plugin ships. The watcher
  is a Python program in the plugin's tools directory, in this repository or in the installed
  plugin's directory under the plugin cache.
- Run it with `python3`, give it the state file with `--state`, and name the pull request as the
  last argument, as `owner/repo#number`, or as `owner/repo@branch` for the open pull request whose
  head is that branch. The state file lies in the project cache that `workflow-skills:local-cache`
  defines.
- Run the watcher through the Monitor tool where the harness has it, since every line the watcher
  prints is one event, and otherwise in a shell where `gh` is logged in, reading the lines it
  prints.
- The watcher prints each event as one JSON line. Its first poll prints every comment, review and
  reply in a review thread already on the pull request and every failed check on its head commit.
  Read the output and handle what you haven't taken care of yet.
- After the initial dump, it polls every 60 seconds and prints each new comment, review or reply in
  a review thread, each check that fails on the head commit, and the pull request being closed or
  merged.
- The state file keeps the ids of what the watcher already printed, so a restarted watch prints only
  what is new. An event printed just before the watcher stops may print again after a restart.
- Post nothing if you don't have anything with value to contribute.
- Do not act on your own replies. Your replies open with the mandatory prefix, so you can recognize
  them.
- When a watch ends while the pull request is still open, start it again. When the watcher exits
  with an error, such as `gh` not being logged in, or a branch with no open pull request or with
  more than one, start it again only once the cause its message names is fixed. When the pull
  request is closed or merged, stop polling.

## Comments and reviews

- Act on your own on every comment and review, from bots and people alike and whatever commit it was
  made on.
- Check a reported problem against the code before editing anything, make the change the comment
  needs or decline a finding the check disproves, and in both cases reply through the
  `pr-comment-replies` skill.

## Failed checks

Tell a failure the repository causes apart from a failure of the infrastructure, and fix the failure
the repository causes. Skip check results on a commit older than the newest push.

## Asking the user

This skill states no rules of its own about when to ask the user. The general rules and the
project's own rules decide what needs the user.
