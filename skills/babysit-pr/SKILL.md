---
name: babysit-pr
description: Look after a submitted pull request until it is closed or merged.
---

# Babysit a pull request

**Load the `workflow-skills:writing-style` skill first.** The rules in it apply to every comment,
document, commit message and reply you write while you follow this skill. Load it whenever you work
with this plugin.

Use this skill once a pull request exists. Creating and updating the pull request lie outside it:
open and update the pull request by `workflow-skills:pull-request`. Who pushes a change and how a
push gets approved lie outside this skill as well.

## Start and watch

- Watch the pull request with `watch-prs`, the pull request watcher shipped with this plugin. The
  watcher is a Python program in the tools directory of the plugin, found in this repository or in
  the directory of the installed plugin under the plugin cache.
- Run it with `python3`, pass the state file with `--state`, and name the pull request as the last
  argument: `owner/repo#number`, or `owner/repo@branch` for the open pull request whose head is
  that branch.
- Put the state file in the project cache defined by `workflow-skills:local-cache`.
- Run the watcher through the Monitor tool where the harness has it, since every line printed by
  the watcher is one event. Otherwise run it in a shell where `gh` is logged in, and read the output
  line by line.
- Read the output and handle every event you have not handled yet. The watcher prints each event as
  one JSON line. The first poll prints every comment, review and reply in a review thread already on
  the pull request, and every failed check run and failed commit status on the head commit of the
  pull request.
- Expect the watcher to poll again after the first poll, and to print each new comment, review or
  reply in a review thread, each check run or commit status that fails on the head commit, and the
  pull request being closed or merged.
- Expect a page that did not change to cost nothing against the GitHub rate limit of the `gh`
  login, since the watcher asks for it again with the ETag of its last answer. The watcher plans
  its rounds as if every request counted. Of the requests left, it takes the part that matches its
  part of the use of the login seen since GitHub last restored the limit, and spreads that part
  until GitHub restores the limit again. More other use of the login makes it poll more rarely.
- Expect a restarted watcher to print only new events, since the state file contains the ids of
  every event printed before. An event printed just before the watcher stopped may print again
  after a restart.
- Post a comment only when it adds something of value.
- Do not act on your own replies. Recognize them by the mandatory prefix at their start.
- When a watch ends while the pull request is still open, start it again.
- When the watcher exits with an error, such as `gh` not being logged in, or a branch without an
  open pull request or with more than one, start it again only once the cause named in the error
  message is fixed.
- When the pull request is closed or merged, stop polling.

## Comments and reviews

- Act on every comment and review without waiting to be asked, from bots and people alike, whatever
  commit it was made on.
- Check a reported problem against the code before you edit anything.
- Make the change needed by the comment, or decline a finding disproved by the check.
- Reply in both cases by `workflow-skills:pr-comment-replies`.
- After you push a fix for a comment, update the description and the pictures by the section
  "Opening and updating" of `workflow-skills:pull-request`.

## Failed checks

- Tell a failure caused by the repository apart from a failure of the infrastructure.
- Fix a failure caused by the repository.
- After you push a fix for a failure, update the description and the pictures by the section
  "Opening and updating" of `workflow-skills:pull-request`.
- Handle a `status-failed` event like a `check-failed` event. It reports a commit status in the
  failure or error state, posted by a CI service through the commit status API in place of check
  runs.
- Skip a `check-failed` or `status-failed` event for a commit older than the newest push.

## Asking the user

- Follow the general rules and the rules of the project on when to ask the user. This skill does not
  add any.
