import type { SessionCompactResult } from 'claude-code'

import { JsonTextNotRead } from '../jsonText'
import { RoastNotWrittenCause } from './roastFailure'
import type { RoastFailure } from './roastFailure'

/** The reply of a compaction asked to write a roast in place of a summary, or why none came. */
export type RoastOfCompaction =
  | { readonly isWritten: true; readonly reply: string }
  | { readonly isWritten: false; readonly failure: RoastFailure }

/**
 * The roast written by `compaction` in place of its summary. The engine puts its own lines before
 * and after the summary in the first message, so the reply is the JSON object inside that message:
 * from its first `{` to the last `}` after which the text parses.
 */
export function readRoastOfCompaction(compaction: SessionCompactResult): RoastOfCompaction {
  if (compaction.skip !== undefined) {
    return {
      isWritten: false,
      failure: { cause: RoastNotWrittenCause.CompactionSkipped, reason: compaction.skip },
    }
  }
  const summary = compaction.messages[0]?.text
  if (summary === undefined || summary.trim() === '') {
    return { isWritten: false, failure: { cause: RoastNotWrittenCause.EmptyReply } }
  }
  const reply = findJsonObjectIn(summary)

  return reply === undefined
    ? {
        isWritten: false,
        failure: {
          cause: RoastNotWrittenCause.UnreadableReply,
          reason: JsonTextNotRead.NotJson,
          reply: summary,
        },
      }
    : { isWritten: true, reply }
}

/** The longest text from the first `{` of `text` to a `}` that parses as JSON. */
function findJsonObjectIn(text: string): string | undefined {
  const start = text.indexOf('{')
  if (start === -1) {
    return undefined
  }
  for (let end = text.lastIndexOf('}'); end > start; end = text.lastIndexOf('}', end - 1)) {
    const candidate = text.slice(start, end + 1)
    if (parsesAsJson(candidate)) {
      return candidate
    }
  }

  return undefined
}

function parsesAsJson(text: string): boolean {
  try {
    JSON.parse(text)

    return true
  } catch (error) {
    if (error instanceof SyntaxError) {
      return false
    }
    throw error
  }
}
