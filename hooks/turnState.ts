import type {
  EngineInterface,
  Frozen,
  Hook,
  Next,
  TurnCompleteInput,
  TurnCompleteResult,
} from 'claude-code'

import { isMainConversation } from './conversation'
import { setTurnRunning } from './sessionState'
import { runAfterMainTurn } from './timedWork'

export const markTurnRunning: Hook<'turn.start'> = async ($, e, next) => {
  if (isMainConversation(e)) {
    await setTurnRunning($, true)
  }

  return next(e)
}

/**
 * Runs the end of the turn `e`, and for a turn of the main conversation marks the turn as over
 * before it runs `work`, so `work` reads the turn as over.
 */
export function completeMainTurn(
  $: EngineInterface,
  e: Frozen<TurnCompleteInput>,
  next: Next<'turn.complete'>,
  work: () => Promise<void>,
): Promise<TurnCompleteResult> {
  return runAfterMainTurn(e, next, async () => {
    await setTurnRunning($, false)
    await work()
  })
}
