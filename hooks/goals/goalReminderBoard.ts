import type { EngineInterface } from 'claude-code'

import type { Board } from '../../types'
import { showFailure } from '../failureToast'
import { Outcome } from './board'
import { readBoardOfSession } from './goalActions'
import { describeOpenGoalsSent, describeReminderNotRead } from './goalReminders'
import type { GoalsSent } from './goalReminders'
import { exchangeSeenBoard } from './goalState'
import { withGoalsNotExhaustive } from './goalToolTexts'

/**
 * The text that lists the open goals to the model with its transcript line, unless there was
 * nothing to send, and the board the model saw before it.
 */
export type GoalList = { sent: GoalsSent | undefined; seenBefore: Board | null }

/**
 * Reads the board of the session `sessionId` from the store for a reminder. A board that cannot be
 * read is left out, and the failure shows in a toast.
 */
export async function readBoardToRemind(
  $: EngineInterface,
  sessionId: string,
): Promise<Board | undefined> {
  const read = await readBoardOfSession($, sessionId)
  if (read.outcome === Outcome.Read) {
    return read.board
  }
  showFailure($, describeReminderNotRead(read.failure))

  return undefined
}

/**
 * Records `board` as seen by the model running the session `sessionId`, and returns the open goals
 * on it as `describeOpenGoalsSent` writes them with `describeList`, ended by
 * `withGoalsNotExhaustive`.
 */
export async function listOpenGoals(
  $: EngineInterface,
  sessionId: string,
  board: Board,
  describeList: (board: Board) => string | undefined,
): Promise<GoalList> {
  const seenBefore = await exchangeSeenBoard($, sessionId, board)
  const sent = describeOpenGoalsSent(board, seenBefore, describeList)
  if (sent === undefined) {
    return { sent, seenBefore }
  }

  return { sent: { ...sent, text: withGoalsNotExhaustive(board, sent.text) }, seenBefore }
}
