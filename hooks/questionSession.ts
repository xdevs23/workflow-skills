import type { EngineInterface } from 'claude-code'

import { isAwaitingAnswers } from './questions'
import { hasPersonAtPrompt, readQuestionsInState } from './sessionState'

const NO_PERSON_AT_PROMPT = 'they work only in a session with a person at the prompt'

/**
 * Returns the id of the session for a use of the questions. Every use of the questions gets its
 * session here, and only in a session with a person at the prompt.
 */
export async function sessionForUse($: EngineInterface): Promise<string> {
  if (!hasPersonAtPrompt()) {
    throw new Error(NO_PERSON_AT_PROMPT)
  }

  return $.session.id()
}

/**
 * The id of the session while it has a question open or an answer it has not read, by the
 * questions it last read, and null otherwise. A tool call, a prompt and the end of a turn read the
 * store only while there is such a question.
 */
export async function awaitingSessionOf($: EngineInterface): Promise<string | null> {
  const inState = await readQuestionsInState($)

  return inState !== null && isAwaitingAnswers(inState.questions) ? inState.sessionId : null
}
