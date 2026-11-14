import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type {
  Board,
  GoalInPane,
  IdleStretch,
  SeenBoard,
  SessionBoard,
  UnreadBoard,
  WaitingNudges,
} from '../../types'
import { NEW_PANE_RECORD } from '../paneWorker'
import type { StoredPane } from '../paneWorker'
import {
  keepReadOverFailure,
  ofRunningSession,
  ofSession,
  updateOfSession,
} from '../sessionBoundState'
import { Outcome } from './board'
import type { Read } from './board'
import { boardWithChangesTakenBack } from './boardChanges'
import { combinedBoardOf } from './boardMerge'
import type { GoalPaneAction, GoalSaveResult } from './goalPaneMessages'

// The engine lists the state a module reads and writes from the source of the module, so every
// state reference of the goals is written in this file with its plugin and key as literals.
const sessionBoard = atom({ plugin: 'workflow-skills', key: 'sessionBoard' } as const, null)
const goalsPane = atom({ plugin: 'workflow-skills', key: 'goalsPane' } as const, NEW_PANE_RECORD, {
  shape: 'saves-by-action-id',
})
const goalsPaneTyped = atom({ plugin: 'workflow-skills', key: 'goalsPaneTyped' } as const, null)
const seenBoard = atom({ plugin: 'workflow-skills', key: 'seenBoard' } as const, null)
const idleStretch = atom({ plugin: 'workflow-skills', key: 'idleStretch' } as const, null)
const waitingNudges = atom({ plugin: 'workflow-skills', key: 'waitingNudges' } as const, null)

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
  await updateOfSession<SessionBoard>(
    $,
    sessionId,
    shown => keepReadOverFailure(shown, { sessionId, ...loaded }, Outcome.Read),
    changeInState => update($, sessionBoard, changeInState),
  )
}

/** The Goals pane as the hooks module stores it. */
export function storedGoalsPane(
  $: EngineInterface,
): StoredPane<GoalInPane | null, GoalPaneAction, GoalSaveResult> {
  return {
    read: () => read($, goalsPane),
    update: change => update($, goalsPane, change),
    readTyped: () => read($, goalsPaneTyped),
    updateTyped: change => update($, goalsPaneTyped, change),
  }
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

    // Two copies of the board that were read in any order give one open, edited, marked and
    // cleared state.
    return seen === null ? board : combinedBoardOf(seen, board)
  })

  return seenBefore
}

/**
 * Takes back the goals added, edited, marked, prioritized, made dependent or cleared between
 * `before` and `after` from the board seen by the model in the session `sessionId`, after the note
 * on them was not sent to the model. Changes recorded since are not taken back.
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
  await updateOfSession<SeenBoard>(
    $,
    sessionId,
    seen => ({ sessionId, board: change(seen?.board ?? null) }),
    changeInState => update($, seenBoard, changeInState),
  )
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
export function updateIdleStretch(
  $: EngineInterface,
  sessionId: string,
  change: (stretch: IdleStretch | null) => IdleStretch | null,
): Promise<IdleStretch | null> {
  return updateOfSession($, sessionId, change, changeInState =>
    update($, idleStretch, changeInState),
  )
}

/**
 * Replaces the waiting nudges of the session `sessionId` with what `change` makes of them, unless
 * another session runs by now, and returns the nudges of that session in the state after it.
 */
export function updateWaitingNudges(
  $: EngineInterface,
  sessionId: string,
  change: (nudges: WaitingNudges | null) => WaitingNudges | null,
): Promise<WaitingNudges | null> {
  return updateOfSession($, sessionId, change, changeInState =>
    update($, waitingNudges, changeInState),
  )
}
