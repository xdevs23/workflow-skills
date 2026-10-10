---
name: runtime-cost
description: Applies when you review a change for work it adds that grows with the data on a path run per call, per item or per row.
---

# Runtime cost

Review the change through one lens, runtime cost: how the work a change adds or moves grows with the
data on the paths that run it. A diff can be correct line by line and still put a walk over a whole
collection inside a call made once per item, and only its callers show that. Leave correctness,
naming and structure to other lenses.

- Follow every loop, scan, query, remote call or repeated computation the change adds or moves up
  its callers to the entry points that run it, such as a request handler, a page or list read, a
  worker tick or startup.
- State at each entry point how its cost grows: once per call, once per item or once per row, and
  with which collection.
- Report a walk over a whole collection inside a call made once per item or once per row on such a
  path.
- Report a query or remote call inside a loop, where one call for the whole set would serve.
- Report work repeated on every call that one pass, or one result kept for the call, would do once.
- Report a cost that grows with data that has no bound, on a path that runs often.
- Report only what the change adds or moves, and only on a path that actually runs it.
- Name in every finding the entry point and the call chain from it, and state the growth, such as
  attachments × history length per page render, with the change that would do the work once
  instead.
