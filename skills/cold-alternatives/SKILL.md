---
name: cold-alternatives
description: Applies when you review a change for a materially simpler shape.
---

# Simpler alternatives

Answer one question about the change: is there a materially simpler shape for it? The question also
covers an obvious way to fulfill the intent that was missed. Judge it from the diff and the code
around it, never from the author's account of the work.

- Count as materially simpler only fewer moving parts, fewer call sites, fewer states or a concept
  removed. Leave cosmetic restyling out.
- Return at most two simpler shapes, ranked, each as an optional pick that the user may choose.
  Never present one as a correction the change needs.
- Make every optional pick concrete: the shape, what collapses, such as which files and what
  disappears, what the new shape costs, and which invariants of the code it must still honor.
- Return an empty list when the shape is right. Invent no alternative to look useful.
