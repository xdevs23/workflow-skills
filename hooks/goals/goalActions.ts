import type { EngineInterface } from 'claude-code'

import type { UnreadBoard } from '../../types'
import { showFailure } from '../screenWork'
import { Outcome } from './board'
import type { Changed, Read, Refused } from './board'
import { sessionScope } from './boardScope'
import { describeStoreFailure, loadBoard, saveClearedGoal, saveNewGoal } from './boardStore'
import type { Failed } from './boardStore'
import { setLoadedBoard } from './goalState'
import { describeNotRead } from './goalTexts'

// After every change of a board, the state gets the board read again from the store, through the
// same path as at the start of a session, so the pane shows what the store has.

/** Reads the board of the session `sessionId` from the store into the state, and returns it. */
export async function loadBoardIntoState(
  $: EngineInterface,
  sessionId: string,
): Promise<Read | UnreadBoard> {
  const read = await loadBoard($, sessionScope(sessionId))
  const loaded: Read | UnreadBoard =
    read.outcome === Outcome.Read
      ? read
      : { outcome: Outcome.Failed, failure: describeStoreFailure(read) }
  await setLoadedBoard($, sessionId, loaded)

  return loaded
}

/** Reads the board as loadBoardIntoState does, and shows a board not read in a toast. */
export async function loadBoardShowingFailure(
  $: EngineInterface,
  sessionId: string,
): Promise<Read | UnreadBoard> {
  const loaded = await loadBoardIntoState($, sessionId)
  if (loaded.outcome === Outcome.Failed) {
    showFailure($, describeNotRead(loaded.failure))
  }

  return loaded
}

export async function addGoalToSession(
  $: EngineInterface,
  sessionId: string,
  text: string,
): Promise<Changed | Refused | Failed> {
  const added = await saveNewGoal($, sessionScope(sessionId), text, await $.clock.now())
  if (added.outcome === Outcome.Changed) {
    await loadBoardShowingFailure($, sessionId)
  }

  return added
}

/**
 * Clears the goal numbered `number` on the board of the session `sessionId`. A goal that is not
 * open was cleared by another process or never added, so the board is read again after a refusal
 * too.
 */
export async function clearGoalOfSession(
  $: EngineInterface,
  sessionId: string,
  number: number,
): Promise<Changed | Refused | Failed> {
  const cleared = await saveClearedGoal($, sessionScope(sessionId), number, await $.clock.now())
  if (cleared.outcome !== Outcome.Failed) {
    await loadBoardShowingFailure($, sessionId)
  }

  return cleared
}
