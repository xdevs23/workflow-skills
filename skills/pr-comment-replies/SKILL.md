---
name: pr-comment-replies
description: Covers writing and posting replies on pull requests and issues, from the note alert that opens every reply to how an inline reply answers a finding and when its thread is resolved. Load it before posting any reply on a pull request or an issue.
---

# Replies on pull requests and issues

**Load the `workflow-skills:writing-style` skill first.** It binds every comment, document, commit
message and reply this skill produces, and it is not optional when working with this plugin.

This skill states how you write and post a reply on a pull request or an issue. The user's own
rules for comments posted on the user's behalf win wherever they differ from this skill, thread
resolution included.

## Header and placement

- Open every reply with a note alert, a `> [!NOTE]` block that names the model with its version
  and the handle you write for.
- End the reply on its last point, with no sign-off.
- Post a reply to a review comment in that comment's thread.
- Post a reply to a top-level comment or to a review summary as a new top-level comment.

## Inline replies

- Start an inline reply with its outcome.
- Put no list, heading, bold text or table in an inline reply, and thank nobody in it.
- When you accept a finding, name the commit that makes the change in the first sentence of your
  reply.
- When you decline a finding, give the reason and put the code the reply refers to in code spans.
- Resolve every inline thread after your reply, declined findings included, unless the user's own
  rules keep resolving for the user.

## Review requests to a bot

- Name the newest commit and what changed since the last review in a request for another review
  by a bot.

## Every reply

- Thank human contributors only.
- State plainly what you did not do and what you did not check.
- Put no emoji, apology, praise, filler, exclamation or em dash in a reply.
