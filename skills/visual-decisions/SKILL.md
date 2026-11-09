---
name: visual-decisions
description: Draw page for user to look at: drafts, product decisions, plans and explanations
---

## When it applies

- Draw page when `workflow-skills:implement` asks for draft of a change. Show on it overall shape,
  direction, architecture and design of change
- Draw page when change sets what someone sees or does, scope of product or which data is kept
- Draw page for substantial plan or design, and for explanation of complex code path, problem or
  trade-off. Open it for user instead of writing it into chat

## Before you draw

- Read in full the code behind every state drawn by you, at version shown by that state: its
  commit, or working tree with changes not committed yet. Exception: an After not defined by code
  yet
- Draw every state that has code from what that code does
- Read approved drafts of same feature before drawing draft of its sub-unit
- Pick one realistic sample for whole page: real-looking names, texts and values. At least one long
  value where length matters

## The page

- Write one standalone HTML file, all CSS inside it, without external resources
- Write every HTML page meant for user in dark mode, except draft of app screen, which follows
  `workflow-skills:design-drafts`
- Keep file on filesystem on which you work, in project cache defined by
  `workflow-skills:local-cache`.
  Upload or publish elsewhere only when user explicitly allowed it
- Open page with name of change as title. Below it, one line: what page is for, which states
  pictures show
- Below that line, put box titled "What this is about, in plain words": at most 4 bullets of at
  most 14 words each, explaining change or decision to someone who never saw the code. Contents:
  one concrete example, what goes wrong or is missing today, what After does, what After does not
  change although reader could expect it to
- Under that box, put two short lists side by side: "What this draft builds" and "What this draft
  doesn't build". In first, name unit or sub-unit drawn, by number of its entry in `TODO.md`, and
  what it builds. In second, name every part shown on page or expected by reader that comes later
  or belongs to other unit, with number of its entry. Name each part in at most 3 words
- Put legend under those lists, one marker per kind of mark used by page:
  - After, in green, for part added or changed by the change;
  - earlier state, in red, for part left out by After;
  - dashed box, for file not edited by the change;
  - Updated, in purple, for part that changed after last reply from user;
  - short bar with its value, for number needed by decision. Filled green where value fits, red
    where over limit
- Fit every page into viewport of 1920×960
- Draft that needs cramming to fit, is too complicated to read, or draws changes of more than one
  pull request: split unit into sub-units as `workflow-skills:todo-md` describes, one draft per
  sub-unit. Never add pages to draft
- Product decisions that need more room: split them into separate pages. Draw next page once user
  replied to the one before
- Split page into numbered sections, each with title of at most 8 words
- Title each section showing After with outcome shown by its pictures, e.g. "Every open question
  survives a restart"
- Draw each section in form given by section on pictures for what it shows
- Name sample in one line under title of first section using it
- Put pictures of a section side by side, each with label above it for state shown by it: branch
  with its unpushed commits, a release, or After. Earlier states first, After last
- Show step that changes something as two pictures of same state, before and after step, joined by
  arrow labeled with at most 4 words. Picture before step is not earlier state and not red
- On draft of sub-unit, drop section that only repeats decision already approved on draft of same
  feature
- Put caption of at most 15 words under each picture
- Mark part of picture that changes in color of its legend marker, so eye finds difference first
- Never draw stamp, torn paper, scribble or cartoon icon, as mark or as picture. Show refused or
  damaged state by color of legend and plain label
- Write words on rest of page only as labels, titles, captions and marks. Never fill picture with
  sentences, table of text or list of cases
- Keep draft of change under 250 words of titles, labels, captions, bullets and badges, counted on
  rendered page. Text shown by imitated screen or message does not count. Cut it to what decision
  needs
- On drafts of sub-units of one feature, draw same thing with same picture and same sample values
- Draw page in visual way, so user looking at it sees at first glance what end result is and
  how change feels

## Pictures

