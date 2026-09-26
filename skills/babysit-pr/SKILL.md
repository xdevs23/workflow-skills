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

The agent first handles every comment, review and failed check already on the pull request. It
then watches the pull request, through the Monitor tool where the harness has it and by polling
otherwise. The watch reports each new comment, review or reply in a review thread, each check or
job that fails, and the pull request being closed or merged. The agent's own replies are not
events. The agent posts nothing when nothing is new.

When a watch ends while the pull request is still open, the agent starts it again. When the pull
request is closed or merged, the agent stops.

## Comments and reviews

The agent acts on its own on every comment and review, from bots and people alike and whatever
commit it was made on. It checks a reported problem against the code before it edits anything,
makes the change the comment needs or declines a finding the check disproves, and in both cases
replies through the `pr-comment-replies` skill.

The agent answers a comment once. Its own earlier reply carries the header of the
`pr-comment-replies` skill, and that reply shows the comment is already answered.

## Failed checks

The agent tells a failure the repository causes apart from a failure of the infrastructure, and it
fixes the failure the repository causes. It skips check results on a commit older than the newest
push.

## Asking the user

This skill states no rules of its own about when to ask the user. The general rules and the
project's own rules decide what needs the user.
