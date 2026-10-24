---
name: runtime-cost
description: Review a change for added work that grows with the data on a path run once per call, per item or per row.
---

# Runtime cost

Review the change for runtime cost only: how the work added or moved by the change grows with the
data on the paths that run it.

- Leave correctness, naming and structure to other reviewers.
- Follow every loop, scan, query, remote call or repeated computation added or moved by the change
  up through the code calling it to the entry points that run it, such as a request handler, a
  request that loads a page or a list, each tick of a worker or startup.
- State at each entry point how the cost grows: once per call, once per item or once per row, and
  with which collection.
- Report a walk over a whole collection inside a call made once per item or once per row on such a
  path.
- Report a query or remote call inside a loop, where one call for the whole set would do the same
  work.
- Report work repeated on every call where one pass, or one result stored for the duration of the
  call, would do it once.
- Report a cost that grows with unbounded data on a path that runs often.
- Report only work added or moved by the change, and only on a path that actually runs that work.
- Name in every finding the entry point and the chain of calls from it.
- State in every finding the growth, such as the number of attachments times the length of the
  history for each rendered page, and the change that would do the work once instead.
