---
name: babysit-pr
description: Watches a submitted pull request until it is closed or merged, and acts on every comment, review and failed check that reaches it. Load it once a pull request exists.
---

# Babysit a pull request

**Load the `writing-style` skill first.** It binds every comment, document, commit message and
reply this skill produces, and it is not optional when working with this plugin.

This skill starts once a pull request exists. It does not create the pull request and does not
say how the pull request is updated: a change reaches the pull request the way the project or a
dedicated skill prescribes. It does not say who pushes a change or how a push is approved.

## Start and watch

The agent watches the pull request with the watcher this plugin ships, run as
`python3 <plugin root>/tools/watch-prs.py --state <file> <pull request>`, where the plugin root is
this repository or the installed plugin's directory under the plugin cache. The pull request is
named as `owner/repo#number`, or as `owner/repo@branch` for the open pull request whose head is
that branch. The state file lies in the project cache that `workflow-skills:local-cache` defines.
The agent runs the watcher through the Monitor tool where the harness has it, since every line the
watcher prints is one event, and otherwise in a shell where `gh` is logged in, reading the lines it
prints.

The watcher prints each event as one JSON line. Its first poll prints every comment, review and
reply in a review thread already on the pull request and every failed check on its head commit,
and the agent handles these first. After that it polls every 60 seconds and prints each new
comment, review or reply in a review thread, each check that fails on the head commit, and the pull
request being closed or merged. The state file keeps the ids of what the watcher already printed,
so a restarted watch prints only what is new. An event printed just before the watcher stops may
print again after a restart, and the agent recognizes one it already answered by its reply on the
pull request. The agent posts nothing when nothing is new.

The agent does not act on its own replies. It recognizes them by the note alert every reply opens
with, so its replies never come back to it as new work.

When a watch ends while the pull request is still open, the agent starts it again. When the
watcher exits with an error, such as `gh` not being logged in or a branch without an open pull
request, the agent starts it again only once the cause its message names is fixed. When the pull
request is closed or merged, the agent stops.

## Comments and reviews

The agent acts on its own on every comment and review, from bots and people alike and whatever
commit it was made on. It checks a reported problem against the code before it edits anything,
makes the change the comment needs or declines a finding the check disproves, and in both cases
replies through the `pr-comment-replies` skill.

## Failed checks

The agent tells a failure the repository causes apart from a failure of the infrastructure, and it
fixes the failure the repository causes. It skips check results on a commit older than the newest
push.

## Asking the user

This skill states no rules of its own about when to ask the user. The general rules and the
project's own rules decide what needs the user.
