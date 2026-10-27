import type { EngineInterface } from 'claude-code'

import type { SessionScope } from '../types'
import { isAwaitingAnswers } from './questions'
import { QuestionStoreError } from './questionStore'
import {
  establishSessionScope,
  hasPersonAtPrompt,
  readQuestions,
  readSessionScope,
  refreshQuestions,
} from './sessionState'

const NO_PERSON_AT_PROMPT = 'they work only in a session with a person at the prompt'

/**
 * Returns the scope of the session for a use of the questions, fixed at the first use in the
 * session, and reads the questions of its project for the band and the pane when this use fixed
 * it. Every use of the questions gets its scope here, and only in a session with a person at the
 * prompt.
 */
export async function scopeForUse($: EngineInterface): Promise<SessionScope> {
  if (!hasPersonAtPrompt()) {
    throw new Error(NO_PERSON_AT_PROMPT)
  }
  const { scope, isNew } = await establishSessionScope($)
  if (isNew) {
    await refreshQuestions($, scope)
  }

  return scope
}

/**
 * The scope of the session while it has a question of its own open or an answer it has not read,
 * by the questions it last read, and null otherwise. A tool call, a prompt and the end of a turn
 * read the store only while there is such a question.
 */
export async function awaitingScopeOf($: EngineInterface): Promise<SessionScope | null> {
  const scope = await readSessionScope($)

  return scope !== null && isAwaitingAnswers(await readQuestions($), scope.sessionId)
    ? scope
    : null
}

/**
 * Runs `work`, and on a failure of the store returns what `answer` makes of its message, after
 * writing the message to the debug log. Every other error is passed on.
 */
export async function handleStoreFailure<T>(
  $: EngineInterface,
  work: () => Promise<T>,
  answer: (message: string) => T | Promise<T>,
): Promise<T> {
  try {
    return await work()
  } catch (error) {
    if (!(error instanceof QuestionStoreError)) {
      throw error
    }
    $.ui.log(error.message, { to: 'debug' })

    return answer(error.message)
  }
}
