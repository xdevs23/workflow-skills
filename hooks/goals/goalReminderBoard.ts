import type { EngineInterface } from 'claude-code'

import type { Board } from '../../types'
import { showFailure } from '../failureToast'
import { Outcome } from './board'
import { readBoardOfSession } from './goalActions'
import { describeGoalChanges, describeReminderNotRead } from './goalReminders'
import { exchangeSeenBoard } from './goalState'

/** The texts that list the open goals to the model, and the board the model saw before them. */
export type GoalList = { texts: string[]; seenBefore: Board | null }

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
 * Records `board` as seen by the model of the session `sessionId`, and returns the open goals on it
 * as `describeList` writes them, followed by the note on the goals added or cleared since the model
 * saw the board before. The list names no cleared goal, so the note goes with it.
 */
export async function listOpenGoals(
  $: EngineInterface,
  sessionId: string,
  board: Board,
  describeList: (board: Board) => string | undefined,
): Promise<GoalList> {
  const seenBefore = await exchangeSeenBoard($, sessionId, board)
  const changes = seenBefore === null ? undefined : describeGoalChanges(seenBefore, board)
  const texts = [describeList(board), changes].filter(text => text !== undefined)

  return { texts, seenBefore }
}
