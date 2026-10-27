---
name: visual-decisions
description: Draw a page for the user to look at and answer, such as the draft of a change, product decisions that need an answer, a plan or the explanation of a complex problem.
---

# Visual decisions

**Load the `workflow-skills:writing-style` skill first.** Its rules apply to every word on the page
and in the chat message that comes with it.

## When it applies

- Draw a page when `workflow-skills:implement` asks for the draft of a change. Show on it the
  overall shape, direction, architecture and design of the change.
- Draw a page when one or more product decisions need an answer from the user, each changing what
  someone sees or does, the scope of the product or which data is kept.
- Draw a page for a substantial plan or design, and for the explanation of a complex code path,
  problem or trade-off, and open it for the user instead of writing it into the chat.

## Before you draw

- Read in full the code behind every state you draw, at the version that state shows: its commit,
  or the working tree with the changes nobody has committed yet. An After that the code does not
  define yet is the exception.
- Draw every state that has code from what that code does.
- Pick one realistic sample for the whole page, with real-looking names, texts and values, and at
  least one long value where length matters.

## The page

- Write one standalone HTML file, with all its CSS inside it and without external resources.
- Write every HTML page meant for the user in dark mode.
- Keep the file on the filesystem you work on, in the project cache that
  `workflow-skills:local-cache` defines. Upload or publish it elsewhere only when the user has
  explicitly allowed it.
- Open the page with the name of the change as its title. Below it, write one line about what the
  page is for and which states the pictures show.
- Below that line, put a box titled "What this is about, in plain words": a short list that
  explains the change or the decision to someone who has never seen the code. It contains one
  concrete example, what goes wrong or is missing today, what After does, what After does not
  change although the reader could expect it to, what it costs, and what the user is asked.
- Put a legend under that box, with one marker for each kind of mark the page uses:
  - After, in green, for a part the change adds or changes;
  - the earlier state, in red, for a part that After leaves out;
  - Optional pick, in blue, for one more After picture with a better, alternative approach;
  - a dashed box, for a file the change does not edit;
  - Updated, in purple, for a part that changed after the last answer from the user;
  - a short bar with its value, for a number needed by the decision, filled in green where the
    value fits and in red where it is over the limit.
- Keep the draft of a change within one regular browser window. When it does not fit or is too
  complicated to read, split the unit into sub-units as `workflow-skills:todo-md` describes, and
  never add pages to the draft.
- Keep a page of product decisions within one browser window where you can. When the decisions need
  more room, split them into separate pages, and draw the next page once the user has answered the
  one before. Never draw them all at once.
- Split the page into numbered sections, each with a title of at most eight words.
- Title each section that shows After with the outcome its pictures show, such as "Every open
  question survives a restart".
- Title a section that compares variants of After, and every section on a page of product
  decisions, with the question the pictures answer, and state no result in that title.
- Draw each section in the form that the section on pictures gives for what it shows.
- Name the sample in one line under the title of the first section that uses it.
- Put the pictures of a section side by side, each with a label above it for the state it shows: the
  branch with its unpushed commits, a release, or one variant of After, such as "After, two
  maintainers". Show the earlier states first and After last.
- Put a caption of at most fifteen words under each picture.
- End a page that has several variants of After with a section that shows them side by side, one
  column for each variant and one row for each state.
- Mark the part of a picture that changes in the color of its legend marker, so the eye finds the
  difference first.
- Write words on the rest of the page only as labels, titles, captions and marks. A picture that
  needs a paragraph to explain it is not clear yet.
- The page must be drawn in a very visual way, so that the user looking at it sees at first glance
  what the end result is and how the change feels like. Resist the temptation to puke out a huge
  wall of text on the HTML page.

## Pictures

- Draw a visible change as an imitation of the real screen, with its structure, its labels and its
  look. Where possible and cheap, make real screenshots or import the real screen so the user sees
  how it actually looks like.
- Draw a picture at the real size of what it shows, together with what surrounds it.
- Draw what goes wrong at the place in the picture where it happens, in the color of the state it
  belongs to.
- Where a decision depends on a number, show that number above each picture of the decision as the
  short bar named in the legend.
- Draw technical details, such as migrations, data models and schemas, as pictures or graphs.
- Draw a change that happens out of sight, such as where in the code a decision is made, as boxes
  and arrows: which part calls which, and what passes between them, in each state.
- Show code as an excerpt of the real file, under a header with the component and the path. Keep
  the snippets short and to the point. The code must be well readable. If you show internal details
  of the code, then you're missing the point: go one layer up and abstract away, so that the
  functions, variables and other declarations read like what it actually does in the real world.
- Fold the lines of the file that the change does not edit into one gray line with a short
  description of them, and highlight every line the change adds or edits.

## Choices and optional picks

- Make every choice left open by the words of the user and the rules, and draw it as part of After.
  Leave out of the draft of a change what depends on a decision still open for the user, as
  `workflow-skills:implement` describes.
  Do not ask questions in the draft, do not add open points and do not try to nudge the user into accepting
  a real tradeoff.
- Draw every better, alternative approach as one more After picture beside the others of its section, with
  the label `Optional pick:` in blue in place of the state label. The change includes it only when
  the user picks it explicitly. An approval without mentioning an optional pick means the user accepts the "After"
  shape.
- Never show an optional pick as text alone. Draw an alternative that happens out of sight as boxes
  and arrows, like any other picture or graph. Optional picks are not allowed to pose a downgrade or
  introduce a real tradeoff that "After" doesn't already introduce. Use optional picks to suggest
  objectively better solutions that the user can pick, even if it means it needs more code or another round
  of drafts.

## Updating the page

- When the user says what should be different, edit the page in place by hand. A page drawn again
  from scratch hides the difference.
- Mark every part that changed as Updated, with a purple outline and an `UPDATED` badge, as granular as possible.
  Remove the Updated marks of earlier rounds. Do not mark an entire section as updated when it already existed before.
  Rather, circle in just the thing you changed. You can also use purple underline on the text that was added
  or changed, and you may use strikethrough `~~ ~~` when it helps understand a subtle change.
- Add to the line under the title what changed after the last answer from the user.
- When the user picks an optional pick, make it the After picture of its section and remove the
  other optional picks there. Remove an optional pick the user declines.
- Update the plain-words box and the section titles whenever After changes.

## Making the page

- Draw the page yourself, or hand the first drawing to one agent when the code to read is large.
  List in the files to read at a minimum in its prompt, the file of `workflow-skills:writing-style` to read before
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

## Implementation

- Take an answer exactly as written. An answer that approves an After picture with one change asks
  for that picture with that change.

## Images from the chat

- Copy an image the user pastes into the chat into the local storage defined by
  `workflow-skills:local-cache`, and write the path to the image into the notes that
  `workflow-skills:implement` describes, so the implementer finds it.
