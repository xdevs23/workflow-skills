---
name: handling-errors
description: Write what a system does when an operation fails: the error it returns, the retry, the fallback and the message shown to a person or an agent.
---

# Handling errors

- Never let a transient failure discard a good value.
- Fail loud. Something that must be handled raises an error when nothing handles it, and a silent
  check never hides a broken state.
- Return an error as a typed value that identifies what failed and contains the error that caused
  it, so a caller can match on it.
- Turn an error into text only where it is shown or logged.
- Report success from a confirmed result. A step that can fail returns its outcome, and the next
  step and the message to the user depend on it.
- Pass a failure across a language or process boundary as data, never as a panic or an exception
  that unwinds across it.
- Show an error to a person or an agent only when the system can't recover by itself and only a
  person can fix the cause, such as the one who sees it, someone they can ask, or the developers.
  Until then, let the system recover: it retries a temporary failure, or continues without the
  failed part.
- Give every error shown to a person or an agent a next step, drawn from one central source, never a
  hint written for one case. An error that only reports what happened is incomplete, such as "Image
  processing failed.". So is an error whose next step is what the system could have done itself,
  such as "Image processing failed. Try again later."
  - For a cause they can fix, show how to fix it: "Image couldn't be processed, because its
    metadata is invalid. Upload an image with valid metadata, or convert it to another format
    first."
  - For a cause in the system, show what they can try in the meantime: "Image failed to process due
    to a server error. We have recorded the failure and will work on a fix. In the meantime, try a
    smaller resolution or another format."
  - When nothing is left to try, report in the error that the failure was recorded, and show where
    to check on it later.
- Log every failure whose cause lies in the system, each failed try of a retry included, and say in
  plain words in the error shown for it that it was recorded.
- Always answer a waiting caller. Send a failure back to whoever waits, never only log it on the
  other side.
- Make the system retry by itself a failure known to be temporary, such as a refusal reporting that
  the other side is busy or a network failure, as long as the operation is safe to repeat. An
  operation is safe to repeat when it changes nothing, or when it contains an id derived from
  durable state by which the other side recognizes a repeat.
- Retry a write whose connection dropped only under that condition.
- Never retry automatically a failure not known to be temporary, such as a refused validation or a
  failure that can't be classified. Show it as an error with a next step.
- Show a running retry as progress with the number of tries so far, such as "Image processing
  failed, retrying (3 attempts)…", never as an error.
- Wait between tries for the time given by the refusing system, such as in a `Retry-After` header,
  or else for a randomized pause that grows up to the longest wait acceptable for the purpose of
  the work.
- Retry until the work succeeds or the purpose of it is gone, never until a count or a time limit
  set by the system itself. Do not retry work that would need such a limit.
- Treat a retry that fails again and again as a defect in the code, found through the logs and
  fixed there.
- Give a person who waits on a retry a way to cancel it.
- Give every retry that nobody watches a condition under which its result is no longer needed.
- Once a retry has failed several times, show beside its progress, as information and never as an
  error, that the problem is known and being taken care of and where to check on the work later,
  such as "We're having trouble processing this request and have recorded the incident. Come back
  later to check on its status."
- Give a caller waiting on the work the same information as the response.
- When an external system rejects an optional part of a request, degrade the result instead of
  failing. Send a fallback request without that part, and show a visible note that it was left out.
- Retry a temporary failure of the fallback like any other, and show a refusal from the fallback as
  an error.
