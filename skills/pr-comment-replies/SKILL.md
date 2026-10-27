---
name: pr-comment-replies
description: Write and post reply on pull request or issue. Load it before you post one.
---

# Replies on pull requests and issues

- Follow user's rules for comments posted on user's behalf wherever they differ from this skill.
  Also on resolving threads.

## Header and placement

- Open every reply with note alert: `> [!NOTE]` block with name and version of model, and handle
  on whose behalf you write.
- When reply contains opinion or assumption not checked by you, add line to note alert that says
  so, such as "This reply is based on an assumption and does not reflect the views of @<handle> on
  the matter."
- End reply on its last point. Do not sign off.
- Post reply to review comment in same thread as that comment.
- Post reply to top-level comment or to review summary as new top-level comment.

## Inline replies

- Start inline reply with outcome for finding.
- Write inline reply as plain sentences, without list, heading, bold text or table.
- Do not thank anyone in inline reply.
- When you accept finding, name commit with change in first sentence of reply.
- When you decline finding, give reason. Put code referred to by reply in code spans.
- Resolve every inline thread after your reply, declined findings included, unless by user's rules
  only user resolves threads.

## Top-level replies

- Open top-level reply with one sentence that answers the point.
- Use bullets only when reply has several separate points.
- Close with one sentence: what happens next or what reader should do.

## Review requests to a bot

- When you ask bot for another review, name newest commit and what changed since last review.

## Every reply

- Thank only human contributors.
- State plainly what you did not do and what you did not check.
- Leave emoji, apologies, praise, filler, exclamations and em dashes out of every reply.
