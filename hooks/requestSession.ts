import type { EngineInterface } from 'claude-code'

import { isAwaitingReplies } from './requests'
import { hasPersonAtPrompt, readRequestsInState } from './sessionState'

const NO_PERSON_AT_PROMPT = 'they work only in a session with a person at the prompt'

/**
 * Returns the id of the session for a use of the requests. Every use of the requests gets its
 * session here, and only in a session with a person at the prompt.
 */
export async function sessionForUse($: EngineInterface): Promise<string> {
  if (!hasPersonAtPrompt()) {
    throw new Error(NO_PERSON_AT_PROMPT)
  }

  return $.session.id()
}

/**
 * The id of the session while it has a request open or a reply it has not read, by the
 * requests it last read, and null otherwise. A tool call, a prompt and the end of a turn read the
 * store only while there is such a request.
 */
export async function awaitingSessionOf($: EngineInterface): Promise<string | null> {
  const inState = await readRequestsInState($)

  return inState !== null && isAwaitingReplies(inState.requests) ? inState.sessionId : null
}
