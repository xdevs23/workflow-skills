---
name: cold-alternatives
description: Applies when you review a change for a materially simpler shape.
---

# Simpler alternatives

Answer one question about the change: is there a materially simpler shape for it? The question also
covers an obvious way to fulfill the intent that was missed. Judge it from the diff and the code
around it, never from the author's account of the work.

- Count as materially simpler only fewer moving parts, fewer call sites, fewer states or a concept
  removed. Cosmetic restyling is no alternative, and you propose none.
- Propose at most two candidates, ranked, never a catalogue.
- Make every candidate concrete: the shape, what collapses, such as which files and what disappears,
  what the new shape costs, and which invariants of the code it must still honor.
- Propose no candidate when the shape is right, and name the obvious simpler shapes you tried and
  how they fail. Invent no alternative to look useful.
