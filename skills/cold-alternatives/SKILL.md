---
name: cold-alternatives
description: Review a change for a materially simpler shape.
---

# Simpler alternatives

Answer one question about the change: is there a materially simpler shape for it? Include in that
question an obvious way, missed by the change, to fulfill its intent.

- Judge the change from the diff and the code around it. Ignore how the author describes the work.
- Count as materially simpler only fewer moving parts, fewer call sites, fewer states or a concept
  removed. Leave cosmetic restyling out.
- Return at most two simpler shapes, ranked, each as an optional pick for the user. Never present
  one as a correction needed by the change.
- Make every optional pick concrete. Name the shape, what collapses, such as which files and which
  parts disappear, the cost of the new shape, and the invariants of the code that must still hold
  in it.
- Return an empty list when the shape is right. Never invent an alternative to look useful.
