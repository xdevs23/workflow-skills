import type { EngineInterface, MatchedHook } from 'claude-code'

import type { Board, IdleStretch } from '../../types'
import { isMainConversation } from '../conversation'
import type { EveryEvent } from '../register'
import { PromptOutcome, submitToSession } from '../sendToModel'
import { runAfter } from '../timedWork'
import { openGoalsOf } from './board'
import { listOpenGoals, readBoardToRemind } from './goalReminderBoard'
import { describeIdleReminderFailed, describeOpenGoalsAfterIdle } from './goalReminders'
import { readIdleStretch, restoreSeenBoard, updateIdleStretch } from './goalState'

/**
 * How long the main conversation is idle before the open goals are sent again: a product choice.
 */
const IDLE_MINUTES = 30

const MILLISECONDS_PER_MINUTE = 60_000

/** Where the main conversation of a session stands between two of its turns. */
export enum IdlePhase {
  /** A turn runs, and its end starts the idle minutes. */
  Running = 'running',
  /** The idle minutes run after the last turn. */
  Waiting = 'waiting',
  /**
   * The open goals were sent after the idle minutes, and the end of the turn started by them
   * starts no new idle minutes.
   */
  Reminded = 'reminded',
}

export const endIdleStretch: MatchedHook<'turn.start', EveryEvent> = async ($, e, next) => {
  if (isMainConversation(e)) {
    const sessionId = await $.session.id()
    await updateIdleStretch($, sessionId, stretch =>
      stretch?.phase === IdlePhase.Reminded ? stretch : newStretch(sessionId, IdlePhase.Running),
    )
  }

  return next(e)
}

export const waitAfterTurn: MatchedHook<'turn.complete', EveryEvent> = async ($, e, next) => {
  const completed = await next(e)
  if (isMainConversation(e)) {
    const waiting = newStretch(await $.session.id(), IdlePhase.Waiting)
    const inState = await updateIdleStretch($, waiting.sessionId, stretch =>
      stretch?.phase === IdlePhase.Reminded ? null : waiting,
    )
    if (isSameStretch(inState, waiting)) {
      waitForIdleMinutes($, waiting)
    }
  }

  return completed
}

/** Sends the open goals once the idle minutes of the stretch `waiting` passed. */
function waitForIdleMinutes($: EngineInterface, waiting: IdleStretch): void {
  runAfter(
    $,
    IDLE_MINUTES * MILLISECONDS_PER_MINUTE,
    () => remindAfterIdle($, waiting),
    describeIdleReminderFailed,
  )
}

/** Sends the open goals as a prompt that starts a turn, while the stretch `waiting` lasts. */
async function remindAfterIdle($: EngineInterface, waiting: IdleStretch): Promise<void> {
  const { sessionId } = waiting
  if (!isSameStretch(await readIdleStretch($, sessionId), waiting)) {
    return
  }
  const board = await readBoardToRemind($, sessionId)
  if (board === undefined || openGoalsOf(board).length === 0) {
    return
  }
  const reminded: IdleStretch = { ...waiting, phase: IdlePhase.Reminded }
  // A turn that started during the read ended the stretch.
  if (!(await replaceStretch($, waiting, reminded))) {
    return
  }
  // The prompt shows in the transcript itself, so the transcript line of `sent` is not shown.
  const { sent, seenBefore } = await listOpenGoals($, sessionId, board, describeOpenGoalsAfterIdle)
  const submitted =
    sent === undefined
      ? undefined
      : await submitToSession($, sessionId, { text: sent.text }).catch(async (error: unknown) => {
          await waitAgain($, reminded, seenBefore, board)
          throw error
        })
  if (submitted?.outcome !== PromptOutcome.Entered) {
    await waitAgain($, reminded, seenBefore, board)
  }
}

/**
 * Takes back what the stretch `reminded` recorded as seen by the model when it listed `board`,
 * since its prompt was not sent, and starts the idle minutes again while `reminded` is the stretch
 * in the state.
 */
async function waitAgain(
  $: EngineInterface,
  reminded: IdleStretch,
  seenBefore: Board | null,
  board: Board,
): Promise<void> {
  await restoreSeenBoard($, reminded.sessionId, seenBefore, board)
  const again = newStretch(reminded.sessionId, IdlePhase.Waiting)
  if (await replaceStretch($, reminded, again)) {
    waitForIdleMinutes($, again)
  }
}

/**
 * Replaces the stretch `current` with `next` while `current` is the stretch of its session in the
 * state, and returns whether it did.
 */
async function replaceStretch(
  $: EngineInterface,
  current: IdleStretch,
  next: IdleStretch,
): Promise<boolean> {
  const inState = await updateIdleStretch($, current.sessionId, stretch =>
    isSameStretch(stretch, current) ? next : stretch,
  )

  return isSameStretch(inState, next)
}

function newStretch(sessionId: string, phase: IdlePhase): IdleStretch {
  return { sessionId, stretchId: crypto.randomUUID(), phase }
}

function isSameStretch(stretch: IdleStretch | null, other: IdleStretch): boolean {
  return stretch?.stretchId === other.stretchId && stretch.phase === other.phase
}
