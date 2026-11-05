import type { EngineInterface } from 'claude-code'

import type { UnreadBoard } from '../../types'
import { showFailure } from '../failureToast'
import { Outcome } from './board'
import type { AddRefused, BoardChange, ChangeRefused, Changed, Read } from './board'
import { sessionScope } from './boardScope'
import {
  describeStoreFailure,
  loadBoard,
  saveAttachedTodo,
  saveClearedGoal,
  saveDetachedTodo,
  saveNewGoal,
} from './boardStore'
import type { Failed } from './boardStore'
import { recordBoardSeenAtStart, setLoadedBoard } from './goalState'
import { describeNotRead } from './goalTexts'
import type { TodoEntry } from './todoEntry'

// After every change of a board, the state gets the board read again from the store, through the
// same path as at the start of a session, so the pane shows what the store has.

/** Reads the board of the session `sessionId` from the store, or the reason the store could not. */
export async function readBoardOfSession(
  $: EngineInterface,
  sessionId: string,
): Promise<Read | UnreadBoard> {
  const read = await loadBoard($, sessionScope(sessionId))

  return read.outcome === Outcome.Read
    ? read
    : { outcome: Outcome.Failed, failure: describeStoreFailure(read) }
}

/** Reads the board of the session `sessionId` from the store into the state, and returns it. */
export async function loadBoardIntoState(
  $: EngineInterface,
  sessionId: string,
): Promise<Read | UnreadBoard> {
  const loaded = await readBoardOfSession($, sessionId)
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

/**
 * Reads the board as loadBoardShowingFailure does, when the session `sessionId` begins in this
 * process, and records it as the board seen by its model.
 */
export async function loadBoardAtStart($: EngineInterface, sessionId: string): Promise<void> {
  await recordBoardSeenAtStart($, sessionId, await loadBoardShowingFailure($, sessionId))
}

/**
 * Adds the goal with the text `text` to the board of the session `sessionId`. With
 * `expectedNumber`, the add is refused unless the board in the store gives the goal that number.
 */
export async function addGoalToSession(
  $: EngineInterface,
  sessionId: string,
  text: string,
  expectedNumber?: number,
): Promise<Changed | AddRefused | Failed> {
  const scope = sessionScope(sessionId)
  const added = await saveNewGoal($, scope, text, await $.clock.now(), expectedNumber)
  if (added.outcome === Outcome.Changed) {
    await loadBoardShowingFailure($, sessionId)
  }

  return added
}

/** Clears the goal numbered `number` on the board of the session `sessionId`. */
export async function clearGoalOfSession(
  $: EngineInterface,
  sessionId: string,
  number: number,
): Promise<Changed | ChangeRefused | Failed> {
  const cleared = await saveClearedGoal($, sessionScope(sessionId), number, await $.clock.now())

  return loadBoardAfterChange($, sessionId, cleared)
}

/** Attaches the TODO entry to the goal numbered `goalNumber` of the session `sessionId`. */
export async function attachTodoInSession(
  $: EngineInterface,
  sessionId: string,
  goalNumber: number,
  todo: TodoEntry,
): Promise<BoardChange | Failed> {
  const scope = sessionScope(sessionId)
  const attached = await saveAttachedTodo($, scope, goalNumber, todo, await $.clock.now())

  return loadBoardAfterChange($, sessionId, attached)
}

/** Detaches the TODO entry numbered `todoNumber` from the goal numbered `goalNumber`. */
export async function detachTodoInSession(
  $: EngineInterface,
  sessionId: string,
  goalNumber: number,
  todoNumber: string,
): Promise<BoardChange | Failed> {
  const detached = await saveDetachedTodo($, sessionScope(sessionId), goalNumber, todoNumber)

  return loadBoardAfterChange($, sessionId, detached)
}

/**
 * Reads the board of the session `sessionId` into the state again after `change` of a goal, unless
 * the store failed. A goal that is not open was cleared by another process or never added, so the
 * board is read again after a refusal too.
 */
async function loadBoardAfterChange<Change extends BoardChange | Failed>(
  $: EngineInterface,
  sessionId: string,
  change: Change,
): Promise<Change> {
  if (change.outcome !== Outcome.Failed) {
    await loadBoardShowingFailure($, sessionId)
  }

  return change
}
