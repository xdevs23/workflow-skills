---
name: pr-comment-replies
description: Write and post a reply on a pull request or an issue. Load it before you post one.
---

# Replies on pull requests and issues

**Load the `workflow-skills:writing-style` skill first.** The rules in it apply to every comment,
document, commit message and reply you write while you follow this skill. Load it whenever you work
with this plugin.

- Follow the user's rules for comments posted on the user's behalf wherever they differ from this
  skill, also on resolving threads.

## Header and placement

- Open every reply with a note alert, a `> [!NOTE]` block with the name and version of the
  model and the handle on whose behalf you write.
- When a reply contains an opinion or an assumption you have not checked, add a line to the note
  alert that says so, such as "This reply is based on an assumption and does not reflect the views
  of @<handle> on the matter."
- End the reply on its last point. Do not sign off.
- Post a reply to a review comment in the same thread as that comment.
- Post a reply to a top-level comment or to a review summary as a new top-level comment.

## Inline replies

- Start an inline reply with the outcome for the finding.
- Write an inline reply as plain sentences, without a list, a heading, bold text or a table.
- Do not thank anyone in an inline reply.
- When you accept a finding, name the commit with the change in the first sentence of your reply.
- When you decline a finding, give the reason, with the code referred to by the reply in code spans.
- Resolve every inline thread after your reply, declined findings included, unless by the user's
  rules only the user resolves threads.

## Top-level replies

- Open a top-level reply with one sentence that answers the point.
- Use bullets only when the reply has several separate points.
- Close with one sentence on what happens next or what the reader should do.

## Review requests to a bot

- When you ask a bot for another review, name the newest commit and what changed since the last
  review.

## Every reply

- Thank only human contributors.
- State plainly what you did not do and what you did not check.
- Leave emoji, apologies, praise, filler, exclamations and em dashes out of every reply.
