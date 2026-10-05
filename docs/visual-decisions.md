# Decisions as pictures

The visual decisions skill, `workflow-skills:visual-decisions`, puts open product or architecture
decisions to the user as one HTML page. Every decision on the page is a set of pictures side by
side, the code as it stands and After, with a short caption under each and a highlight on the part
that changes, and the message that opens the page ends with one question the user can answer per
decision.

## What the skill asks for

Every picture of a state is labelled by what that state is: the merged code by its branch or
deployment, such as the main branch, the develop branch or production, and work that is not merged
yet as unmerged, with its branch. A decision shows the state it starts from and After, or, when it
helps, three pictures: the merged code, the unmerged work and After. Before drawing, the assistant
reads in full the code behind every state it draws, at the commit that state names, so each picture
shows what that code does. A statement about a state that its code contradicts is drawn as the code
has it, with a line starting `CORRECTION:` under the decision, and an After that the code does not
define yet is drawn as a proposal whose caption names any layout the assistant chose.

The page is one standalone HTML file in the project cache, with its CSS inside it and no external
resources. It holds no paragraphs. A visible change imitates the real screen, a change nobody sees
is drawn as boxes and arrows, and one realistic sample runs through every decision of the page. The
drawing can go to one agent when the code to read is large, and the assistant renders the page once
in a headless browser and looks at the screenshot before showing it.

The chat message holds the page path, one line per decision and one question. An answer is taken
exactly as written. A choice the rules already decide stays off the page and is stated in one line
in the chat.

## The decisions in a unit spec

A unit spec quotes only records of the session transcripts. An image the user pastes into the chat
is in the record of that message, so a spec entry that quotes the message reaches the image. The
assistant can also copy the images into the project cache, name their paths in the chat, and then
write the spec.

## Decisions and their reasons

The skill's description says only when it applies, as the repository's rules for skills require.
Scratch files follow the project cache skill, so the page goes where every other file not meant for
the repository goes. The skill names no browser, because the plugin ships no general renderer for a
page, and the visual verification skill is a harness for a project's own interface.

No picture is labelled Today, Now or Current. The assistant usually draws from a worktree whose
changes are not merged yet, and such a label reads as the state the work started from, so the user
took unmerged work for the code that was already in place. A label that names the branch, the
deployment or the unmerged work says which code the picture shows.

## Rejected alternatives

**rejected-today-label**: A pair of pictures labelled Today and After. Reason: Today hides whether
the picture shows the merged code or the assistant's own unmerged work.