- Draw visible change as imitation of real screen, with its structure, labels and look. Where
  possible and cheap, make real screenshots or import real screen, so user sees how it looks
- Draw picture at real size of what it shows, with what surrounds it. Scale it down only where page
  would not fit viewport otherwise
- Draw what goes wrong at place in picture where it happens, in color of state to which it belongs
- Where decision depends on a number, show that number above each picture of decision as short bar
  named in legend
- Draw behavior that unfolds over time as timeline of sample: earlier state and After on same time
  axis, count of events that matter written on each
- Draw work repeated many times as one mark per run, earlier state and After side by side, so
  count shows at first glance
- Write beside each measured number what was measured, how often and under which conditions
- Draw physical quantity as picture of thing to which it belongs, filled to its value
- Draw samples passing series of steps or checks as table: one row per sample, one column per
  step, outcome in each cell. Show real output of step where sample stops
- Draw rules that differ by person, role or place as table: one row per rule, one column per
  sample person or place, outcome in each cell
- Draw technical details, e.g. migrations, data models, schemas, as pictures or graphs
- Draw added or changed data as tree of fields, earlier state and After side by side. Mark each
  field added by After. Write in plain words, in column beside each field, what field is used for
- Draw value defined in one place and used in several as graph from place defining it to every
  place using it
- Draw change happening out of sight, e.g. where in code a decision is made, as boxes and arrows:
  which part calls which, what passes between them, in each state. Label first and last box with
  real name of setting, service, file or hardware switch. Write under each box what it does in
  After, in at most 3 words
- Never paste code, diff or test list into draft. Approval of draft would approve that code
- Show code only as short snippet of few lines that shows idea, under header with component and
  path. Go one layer up and abstract away internal details of code, so functions, variables and
  other declarations read like what it does in real world. Write in separate column beside each
  line what line does in plain words
- Write code asked for by user on page of its own next to draft, files side by side under their
  paths, dark mode. Open it like draft. Never answer such request in chat

## Choices

- Make every choice left open by user's words yourself, product choices too, and draw it as part of
  After. User says what should be different
- Draw one After for each section, using better approach
- Do not ask questions in page, and do not add open points
- Never ask user about draft of change, e.g. whether shape shown in it fits. Open it

## Updating the page

- When user says what should be different, edit page in place by hand. Page drawn again from
  scratch hides the difference
- Mark every part that changed as Updated, with purple outline and `UPDATED` badge. Remove Updated
  marks of earlier rounds. Circle just thing changed by you instead of marking entire section that
  already existed before. Can also use purple underline on added or changed text. May use
  strikethrough `~~ ~~` when it helps understand a subtle change
- Write into line under title what changed after last reply from user, in place of text of earlier
  round
- Update plain-words box and section titles whenever After changes

## Making the page

- Draw page yourself, or hand first drawing to one agent when code to read is large. List in its
  prompt at a minimum: files to read, approved drafts of same feature, every section with states
  shown by it, rules of this skill, output path. Tell agent to write exactly that one file
- Give that agent, for every state drawn by it that has code, the repository and either full commit
  ID of that state or path of working tree with uncommitted changes. Tell it to read every file of
  that state at that version, since checkout in which it starts can contain a different version
- Render page in headless browser at 1920×960, take screenshot of full page and look at it before
  showing page. Check that each section shows at first glance what it decides, without reading a
  sentence. Count words of draft of change with script. Redraw section that needs reading
- Open page for user. Open one draft at a time. Draw and open next one once user approved the one
  before, since it can change what follows. Where session is headless, or runs in harness that
  cannot open a file for user, show page the way harness allows, e.g. inline artifact, inline HTML
  or embedded screenshot

## Implementation

- Take answer exactly as written. Answer approving an After picture with one change asks for that
  picture with that change

## Images from the chat

- Copy image pasted by user into chat into local storage defined by `workflow-skills:local-cache`.
  Write path to image into notes described by `workflow-skills:implement`, so implementer finds it
