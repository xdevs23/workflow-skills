---
name: handling-errors
description: Write what system does when operation fails: error returned, retries, fallbacks, messages shown to people or agents
---

# Handling errors

- Never let transient failure discard good value.
- Fail loud. Something that must be handled raises error when nothing handles it. Silent check
  never hides broken state.
- Return error as typed value identifying what failed and containing the error that caused it, so
  caller can match on it.
- Turn error into text only where it is shown or logged.
- Report success from confirmed result. Step that can fail returns its outcome. Next step and
  message to user depend on it.
- Pass failure across language or process boundary as data, never as panic or exception unwinding
  across it.
- Show error to person or agent only when system cannot recover by itself and only a person can fix
  the cause, e.g. the one who sees it, a person reachable by them, or the developers. Until then,
  let system recover: it retries temporary failure, or continues without failed part.
- Give every error shown to person or agent a next step, drawn from one central source, never a
  hint written for one case. Error that only reports what happened = incomplete, e.g. "Image
  processing failed.". Same for error whose next step is what system could have done itself, e.g.
  "Image processing failed. Try again later."
  - For cause they can fix, show how to fix it: "Image couldn't be processed, because its metadata
    is invalid. Upload an image with valid metadata, or convert it to another format first."
  - For cause in system, show what they can try meanwhile: "Image failed to process due to a server
    error. We have recorded the failure and will work on a fix. In the meantime, try a smaller
    resolution or another format."
  - When nothing left to try, report in error that failure was recorded, and show where to check
    on it later.
- Log every failure whose cause lies in system, each failed try of a retry included. Say in plain
  words in error shown for it that it was recorded.
- Always answer waiting caller. Send failure back to whoever waits, never only log it on other
  side.
- Make system retry by itself failure known to be temporary, e.g. refusal reporting that other
  side is busy, or network failure, as long as operation is safe to repeat. Operation is safe to
  repeat when it changes nothing, or when it contains id derived from durable state by which other
  side recognizes a repeat.
- Retry write whose connection dropped only under that condition.
- Never retry automatically failure not known to be temporary, e.g. refused validation or failure
  that cannot be classified. Show it as error with next step.
- Show running retry as progress with number of tries so far, e.g. "Image processing failed,
  retrying (3 attempts)…", never as error.
- Wait between tries for time given by refusing system, e.g. in `Retry-After` header. Otherwise wait
  for randomized pause growing up to longest wait acceptable for purpose of the work.
- Retry until work succeeds or its purpose is gone, never until count or time limit set by system
  itself. Do not retry work that would need such limit.
- Treat retry failing again and again as defect in code, found through logs and fixed there.
- Give person waiting on retry a way to cancel it.
- Give every retry not watched by anybody a condition under which its result is no longer needed.
- Once retry has failed several times, show beside its progress, as information and never as
  error, that problem is known and being taken care of, and where to check on work later, e.g.
  "We're having trouble processing this request and have recorded the incident. Come back later to
  check on its status."
- Give caller waiting on work the same information as the response.
- When external system rejects optional part of request, degrade result instead of failing. Send
  fallback request without that part. Show visible note that it was left out.
- Retry temporary failure of fallback like any other. Show refusal from fallback as error.
