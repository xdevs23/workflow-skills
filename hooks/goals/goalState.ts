import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { SessionBoard, UnreadBoard } from '../../types'
import { isSessionRunning, ofRunningSession, ofSession } from '../sessionBoundState'
import { Outcome } from './board'
import type { Read } from './board'

// The engine lists the state a module reads and writes from the source of the module, so every
// state reference of the goals is written in this file with its plugin and key as literals.
const sessionBoard = atom({ plugin: 'workflow-skills', key: 'sessionBoard' } as const, null)
const goalToClear = atom({ plugin: 'workflow-skills', key: 'goalToClear' } as const, null)
const isSavingGoal = atom({ plugin: 'workflow-skills', key: 'isSavingGoal' } as const, false)

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
