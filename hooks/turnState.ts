import type {
  EngineInterface,
  Frozen,
  Hook,
  Next,
  TurnCompleteInput,
  TurnCompleteResult,
} from 'claude-code'

import { isMainConversation } from './conversation'
import { SessionActivity, setSessionActivity } from './sessionState'
import { runAfterMainTurn } from './timedWork'

export const markTurnRunning: Hook<'turn.start'> = async ($, e, next) => {
  if (isMainConversation(e)) {
    await setSessionActivity($, SessionActivity.TurnRunning)
  }

  return next(e)
}

/**
 * Marks a turn of the main conversation as over before the other hooks of its end run, so each of
 * them reads the turn as over, and then runs the end of the turn `e` and `work` as
 * `runAfterMainTurn` does. A turn that the engine reports as aborted is marked as stopped by the
 * user.
 */
export async function completeMainTurn(
  $: EngineInterface,
  e: Frozen<TurnCompleteInput>,
  next: Next<'turn.complete'>,
  work: () => Promise<void>,
): Promise<TurnCompleteResult> {
  if (isMainConversation(e)) {
    await setSessionActivity(
      $,
      e.isAborted ? SessionActivity.StoppedByUser : SessionActivity.Idle,
    )
  }

  return runAfterMainTurn(e, next, work)
}
