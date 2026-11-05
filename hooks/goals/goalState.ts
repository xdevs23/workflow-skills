import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { Board, IdleStretch, SessionBoard, UnreadBoard } from '../../types'
import { isSessionRunning, ofRunningSession, ofSession } from '../sessionBoundState'
import { Outcome, boardWithChangesTakenBack, combinedBoardOf } from './board'
import type { Read } from './board'

// The engine lists the state a module reads and writes from the source of the module, so every
// state reference of the goals is written in this file with its plugin and key as literals.
const sessionBoard = atom({ plugin: 'workflow-skills', key: 'sessionBoard' } as const, null)
const goalToClear = atom({ plugin: 'workflow-skills', key: 'goalToClear' } as const, null)
const isSavingGoal = atom({ plugin: 'workflow-skills', key: 'isSavingGoal' } as const, false)
const seenBoard = atom({ plugin: 'workflow-skills', key: 'seenBoard' } as const, null)
const idleStretch = atom({ plugin: 'workflow-skills', key: 'idleStretch' } as const, null)

/**
 * The board in the state while its session runs, and null otherwise, such as before the session
 * read it or after a switch to another session.
 */
export async function readBoardInState($: EngineInterface): Promise<SessionBoard | null> {
  return ofRunningSession($, await read($, sessionBoard))
}

/**
 * Puts the board read for the session `sessionId` into the state, unless another session runs by
 * now. A board that could not be read replaces only a board that was not read either, so a failed
 * read leaves the last board read on screen.
 */
export async function setLoadedBoard(
  $: EngineInterface,
  sessionId: string,
  loaded: Read | UnreadBoard,
): Promise<void> {
  if (await isSessionRunning($, sessionId)) {
    await update($, sessionBoard, inState => {
      const shown = ofSession(inState, sessionId)

      return loaded.outcome === Outcome.Failed && shown?.outcome === Outcome.Read
        ? shown
        : { sessionId, ...loaded }
    })
  }
}

/** The id of the goal of the running session that needs a yes to its clear, if any. */
export async function readGoalToClear($: EngineInterface): Promise<string | null> {
  return (await ofRunningSession($, await read($, goalToClear)))?.goalId ?? null
}

/** Marks the goal with the id `goalId` of the session `sessionId` as needing a yes to its clear. */
export async function setGoalToClear(
  $: EngineInterface,
  sessionId: string,
  goalId: string,
): Promise<void> {
  if (await isSessionRunning($, sessionId)) {
    await update($, goalToClear, () => ({ sessionId, goalId }))
  }
}

/** Takes back the question to clear the goal with the id `goalId`, while it is still asked. */
export async function dropGoalToClear($: EngineInterface, goalId: string): Promise<void> {
  await update($, goalToClear, inState => (inState?.goalId === goalId ? null : inState))
}

/** Marks a save of the Goals pane as running, and returns false when one was running already. */
export async function startSaving($: EngineInterface): Promise<boolean> {
  let isStarted = false
  await update($, isSavingGoal, isSaving => {
    isStarted = !isSaving

    return true
  })

  return isStarted
}

export async function endSaving($: EngineInterface): Promise<void> {
  await update($, isSavingGoal, () => false)
}

/**
 * Records the board read when the session `sessionId` began in this process as seen by its model:
 * the board of a new session is empty, and the model of a resumed session saw its board before.
 */
export async function recordBoardSeenAtStart(
  $: EngineInterface,
  sessionId: string,
  loaded: Read | UnreadBoard,
): Promise<void> {
  await updateSeenBoard($, sessionId, () =>
    loaded.outcome === Outcome.Read ? loaded.board : null,
  )
}

/** The board last seen by the model of the session `sessionId`, or null when it saw none. */
export async function readSeenBoard($: EngineInterface, sessionId: string): Promise<Board | null> {
  return ofSession(await read($, seenBoard), sessionId)?.board ?? null
}

/**
 * Records `board` as seen by the model of the session `sessionId`, and returns the board it saw
 * before, or null when it saw none. One update does both, so of parallel tool results that read
 * the same board, only one is given the changes.
 */
export async function exchangeSeenBoard(
  $: EngineInterface,
  sessionId: string,
  board: Board,
): Promise<Board | null> {
  let seenBefore: Board | null = null
  await updateSeenBoard($, sessionId, seen => {
    seenBefore = seen

    // Two copies of the board that were read in any order give one open and cleared state.
    return seen === null ? board : combinedBoardOf(seen, board)
  })

  return seenBefore
}

/**
 * Takes back the goals added or cleared between `before` and `after` from the board seen by the
 * model of the session `sessionId`, after the note on them was not sent to the model. Changes
 * recorded since stay recorded.
 */
export async function restoreSeenBoard(
  $: EngineInterface,
  sessionId: string,
  before: Board | null,
  after: Board,
): Promise<void> {
  await updateSeenBoard($, sessionId, seen =>
    before === null || seen === null ? before : boardWithChangesTakenBack(seen, before, after),
  )
}

/**
 * Replaces the board seen by the model of the session `sessionId` with what `change` makes of it,
 * unless another session runs by now. `change` is called with null when the model saw no board.
 */
async function updateSeenBoard(
  $: EngineInterface,
  sessionId: string,
  change: (seen: Board | null) => Board | null,
): Promise<void> {
  if (await isSessionRunning($, sessionId)) {
    await update($, seenBoard, inState => ({
      sessionId,
      board: change(ofSession(inState, sessionId)?.board ?? null),
    }))
  }
}

/** The idle stretch of the main conversation of the session `sessionId`, if it has one. */
export async function readIdleStretch(
  $: EngineInterface,
  sessionId: string,
): Promise<IdleStretch | null> {
  return ofSession(await read($, idleStretch), sessionId)
}

/**
 * Replaces the idle stretch of the session `sessionId` with what `change` makes of it, unless
 * another session runs by now, and returns the stretch of that session in the state after it.
 * `change` is called with null when the session has no stretch.
 */
export async function updateIdleStretch(
  $: EngineInterface,
  sessionId: string,
  change: (stretch: IdleStretch | null) => IdleStretch | null,
): Promise<IdleStretch | null> {
  if (!(await isSessionRunning($, sessionId))) {
    return null
  }
  const inState = await update($, idleStretch, stretch => change(ofSession(stretch, sessionId)))

  return ofSession(inState, sessionId)
}
