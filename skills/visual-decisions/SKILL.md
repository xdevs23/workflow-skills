---
name: visual-decisions
description: Applies when one or more product decisions need the user's answer.
---

# Visual decisions

**Load the `workflow-skills:writing-style` skill first.** It binds every comment, document, commit
message and reply this skill produces, and it is not optional when working with this plugin.

A visual decision page puts open decisions to the user as one HTML page on which every decision is a
set of pictures side by side: the code as it stands, labelled by what that code is, and After, what
the user would see or what would happen with the proposed change. The user sees the difference at a
glance instead of rebuilding it from a description.

## When it applies

- Use this skill when one or more product decisions need the user's answer, each changing what
  someone sees or does, the product's scope or what data is kept.
- Keep a choice the rules already decide off the page. The implementer settles it by the rules,
  and you decide it neither on the page nor in the chat.

## Before you draw

- Label every picture of a state by what that state is, as `workflow-skills:writing-style` names a
  state of the code, and put the branch of unmerged work into its label.
- Read in full the code behind every state you draw that has a commit, at the commit that state
  names.
- Draw each picture of such a state from what its code does.
- Where a statement about a state turns out wrong in its code, draw what the code really does and
  put one line starting `CORRECTION:` under that decision.
- Draw an After that the code does not define yet as a proposal, and name in its caption any layout
  you chose yourself.

## The page

- Write one standalone HTML file with all its CSS inside it and no external resources, so it opens
  anywhere.
- Put the file in the project cache that `workflow-skills:local-cache` defines.
- Open the page with one line saying what the decisions are about and which states the pictures
  show.
- Give every decision:
  - its number and a title of at most eight words;
  - its pictures side by side, each labelled by the state it shows: the state the decision starts
    from and After, or, when it helps, the merged code, the unmerged work and After, in that order;
  - a caption of at most fifteen words under each picture;
  - a subtle highlight on the part that changes, so the eye finds the difference first.
- Put no paragraph on the page. A picture that needs a sentence to explain it is not clear yet.
- Draw a visible change as an imitation of the real screen, with its structure, its labels and its
  look.
- Draw a change nobody sees, such as where in the code a decision is made, as boxes and arrows:
  which part asks which, and what passes between them, in each state.
- Use one realistic sample for every decision on a page, with real-looking names, texts and values,
  and at least one long value where length matters.

## Making the page

- Hand the drawing to one agent when the code to read is large. Its prompt names the files to read,
  the file of `workflow-skills:writing-style` to read before writing, every decision with the
  statement of each state it shows, the rules of the page and the output path, and says that it
  writes exactly that one file and nothing else.
- Give that agent, for every state it draws that has a commit, the repository and the full commit ID
  that state names, and tell it to read every file of that state at that commit, since its own
  checkout can hold a different version.
- Render the page once in a headless browser the machine has, and look at the screenshot before you
  show the page. A page that only passed a check of its markup has not been seen.
- Open the page for the user.

## Asking

- End the message with one question the user can answer per decision, such as whether they approve
  every After picture or which numbers should be different.
- Keep the chat message to the page path and one line per decision.
- Take an answer exactly as written: an answer that approves an After picture with one change asks
  for that picture with that change.

## The decisions in a unit spec

- Expect an image the user pastes into the chat to be in the session transcript, in the record of
  that message, so a unit spec of `workflow-skills:implement-review-verify` that quotes the message
  reaches the image.
- You can also copy the images into the project cache, name their paths in the chat, and then write
  the spec.
