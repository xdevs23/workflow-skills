# The babysit-pr and pr-comment-replies skills

The babysit-pr skill watches a submitted pull request until it is closed or merged and handles every comment, review and failed job, acting on its own and asking the user only when it needs the user. The pr-comment-replies skill states how a reply on a pull request or an issue is written and posted.

This document is generated from a private spec by the spec tool and is never edited by hand.

## Requirements

**goal**: Once a pull request exists, the agent watches it until it is closed or merged.

**notified-events**: The agent learns of a new comment, a failing job, and the pull request being closed or merged, and the Monitor tool can deliver these notifications.

**all-comments**: The skill handles all comments and reviews.

**after-submission**: The skill covers the time after the pull request is submitted. Submitting it and updating it belong to other skills.

**autonomy**: When a comment or a failed job needs a code change, the agent makes it on its own and turns to the user only when it needs the user.

**in-plugin**: The babysitting skill is part of this plugin.

**reply-skill**: A second skill covers replying to comments on pull requests, in the style of agent replies seen in a reference corpus.

**own-skill**: The skill is written in its own words from the idea of a reference skill.

**no-ask-list**: The skill carries no rules of its own about what needs the user; the general rules and the project's own rules decide that.

**not-local-setup**: How a change is pushed to the pull request is outside the plugin.

**pushing-only**: The exclusion of the local setup from the plugin covers pushing only.

**agent-style**: The reply style follows replies that agents post on behalf of a person.

**prs-and-issues**: The reply skill covers replies on pull requests and on issues.

**fetch-sees-answers**: Reading the comments of a pull request also returns the replies to them, the agent's own included, so the skill needs no rule of its own for telling an answered comment apart.

**rules-win**: The user's own rules for comments posted on the user's behalf win where they differ from the reply skill. No person from the reference material is named in the repository, none of its wording is reused, and the skills take only its idea.

**render-step**: A unit's design document is generated from its spec once the implementation is complete.

**opener-test**: A routing test lists by name the skills that must carry the writing-style opener.

**comment-header**: An agent's comment opens with a note alert that names the model with its version and the handle the agent writes for, and a reply to a review comment goes into that comment's thread.

**reference-skill**: A reference skill for watching a pull request checks a reported problem against the code before editing anything, separates failures of the repository from failures of the infrastructure, gives a reason when it declines a finding, and stays silent when nothing is new.

**style-corpus**: Agent replies posted on behalf of a person consistently open with a note alert naming the model and the person, carry no sign-off, start an inline reply with its outcome, keep inline replies free of lists, headings, bold and tables, name the commit of an accepted finding in the first sentence, give a reason for every declined finding with the code in code spans, resolve inline threads after replying, name the newest commit and what changed when asking a bot for another review, thank only human contributors, state plainly what was not done or not checked, and use no emoji, apology, praise, filler, exclamation or em dash.

**opener-practice**: Skills of the plugin open, right after their title, with the paragraph that requires loading the writing-style skill first.

**readme-table**: The README's skill table ends with the local-cache and todo-md rows, and the sentence after it refers to these last two.

**babysit-flow**: The babysit-pr skill starts once a pull request exists. The agent first handles every comment, review and failed check already on the pull request. It then watches the pull request, through the Monitor tool where the harness has it and by polling otherwise, and learns of each new comment, review or review-thread reply, each check or job that fails, and the pull request being closed or merged. On each event the agent acts on its own on every comment and review, from bots and people alike and whatever commit it was made on: it checks a reported problem against the code before it edits anything, makes the change the comment needs, and replies through the pr-comment-replies skill. It fixes a failure the repository causes and tells it apart from a failure of the infrastructure. The agent skips check results on a commit older than the newest push, and it posts nothing when nothing is new. The skill states no rules of its own about when to ask the user. When a watch ends while the pull request is still open, the agent starts it again; when the pull request is closed or merged, it stops.

**babysit-boundary**: The babysit-pr skill does not create the pull request and does not say how the pull request is updated: a change reaches the pull request the way the project or a dedicated skill prescribes. It does not say who pushes a change or how a push is approved.

**reply-skill-content**: The pr-comment-replies skill states how a reply on a pull request or an issue is written and posted, following the traits in style-corpus in its own words: a note alert at the top as comment-header describes; no sign-off; an inline reply that starts with its outcome; no list, heading, bold or table inside an inline reply; an accepted finding that names its commit in the first sentence; a reason for every declined finding, with the code in code spans; a request for another bot review that names the newest commit and what changed; thanks only to human contributors, never in inline replies; plain statements of what was not done or not checked; and no emoji, apology, praise, filler, exclamation or em dash. A reply to a review comment goes into that comment's thread, and a reply to a top-level comment or a review summary is a new top-level comment. The agent resolves every inline thread after its reply, declined findings included, unless the user's own rules keep resolving for the user. Examples are neutral and carry no names, handles, repositories, links, commits or wording from the reference material.

**reply-precedence**: The pr-comment-replies skill states that the user's own rules for comments posted on the user's behalf win wherever they differ from it, thread resolution included.

**no-copy**: Neither skill nor any tracked file of the unit names a person from the reference material or reuses its wording; both skills state the behavior in their own words.

**writing-style-opener**: Both skills open, right after their title, with the paragraph that requires loading the writing-style skill first, as the skills in opener-practice do.

**readme-rows**: The README's skill table gets one row for each of the two skills, placed before the local-cache row, so the sentence about the last two rows stays true.

**opener-test-list**: The routing test's list of skills that carry the writing-style opener gains babysit-pr and pr-comment-replies.

## Boundaries

**scope**: The unit adds the two skills, the two README rows, the two names in the routing test's opener list and the unit's design document, and changes nothing else, the plugin manifest included.

## Acceptance criteria

1. **c-babysit**: The babysit-pr skill exists with the name babysit-pr and a description saying that it watches a submitted pull request until it is closed or merged, and it states every point of babysit-flow and babysit-boundary.
2. **c-replies**: The pr-comment-replies skill exists with the name pr-comment-replies and a description saying that it covers writing and posting replies on pull requests and issues, and it states every point of reply-skill-content and reply-precedence.
3. **c-opener-readme**: Both skills carry the writing-style opener and the routing test lists them, and the README has one row for each before the local-cache row.
4. **c-neutral**: no-copy holds for both skills and the unit's design document, and both skills follow the prose rules and the words to avoid of the writing-style skill.
5. **c-tests**: The test suite passes after the last change.
