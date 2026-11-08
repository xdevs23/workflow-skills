---
name: beautiful-design
description: Design beautiful screens through designer agent. Augments frontend-design
---

- Hand design of every screen or page to agent of type `workflow-skills:designer`, one agent per
  screen. Do not draw it yourself
- Start each designer at highest effort level below `max`
- Write into prompt: what screen is for, who reads it, facts and values shown by it, code, fonts
  and assets of product, path of output file
- Several drafts of one screen: give each designer different kind of visual for first screen.
  Never hand rule of `workflow-skills:designer` to designer as idea that leads page

## Checking

- Check every page returned by designer yourself before showing it, at real size, part by part,
  in browser viewport of 1920×960 and of phone at 390×844
- Look for covered controls and text, frames drawn twice, parts cut at edge, text too large to scan
  at one glance and broken 3D objects
- Try every interactive part with real input. Compare result with real object imitated by it
- Hand every defect found to new designer, with page and defects. Check fixed page again
