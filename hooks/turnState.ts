import type {
  EngineInterface,
  Frozen,
  Hook,
  Next,
  TurnCompleteInput,
  TurnCompleteResult,
} from 'claude-code'

import { isMainConversation } from './conversation'
import { isTypedByUser } from './promptOrigin'
import { SessionActivity, endStopByUser, setSessionActivity } from './sessionState'
import { runAfterMainTurn } from './timedWork'

export const markTurnRunning: Hook<'turn.start'> = async ($, e, next) => {
  if (isMainConversation(e)) {
    await setSessionActivity($, SessionActivity.TurnRunning)
  }

  return next(e)
}

/**
 * Ends the stop of a turn stopped by the user once the user runs a slash command, before the
 * command runs. The session accepts prompts submitted by a plugin again from then on, and such a
 * command starts no turn that would end the stop.
 */
export const endStopOnTypedCommand: Hook<'command.run'> = async ($, e, next) => {
  if (isTypedByUser(e.origin)) {
    await endStopByUser($)
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
