---
name: visual-decisions
description: Applies when you draw a page for the user to look at and answer, such as the draft of a change or product decisions that need an answer.
---

# Visual decisions

**Load the `workflow-skills:writing-style` skill first.** Its rules apply to every word on the page
and in the chat message that comes with it.

A visual decision page shows a change, or the decisions it needs, as pictures side by side: the
code as it is, labeled by the state it is in, next to After, what the user would see or what would
happen once the change is made. The user sees the difference at a glance and never has to rebuild
it from a description.

## When it applies

- Draw a page when `workflow-skills:implement` asks for the draft of a change. Show on it the
  overall shape, direction, architecture and design of the change.
- Draw a page when one or more product decisions need an answer from the user, each changing what
  someone sees or does, the scope of the product or which data is kept.

## Before you draw

- Read in full the code behind every state you draw, at the version that state shows: its commit,
  or the working tree with the changes nobody has committed yet. An After that the code does not
  define yet is the exception.
- Draw every state that has code from what that code does.
- Where a statement about a state turns out wrong in its code, draw what the code really does, and
  add one line starting `CORRECTION:` under that section.
- Pick one realistic sample for the whole page, with real-looking names, texts and values, and at
  least one long value where length matters.

## The page

- Write one standalone HTML file in dark mode, with all its CSS inside it and without external
  resources.
- Keep the file on the filesystem you work on, in the project cache that
  `workflow-skills:local-cache` defines. Upload or publish it elsewhere only when the user has
  explicitly allowed it.
- Open the page with the name of the change as its title. Below it, write one line about what the
  page is for and which states the pictures show.
- Below that line, put a box titled "What this is about, in plain words": a short list that
  explains the change or the decision to someone who has never seen the code. It contains one
  concrete example, what goes wrong or is missing today, what After does, what it costs, and what
  the user is asked.
- Put a legend under that box, with one marker for each kind of mark the page uses:
  - After, in green, for a part the change adds or changes;
  - the earlier state, in red, for a part that After leaves out;
  - Optional pick, in blue, for one more After picture with an alternative approach;
  - a dashed box, for a file the change does not edit;
  - Updated, in purple, for a part that changed after the last answer from the user.
- Keep each page within one browser window where you can. When the decisions need more room, split
  them into separate pages, and draw the next page once the user has answered the one before. Never
  draw them all at once.
- Split the page into numbered sections, each with a title of at most eight words.
- Name the sample in one line under the title of the first section that uses it.
- Put the pictures of a section side by side, each with a label above it for the state it shows: the
  branch with its unpushed commits, a release, or one variant of After, such as "After, two
  maintainers". Show the earlier states first and After last.
- Put a caption of at most fifteen words under each picture.
- Mark the part of a picture that changes in the color of its legend marker, so the eye finds the
  difference first.
- Write words on the rest of the page only as labels, titles, captions and marks. A picture that
  needs a paragraph to explain it is not clear yet.

## Pictures

- Draw a visible change as an imitation of the real screen, with its structure, its labels and its
  look.
- Draw technical details, such as migrations, data models and schemas, as pictures as well.
- Draw a change that happens out of sight, such as where in the code a decision is made, as boxes
  and arrows: which part calls which, and what passes between them, in each state.
- Show code as an excerpt of the real file, under a header with the component and the path.
- Fold the lines of the file that the change does not edit into one gray line with a short
  description of them, such as "⋯ the two fingerprint sensor values", and highlight every line the
  change adds or edits.

## Choices and optional picks

- Make yourself every choice left open by the words of the user and the rules, and draw it as part
  of After.
- Ask the user nothing beyond the decisions that need an answer on this page.
- Draw every alternative approach as one more After picture beside the others of its section, with
  the label `Optional pick:` in blue in place of the state label. The change includes it only when
  the user picks it.
- Never show an optional pick as text alone. Draw an alternative that happens out of sight as boxes
  and arrows, like any other picture.

## Updating the page

- When the user says what should be different, edit the page in place by hand. A page drawn again
  from scratch hides the difference.
- Mark every part that changed as Updated, with a purple outline and an `UPDATED` badge. Remove
  the Updated marks of earlier rounds.
- Add to the line under the title what changed after the last answer from the user.
- When the user picks an optional pick, make it the After picture of its section and remove the
  other optional picks there. Remove an optional pick the user declines.
- Update the plain-words box whenever After changes.

## Making the page

- Draw the page yourself, or hand the first drawing to one agent when the code to read is large.
  List in its prompt the files to read, the file of `workflow-skills:writing-style` to read before
  writing, every section with the states it shows, the rules of this skill and the output path, and
  tell the agent to write exactly that one file.
- Give that agent, for every state it draws that has code, the repository and either the full
  commit ID of that state or the path of the working tree with the uncommitted changes. Tell it to
  read every file of that state at that version, since the checkout it starts in can contain a
  different version.
- Render the page in a headless browser and look at the screenshot before you show the page. A page
  that only passed a check of its markup has not been seen.
- Open the page for the user. Where the session is headless, or runs in a harness that cannot open
  a file for the user, show the page the way the harness allows, such as an inline artifact, inline
  HTML or an embedded screenshot.

## Asking

- End the message with one question: whether the user approves the page, or, on a page of
  decisions, the answer to each decision.
- Keep the chat message to the path of the page and one line for each section.
- Take an answer exactly as written. An answer that approves an After picture with one change asks
  for that picture with that change.

## Images from the chat

- Copy an image the user pastes into the chat into the project cache, and write its path into the
  notes that `workflow-skills:implement` describes, so the implementer finds it.
