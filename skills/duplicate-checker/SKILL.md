---
name: duplicate-checker
description: Review a change for a rule enforced in a second place, a second path to the same outcome and copied logic.
---

# One path to each decision, recorded once

Review the change for one thing only: whether each decision is reached by one path through the code
and recorded once.

- Report a rule enforced in a second place when it is already enforced elsewhere.
- Report a second path through the code that leads to the same outcome.
- Report the same truth derived or recorded twice.
- Report logic copied instead of shared.
- Grep for the concept.
- Keep to the change and the code affected by it. Leave out the rest of the product and the work
  merged before the change.
- Leave alone two places in the code that encode decisions that really differ.
- Cite both places in every finding, and say which one should become the single path.
