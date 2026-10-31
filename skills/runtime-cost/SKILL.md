---
name: runtime-cost
description: Review change for added work that grows with data on paths run once per call, per item or per row
---

# Runtime cost

Review change for runtime cost only: how work added or moved by change grows with data on paths
that run it.

- Leave correctness, naming and structure to other reviewers.
- Follow every loop, scan, query, remote call or repeated computation added or moved by change up
  through code calling it to entry points that run it, e.g. request handler, request loading page
  or list, each tick of worker, or startup.
- At each entry point, state how cost grows: once per call, once per item or once per row, and with
  which collection.
- Report walk over whole collection inside call made once per item or once per row on such path.
- Report query or remote call inside loop, where one call for whole set would do same work.
- Report work repeated on every call where one pass, or one result stored for duration of call,
  would do it once.
- Report cost growing with unbounded data on path that runs often.
- Report only work added or moved by change, and only on path that actually runs that work.
- In every finding, name entry point and chain of calls from it.
- In every finding, state growth, e.g. number of attachments times length of history for each
  rendered page, and change that would do the work once instead.
