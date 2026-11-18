import type {
  CommandRunInput,
  CommandRunResult,
  EngineInterface,
  Frozen,
  Hook,
  Next,
  TurnCompleteInput,
  TurnCompleteResult,
} from 'claude-code'

import { isMainConversation } from './conversation'
import { isTypedByUser } from './promptOrigin'
import { SessionActivity, changeSessionActivity, setSessionActivity } from './sessionState'
import { runAfterMainTurn } from './timedWork'

export const markTurnRunning: Hook<'turn.start'> = async ($, e, next) => {
  if (isMainConversation(e)) {
    await setSessionActivity($, SessionActivity.TurnRunning)
  }

  return next(e)
}

/**
 * Marks an idle session as running a turn before a prompt typed by the user enters, so texts
 * waiting for the session go with that turn. A slash command such as a skill submits its prompt
 * while the command runs, before the texts that waited during a stop are sent. A prompt that does
 * not enter starts no turn, and the session is marked as idle again.
 */
export const markTypedPromptTurnRunning: Hook<'prompt.submit'> = async ($, e, next) => {
  const isMarked =
    isTypedByUser(e.origin) &&
    (await changeSessionActivity($, SessionActivity.Idle, SessionActivity.TurnRunning))
  let hasEntered = false
  try {
    const result = await next(e)
    hasEntered = result.drop === undefined

    return result
  } finally {
    if (isMarked && !hasEntered) {
      await changeSessionActivity($, SessionActivity.TurnRunning, SessionActivity.Idle)
    }
  }
}

/**
 * Ends the stop of a turn stopped by the user once the user types a slash command, before the
 * command `e` runs. The session accepts prompts submitted by a plugin again from then on.
 * `sendTextsWaitingForSession` starts sending every text that waited, once the command ran or
 * failed, because a command such as /goals, /roast or /reminders starts no turn whose end would
 * send them.
 */
export async function endStopOnTypedCommand(
  $: EngineInterface,
  e: Frozen<CommandRunInput>,
  next: Next<'command.run'>,
  sendTextsWaitingForSession: () => void,
): Promise<CommandRunResult> {
  const hasEndedStop =
    isTypedByUser(e.origin) &&
    (await changeSessionActivity($, SessionActivity.StoppedByUser, SessionActivity.Idle))
  try {
    return await next(e)
  } finally {
    if (hasEndedStop) {
      sendTextsWaitingForSession()
    }
  }
}

/**
 * Marks a turn of the main conversation as over before the other hooks of its end run, so each of
 * them reads the turn as over. Then runs the end of the turn `e`, and
 * `sendTextsWaitingForSession` as `runAfterMainTurn` runs its work. A turn that the engine reports
 * as aborted is marked as stopped by the user.
 */
export async function completeMainTurn(
  $: EngineInterface,
  e: Frozen<TurnCompleteInput>,
  next: Next<'turn.complete'>,
  sendTextsWaitingForSession: () => void,
): Promise<TurnCompleteResult> {
  if (isMainConversation(e)) {
    await setSessionActivity(
      $,
      e.isAborted ? SessionActivity.StoppedByUser : SessionActivity.Idle,
    )
  }

  return runAfterMainTurn(e, next, async () => sendTextsWaitingForSession())
}
