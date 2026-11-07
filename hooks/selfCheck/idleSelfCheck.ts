import type { EngineInterface, MatchedHook, Timer } from 'claude-code'

import type { SelfCheckSchedule } from '../../types'
import type { EveryEvent } from '../everyEvent'
import { isTypedByUser } from '../promptOrigin'
import { submitToSessionOrRestore, submitWithNoteOrRestore } from '../sendToModel'
import { readIsTurnRunning } from '../sessionState'
import { runAfter, waitAgainAfterTurn } from '../timedWork'
import {
  readSelfCheckSchedule,
  restoreDueTime,
  startScheduleAt,
  takeDueTime,
} from './selfCheckState'
import type { TakenDueTime } from './selfCheckState'
import { SELF_CHECK_TEXT, SENT_LINE, describeSelfCheckFailed } from './selfCheckTexts'

// The pending wait for the due time of each session, so a new wait replaces the one before it. A
// reload of the plugin cancels the waits and loads this module again, so the start of the session
// that follows waits again for the due time in the state.
const waits = new Map<string, Timer>()

export const waitForDueTimeAfterLoad: MatchedHook<'session.start', EveryEvent> = async (
  $,
  e,
  next,
) => {
  await waitForStoredDueTime($)

  return next(e)
}

// A session switched to with /resume has no wait in this process when its wait ended while
// another session ran.
export const waitForDueTimeAfterSwitch: MatchedHook<'classic.SessionStart', EveryEvent> = async (
  $,
  e,
  next,
) => {
  await waitForStoredDueTime($)

  return next(e)
}

export const startScheduleOnUserMessage: MatchedHook<'prompt.submit', EveryEvent> = async (
  $,
  e,
  next,
) => {
  if (isTypedByUser(e.origin)) {
    const schedule = await startScheduleAt($, await $.session.id(), await $.clock.now())
    if (schedule !== null) {
      await waitForDueTime($, schedule)
    }
  }

  return next(e)
}

// Every prompt not typed by the user, such as one from a timer, a scheduled task or a plugin,
// contains the self-check once it is due. A command may run without the model, so it contains
// nothing.
export const submitWithSelfCheck: MatchedHook<'prompt.submit', EveryEvent> = async (
  $,
  e,
  next,
) => {
  if (isTypedByUser(e.origin) || e.command !== undefined) {
    return next(e)
  }
  const taken = await takeSelfCheck($, await $.session.id())
  if (taken === undefined) {
    return next(e)
  }
  const delivery = await submitWithNoteOrRestore(e, next, SELF_CHECK_TEXT, () =>
    restoreDueTime($, taken),
  )
  if (delivery.isAccepted) {
    $.ui.log(SENT_LINE)
  }

  return delivery.result
}

// A due time that passed during the turn is sent once the turn ended.
export const waitForDueTimeAfterTurn: MatchedHook<'turn.complete', EveryEvent> = ($, e, next) =>
  waitAgainAfterTurn(e, next, () => waitForStoredDueTime($))

/** Waits for the due time in the self-check schedule of the running session, if it has one. */
async function waitForStoredDueTime($: EngineInterface): Promise<void> {
  const schedule = await readSelfCheckSchedule($, await $.session.id())
  if (schedule !== null) {
    await waitForDueTime($, schedule)
  }
}

/**
 * Replaces the wait of the session of `schedule` with one that sends the self-check at the due time
 * of `schedule`. A due time that passed already is sent at once.
 */
async function waitForDueTime($: EngineInterface, schedule: SelfCheckSchedule): Promise<void> {
  const delay = Math.max(schedule.dueAt - (await $.clock.now()), 0)
  waits.get(schedule.sessionId)?.cancel()
  waits.set(
    schedule.sessionId,
    runAfter($, delay, () => sendAtDueTime($, schedule.sessionId), describeSelfCheckFailed),
  )
}

/**
 * Sends the self-check as a prompt that starts a turn, once it is due and while no turn runs. The
 * end of a running turn waits for the due time again.
 */
async function sendAtDueTime($: EngineInterface, sessionId: string): Promise<void> {
  if (await readIsTurnRunning($)) {
    return
  }
  const taken = await takeSelfCheck($, sessionId)
  if (taken === undefined) {
    return
  }
  // The prompt shows in the transcript itself, so the transcript line is not shown.
  await submitToSessionOrRestore($, sessionId, { text: SELF_CHECK_TEXT }, () =>
    restoreDueTime($, taken),
  )
}

/**
 * Takes the due time of the session `sessionId` for sending when the self-check is due, and waits
 * for the next due time. A due time put back after the self-check was not sent is due before that
 * wait ends, and the wait sends the self-check at the latest.
 */
async function takeSelfCheck(
  $: EngineInterface,
  sessionId: string,
): Promise<TakenDueTime | undefined> {
  const taken = await takeDueTime($, sessionId)
  if (taken !== undefined) {
    await waitForDueTime($, taken.next)
  }

  return taken
}
