---
name: design
description: Any design work on screen or page, from drawing it to building it and drafts of it
---

- Screen or page to draw, with Agent tool at hand: follow sections `workflow-skills:designer` and
  Checking below
- Screen or page to draw or build without Agent tool, e.g. as implementer: load
  `frontend-design`, `workflow-skills:ui-design` and `workflow-skills:ux-design` with Skill tool,
  and `workflow-skills:web-design` too for web page. Follow them yourself
- Drafts for user to choose from: load `workflow-skills:design-drafts` too

## `workflow-skills:designer`

- Hand design of every screen or page to agent of type `workflow-skills:designer`, one agent per
  screen. Do not draw it yourself
- Start each designer at highest effort level below `max`
- Write into prompt: what screen is for, who reads it, facts and values shown by it, code, fonts
  and assets of product, path of output file
- Say in prompt whether screen is web page or app screen
- Several drafts of one screen: give each designer different kind of visual for first screen.
  Never hand rule of `workflow-skills:ui-design`, `workflow-skills:ux-design` or
  `workflow-skills:web-design` to designer as idea that leads page

## Checking

- Check every page returned by designer yourself before showing it, at real size, part by part,
  in browser viewport of 1920×960 and of phone at 390×844
- Look for covered controls and text, frames drawn twice, parts cut at edge, text too large to scan
  at one glance and broken 3D objects
- Try every interactive part with real input. Compare result with real object imitated by it
- Fix every defect found yourself, as part of implementation. Never start second
  `workflow-skills:designer` for it. Check fixed page again
