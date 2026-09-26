---
name: pr-comment-replies
description: Covers writing and posting replies on pull requests and issues, from the note alert that opens every reply to how an inline reply answers a finding and when its thread is resolved. Load it before posting any reply on a pull request or an issue.
---

# Replies on pull requests and issues

**Load the `writing-style` skill first.** It binds every comment, document, commit message and
reply this skill produces, and it is not optional when working with this plugin.

This skill states how an agent writes and posts a reply on a pull request or an issue. The user's
own rules for comments posted on the user's behalf win wherever they differ from this skill,
thread resolution included.

## Header and placement

Every reply opens with a note alert, a `> [!NOTE]` block that names the model with its version
and the handle the agent writes for. The reply ends on its last point and carries no sign-off.

The agent posts a reply to a review comment in that comment's thread. It posts a reply to a
top-level comment or to a review summary as a new top-level comment.

## Inline replies

An inline reply starts with its outcome. It carries no list, heading, bold text or table, and it
thanks nobody.

When the agent accepts a finding, the first sentence of its reply names the commit that makes the
change. When the agent declines a finding, the reply gives the reason and puts the code it refers
to in code spans.

The agent resolves every inline thread after its reply, declined findings included, unless the
user's own rules keep resolving for the user.

## Review requests to a bot

A request for another review by a bot names the newest commit and what changed since the last
review.

## Every reply

The agent thanks human contributors only.

A reply states plainly what the agent did not do and what it did not check.

A reply carries no emoji, apology, praise, filler, exclamation or em dash.
