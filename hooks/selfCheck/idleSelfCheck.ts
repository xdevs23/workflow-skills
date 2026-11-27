import type { EngineInterface, MatchedHook, Timer } from 'claude-code'

import type { SelfCheckSchedule } from '../../types'
import type { EveryEvent } from '../everyEvent'
import { isTypedByUser } from '../promptOrigin'
import { readCanSubmitPluginPrompt } from '../promptWaits'
import { runAfterEarlierRoasts } from '../roast/backgroundRoasts'
import { forkRoast } from '../roast/roastActions'
import { deliverRoast } from '../roast/roastDelivery'
import { useRoastOrNoPoint } from '../roast/roastOrNoPoint'
import type { RoastOrNoPointTexts } from '../roast/roastOrNoPoint'
import { SELF_CHECK_ROAST_PROMPT } from '../roast/roastPromptTexts'
import { RoastSource } from '../roast/roastState'
import {
  SELF_CHECK_ROAST_FOUND_NO_POINT,
  describeSelfCheckRoastNotAskedAgain,
  describeSelfCheckRoastNotWritten,
  describeSelfCheckRoastNotWrittenToast,
} from '../roast/roastTexts'
import { runAfter, runDetached } from '../timedWork'
import { readSelfCheckSchedule, startScheduleAt, takeDueSchedule } from './selfCheckState'
import { describeSelfCheckFailed } from './selfCheckTexts'

const SELF_CHECK_ROAST_TEXTS: RoastOrNoPointTexts = {
  foundNoPoint: SELF_CHECK_ROAST_FOUND_NO_POINT,
  describeNotAskedAgain: describeSelfCheckRoastNotAskedAgain,
  describeNotWritten: describeSelfCheckRoastNotWritten,
  describeNotWrittenToast: describeSelfCheckRoastNotWrittenToast,
}

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
    await startScheduleWaiting($, await $.session.id(), await $.clock.now())
  }

  return next(e)
}

/**
 * Waits again, without blocking the caller, for the due time of the self-check of the running
 * session. A due time that passed during a turn is roasted at once.
 */
export function waitForSelfCheckDueTime($: EngineInterface): void {
  runDetached($, () => waitForStoredDueTime($), describeSelfCheckFailed)
}

/** Waits for the due time in the self-check schedule of the running session, if it has one. */
async function waitForStoredDueTime($: EngineInterface): Promise<void> {
  const schedule = await readSelfCheckSchedule($, await $.session.id())
  if (schedule !== null) {
    await waitForDueTime($, schedule)
  }
}

/** Starts the self-check schedule of the session `sessionId` at `startedAt`, and waits for it. */
async function startScheduleWaiting(
  $: EngineInterface,
  sessionId: string,
  startedAt: number,
): Promise<void> {
  const schedule = await startScheduleAt($, sessionId, startedAt)
  if (schedule !== null) {
    await waitForDueTime($, schedule)
  }
}

/**
 * Replaces the wait of the session of `schedule` with one that roasts the delivered work at the
 * due time of `schedule`. A due time that passed already is roasted at once.
 */
async function waitForDueTime($: EngineInterface, schedule: SelfCheckSchedule): Promise<void> {
  const delay = Math.max(schedule.dueAt - (await $.clock.now()), 0)
  waits.get(schedule.sessionId)?.cancel()
  waits.set(
    schedule.sessionId,
    runAfter($, delay, () => roastAtDueTime($, schedule.sessionId), describeSelfCheckFailed),
  )
}

/**
 * Roasts the delivered work once the self-check is due, while a prompt submitted by the plugin
 * enters the session, and after every background roast started before. Taking the due time ends
 * the schedule, so a session left idle is checked once. The end of the next turn, a slash command
 * typed by the user after a turn stopped by the user, or the close by the user of a pane that makes
 * the prompts submitted by the plugin wait starts the wait for the due time again.
 */
async function roastAtDueTime($: EngineInterface, sessionId: string): Promise<void> {
  if (!(await readCanSubmitPluginPrompt($))) {
    return
  }
  if ((await takeDueSchedule($, sessionId)) !== undefined) {
    await runAfterEarlierRoasts(() => roastDeliveredWork($, sessionId))
  }
}

/**
 * Has a fork roast the work delivered in the session `sessionId`, as `forkRoast` describes, while
 * the user typed no message since, and sends the roast where the fork found a point. A roast sent
 * starts the schedule again, so the work it starts is checked in turn.
 */
async function roastDeliveredWork($: EngineInterface, sessionId: string): Promise<void> {
  const isStillWanted = async () => (await readSelfCheckSchedule($, sessionId)) === null
  const roast = await forkRoast($, SELF_CHECK_ROAST_PROMPT, isStillWanted)
  if (!(await isStillWanted())) {
    return
  }
  await useRoastOrNoPoint($, roast, SELF_CHECK_ROAST_TEXTS, async text => {
    await deliverRoast($, { source: RoastSource.SelfCheck, sessionId, text })
    await startScheduleWaiting($, sessionId, await $.clock.now())
  })
}
