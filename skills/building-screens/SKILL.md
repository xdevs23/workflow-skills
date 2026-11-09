---
name: building-screens
description: Build or change user interface
---

- Show backend decision on screen. Never make it again in code of the screen. Keep there neither
  optimistic state nor second copy of backend data
- Let frontend send new data. Never read back from response. Frontend reloads data, fully or
  partly where supported, through same code path as full reload or restart. Preferred live
  data, like websocket or long-polling/SSE
- Build create and edit of entity on one shared form, never in dialog, so create and edit never
  diverge
- Prefer creating entity by asking server for new empty entity in inactive state, such as
  disabled, unpublished or disarmed, then opening shared form on it, loaded as on any reload

## Rules in other skills

- Follow `workflow-skills:design` to draw or build screen
