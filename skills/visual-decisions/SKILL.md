---
name: visual-decisions
description: Draw page for user to look at and answer: drafts, product decisions, plans and explanations
---

# Visual decisions

## When it applies

- Draw page when `workflow-skills:implement` asks for draft of a change. Show on it overall shape,
  direction, architecture and design of change.
- Draw page when one or more product decisions need answer from user, each changing what someone
  sees or does, scope of product or which data is kept.
- Draw page for substantial plan or design, and for explanation of complex code path, problem or
  trade-off. Open it for user instead of writing it into chat.

## Before you draw

- Read in full the code behind every state drawn by you, at version shown by that state: its
  commit, or working tree with changes not committed yet. Exception: an After not defined by code
  yet.
- Draw every state that has code from what that code does.
- Pick one realistic sample for whole page: real-looking names, texts and values. At least one long
  value where length matters.

## The page

- Write one standalone HTML file, all CSS inside it, without external resources.
- Write every HTML page meant for user in dark mode.
- Keep file on filesystem on which you work, in project cache defined by
  `workflow-skills:local-cache`.
  Upload or publish elsewhere only when user explicitly allowed it.
- Open page with name of change as title. Below it, one line: what page is for, which states
  pictures show.
- Below that line, put box titled "What this is about, in plain words": short list explaining
  change or decision to someone who never saw the code. Contents: one concrete example, what goes
  wrong or is missing today, what After does, what After does not change although reader could
  expect it to, what it costs, what user is asked.
- Put legend under that box, one marker per kind of mark used by page:
  - After, in green, for part added or changed by the change;
  - earlier state, in red, for part left out by After;
  - Optional pick, in blue, for one more After picture with better, alternative approach;
  - dashed box, for file not edited by the change;
  - Updated, in purple, for part that changed after last answer from user;
  - short bar with its value, for number needed by decision. Filled green where value fits, red
    where over limit.
- Keep draft of a change within one regular browser window. When it does not fit or is too
  complicated to read, split unit into sub-units as `workflow-skills:todo-md` describes. Never add
  pages to draft.
- Keep page of product decisions within one browser window where you can. When decisions need more
  room, split them into separate pages. Draw next page once user answered the one before. Never
  draw them all at once.
- Split page into numbered sections, each with title of at most 8 words.
- Title each section showing After with outcome shown by its pictures, e.g. "Every open question
  survives a restart".
- Title section comparing variants of After, and every section on page of product decisions, with
  question answered by the pictures. Do not state a result in that title.
- Draw each section in form given by section on pictures for what it shows.
- Name sample in one line under title of first section using it.
- Put pictures of a section side by side, each with label above it for state shown by it: branch
  with its unpushed commits, a release, or one variant of After, e.g. "After, two maintainers".
  Earlier states first, After last.
- Put caption of at most 15 words under each picture.
- Page with several variants of After: end it with section showing them side by side, one column
  per variant, one row per state.
- Mark part of picture that changes in color of its legend marker, so eye finds difference first.
- Write words on rest of page only as labels, titles, captions and marks. Picture needing a
  paragraph to explain it is not clear yet.
- Draw page in very visual way, so user looking at it sees at first glance what end result is and
  how change feels. Do not write huge wall of text on HTML page.

## Pictures

- Draw visible change as imitation of real screen, with its structure, labels and look. Where
  possible and cheap, make real screenshots or import real screen, so user sees how it actually
  looks.
- Draw picture at real size of what it shows, with what surrounds it.
- Draw what goes wrong at place in picture where it happens, in color of state to which it belongs.
- Where decision depends on a number, show that number above each picture of decision as short bar
  named in legend.
- Draw technical details, e.g. migrations, data models, schemas, as pictures or graphs.
- Draw change happening out of sight, e.g. where in code a decision is made, as boxes and arrows:
  which part calls which, what passes between them, in each state.
- Show code as excerpt of real file, under header with component and path. Keep snippets short and
  to the point. Keep code well readable. Showing internal details of code misses the point: go one
  layer up and abstract away, so functions, variables and other declarations read like what it
  actually does in real world.
- Fold lines of file not edited by the change into one gray line with short description of them.
  Highlight every line added or edited by the change.

## Choices and optional picks

- Make every choice left open by user's words and the rules, and draw it as part of After. Leave
  out of draft of a change what depends on decision still open for user, as
  `workflow-skills:implement` describes. Do not ask questions in draft, do not add open points, do
  not try to nudge user into accepting a real tradeoff.
- Draw every better, alternative approach as one more After picture beside others of its section,
  with label `Optional pick:` in blue in place of state label. Change includes it only when user
  picks it explicitly. Approval without mentioning an optional pick = user accepts "After" shape.
- Never show optional pick as text alone. Draw alternative happening out of sight as boxes and
  arrows, like any other picture or graph. Optional picks must not pose a downgrade or introduce a
  real tradeoff not already introduced by "After". Use optional picks to suggest objectively better
  solutions for user to pick, even if they need more code or another round of drafts.

## Updating the page

- When user says what should be different, edit page in place by hand. Page drawn again from
  scratch hides the difference.
- Mark every part that changed as Updated, with purple outline and `UPDATED` badge, as granular as
  possible. Remove Updated marks of earlier rounds. Do not mark entire section as updated when it
  already existed before. Instead, circle in just the thing changed by you. Can also use purple
  underline on added or changed text. May use strikethrough `~~ ~~` when it helps understand a
  subtle change.
- Add to line under title what changed after last answer from user.
- When user picks optional pick, make it After picture of its section, remove other optional picks
  there. Remove optional pick declined by user.
- Update plain-words box and section titles whenever After changes.

## Making the page

- Draw page yourself, or hand first drawing to one agent when code to read is large. List in its
  prompt at a minimum: files to read, every section with states shown by it, rules of this skill,
  output path. Tell agent to
  write exactly that one file.
- Give that agent, for every state drawn by it that has code, the repository and either full commit
  ID of that state or path of working tree with uncommitted changes. Tell it to read every file of
  that state at that version, since checkout in which it starts can contain a different version.
- Render page in headless browser, look at screenshot before showing page. Page that only passed a
  check of its markup has not been seen.
- Open page for user. Where session is headless, or runs in harness that cannot open a file for
  user, show page the way harness allows, e.g. inline artifact, inline HTML or embedded screenshot.

## Implementation

- Take answer exactly as written. Answer approving an After picture with one change asks for that
  picture with that change.

## Images from the chat

- Copy image pasted by user into chat into local storage defined by `workflow-skills:local-cache`.
  Write path to image into notes described by `workflow-skills:implement`, so implementer finds it.
