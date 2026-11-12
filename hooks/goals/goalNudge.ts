import type { EngineInterface, MatchedHook } from 'claude-code'

import type { Goal, NudgeSend, NudgedGoal, NudgedGoals, WaitingNudges } from '../../types'
import type { EveryEvent } from '../everyEvent'
import { showFailure } from '../failureToast'
import { PromptOutcome, submitToSession } from '../sendToModel'
import { readIsTurnRunning } from '../sessionState'
import { runDetached, waitAgainAfterTurn } from '../timedWork'
import { openGoalsByIdOf } from './board'
import type { OpenGoals } from './dependency'
import { doneMarkOf } from './doneMark'
import { readBoardToRemind } from './goalReminderBoard'
import { describeNudge } from './goalReminders'
import type { GoalsToNudge } from './goalReminders'
import { updateWaitingNudges } from './goalState'
import { describeAlreadyMarkedDone, describeNudgeNotSent, describeNudgeWaiting } from './goalTexts'

// A prompt submitted by the plugin while a turn runs enters only once the turn ends, with the text
// written at the submit. A goal pressed while a turn or a send runs therefore waits. The end of the
// turn sends every waiting goal in one prompt, built from the board at that moment. A send whose
// prompt did not enter starts no turn, so it sends the goals that waited meanwhile itself. A goal
// pressed again while it waits or is sent is sent once.

/**
 * Adds the open goal `goal` to the waiting nudges of the session `sessionId`, and sends them at
 * once while neither a turn nor a send runs. Otherwise a toast shows that the nudge waits.
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
  const pressed: NudgedGoal = { id: goal.id, number: goal.number }
  const nudges = await updateWaitingNudges($, sessionId, current =>
    withPressed(current ?? { sessionId, waiting: [], sending: null }, pressed),
  )
  if (nudges === null) {
    return
  }
  if (nudges.sending !== null || (await readIsTurnRunning($))) {
    $.ui.toast(describeNudgeWaiting(goal))
    return
  }
  await sendWaitingNudges($, sessionId)
}

export const sendNudgesAfterTurn: MatchedHook<'turn.complete', EveryEvent> = ($, e, next) =>
  waitAgainAfterTurn(e, next, async () => sendWaitingNudges($, await $.session.id()))

function withPressed(nudges: WaitingNudges, pressed: NudgedGoal): WaitingNudges {
  const listed = [...nudges.waiting, ...(nudges.sending?.goals ?? [])]

  return listed.some(goal => goal.id === pressed.id)
    ? nudges
    : { ...nudges, waiting: [...nudges.waiting, pressed] }
}

/**
 * Takes the waiting goals of the session `sessionId` into a send, unless a send runs or no goal
 * waits, and submits them without waiting for the prompt to enter. A failure of the send names
 * the goals it took.
 */
async function sendWaitingNudges($: EngineInterface, sessionId: string): Promise<void> {
  const send = await takeWaitingGoals($, sessionId)
  if (send !== undefined) {
    runDetached(
      $,
      () => submitSend($, sessionId, send),
      reason => describeNudgeNotSent(send.goals, reason),
    )
  }
}

async function takeWaitingGoals(
  $: EngineInterface,
  sessionId: string,
): Promise<NudgeSend | undefined> {
  const sendId = crypto.randomUUID()
  const nudges = await updateWaitingNudges($, sessionId, current => {
    const [first, ...rest] = current?.waiting ?? []
    if (current === null || current.sending !== null || first === undefined) {
      return current
    }

    return { ...current, waiting: [], sending: { sendId, goals: [first, ...rest] } }
  })

  return nudges?.sending?.sendId === sendId ? nudges.sending : undefined
}

/**
 * Submits the goals of `send` as one prompt and ends the send. A send whose prompt did not enter
 * starts no turn whose end would send the goals pressed during it, so they are sent at once.
 */
async function submitSend($: EngineInterface, sessionId: string, send: NudgeSend): Promise<void> {
  let hasEntered = false
  try {
    hasEntered = await submitNudgePrompt($, sessionId, send.goals)
  } finally {
    const nudges = await updateWaitingNudges($, sessionId, current =>
      current?.sending?.sendId === send.sendId ? withoutSend(current) : current,
    )
    if (!hasEntered && nudges !== null && !(await readIsTurnRunning($))) {
      await sendWaitingNudges($, sessionId)
    }
  }
}

function withoutSend(nudges: WaitingNudges): WaitingNudges | null {
  return nudges.waiting.length === 0 ? null : { ...nudges, sending: null }
}

/**
 * Submits the prompt for the goals of `nudged` that are still open and not marked as done, and
 * returns whether it entered the session.
 */
async function submitNudgePrompt(
  $: EngineInterface,
  sessionId: string,
  nudged: NudgedGoals,
): Promise<boolean> {
  const board = await readBoardToRemind($, sessionId)
  if (board === undefined) {
    return false
  }
  const open = openGoalsByIdOf(board)
  const goals = goalsToNudgeOf(open, nudged)
  if (goals === undefined) {
    return false
  }
  const submitted = await submitToSession($, sessionId, { text: describeNudge(open, goals) })
  if (submitted.outcome === PromptOutcome.Dropped) {
    showFailure($, describeNudgeNotSent(goals, submitted.reason))
  }

  return submitted.outcome === PromptOutcome.Entered
}

/** The goals of `nudged` still open in `open` and not marked as done, or undefined for none. */
function goalsToNudgeOf(open: OpenGoals, nudged: NudgedGoals): GoalsToNudge | undefined {
  const [first, ...rest] = nudged.flatMap(({ id }) => {
    const goal = open.get(id)

    return goal === undefined || doneMarkOf(goal) !== undefined ? [] : [goal]
  })

  return first === undefined ? undefined : [first, ...rest]
}
