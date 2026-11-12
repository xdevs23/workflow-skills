import type { EngineInterface, MatchedHook } from 'claude-code'

import type { Goal, WaitingNudge } from '../../types'
import type { EveryEvent } from '../everyEvent'
import { showFailure } from '../failureToast'
import { PromptOutcome, submitToSession } from '../sendToModel'
import { readIsTurnRunning } from '../sessionState'
import { runDetached, waitAgainAfterTurn } from '../timedWork'
import { openGoalsByIdOf } from './board'
import { doneMarkOf } from './doneMark'
import { readBoardToRemind } from './goalReminderBoard'
import { describeNudge } from './goalReminders'
import { readWaitingNudge, updateWaitingNudge } from './goalState'
import { describeAlreadyMarkedDone, describeNudgeNotSent, describeNudgeWaiting } from './goalTexts'

// A prompt submitted by the plugin while a turn runs would enter only once the turn ended, with a
// text written before. So a press while a turn runs leaves the nudge waiting, and the end of the
// turn sends it with the goal as the board has it then. One nudge waits at a time, so presses
// repeated meanwhile send nothing twice.

/**
 * Sets the nudge to finish the open goal `goal` as the waiting nudge of the session `sessionId`,
 * unless one waits already, and sends it at once while no turn runs. Otherwise a toast names the
 * goal of the waiting nudge.
 */
export async function nudgeOpenGoal(
  $: EngineInterface,
  sessionId: string,
  goal: Goal,
): Promise<void> {
  if (doneMarkOf(goal) !== undefined) {
    $.ui.toast(describeAlreadyMarkedDone(goal))
    return
  }
  const pressed: WaitingNudge = {
    sessionId,
    nudgeId: crypto.randomUUID(),
    goalId: goal.id,
    goalNumber: goal.number,
    isSending: false,
  }
  const waiting = await updateWaitingNudge($, sessionId, nudge => nudge ?? pressed)
  if (waiting === null) {
    return
  }
  if (waiting.nudgeId === pressed.nudgeId && !(await readIsTurnRunning($))) {
    sendDetached($, waiting)
    return
  }
  $.ui.toast(describeNudgeWaiting({ number: waiting.goalNumber }))
}

export const sendNudgeAfterTurn: MatchedHook<'turn.complete', EveryEvent> = ($, e, next) =>
  waitAgainAfterTurn(e, next, async () => {
    const waiting = await readWaitingNudge($, await $.session.id())
    if (waiting !== null) {
      sendDetached($, waiting)
    }
  })

function sendDetached($: EngineInterface, waiting: WaitingNudge): void {
  runDetached(
    $,
    () => sendWaitingNudge($, waiting),
    reason => describeNudgeNotSent({ number: waiting.goalNumber }, reason),
  )
}

/**
 * Sends the nudge `waiting` as a prompt, unless another send took it, and lets it go once the
 * prompt entered or failed. A goal cleared or marked as done since the press is not nudged.
 */
async function sendWaitingNudge($: EngineInterface, waiting: WaitingNudge): Promise<void> {
  const { sessionId } = waiting
  const taken: WaitingNudge = { ...waiting, nudgeId: crypto.randomUUID(), isSending: true }
  const inState = await updateWaitingNudge($, sessionId, nudge =>
    nudge?.nudgeId === waiting.nudgeId && !nudge.isSending ? taken : nudge,
  )
  if (inState?.nudgeId !== taken.nudgeId) {
    return
  }
  try {
    const board = await readBoardToRemind($, sessionId)
    const open = board === undefined ? undefined : openGoalsByIdOf(board)
    const goal = open?.get(waiting.goalId)
    if (open === undefined || goal === undefined || doneMarkOf(goal) !== undefined) {
      return
    }
    const submitted = await submitToSession($, sessionId, { text: describeNudge(open, goal) })
    if (submitted.outcome === PromptOutcome.Dropped) {
      showFailure($, describeNudgeNotSent(goal, submitted.reason))
    }
  } finally {
    await updateWaitingNudge($, sessionId, nudge =>
      nudge?.nudgeId === taken.nudgeId ? null : nudge,
    )
  }
}
