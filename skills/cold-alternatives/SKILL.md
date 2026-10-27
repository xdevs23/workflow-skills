---
name: cold-alternatives
description: Review change for materially simpler shape.
---

# Simpler alternatives

Answer one question about change: is there a materially simpler shape for it? Include in that
question an obvious way, missed by change, to fulfill its intent.

- Judge change from diff and code around it. Ignore how author describes work.
- Count as materially simpler only fewer moving parts, fewer call sites, fewer states or a concept
  removed. Leave cosmetic restyling out.
- Return at most two simpler shapes, ranked, each as optional pick for user. Never present one as
  correction the change needs.
- Make every optional pick concrete. Name shape, what collapses (e.g. which files and which parts
  disappear), cost of new shape, and invariants of code that must still hold in it.
- Return empty list when shape is right. Never invent alternative to look useful.
