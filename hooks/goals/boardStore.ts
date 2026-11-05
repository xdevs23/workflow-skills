import type { AttachedTodo, Board, Goal } from '../../types'
import {
  describeRefusedRead,
  describeRefusedWrite,
  describeUnreadableRecord,
  writeRetryingWhileLocked,
} from '../pluginStore'
import type { StoreEngine } from '../pluginStore'
import {
  Outcome,
  addGoal,
  attachTodo,
  clearGoal,
  detachTodo,
  isNumberTaken,
  nextGoalNumberOf,
  settledBoardOf,
} from './board'
import type { AddRefused, BoardChange, ChangeRefused, Changed, Read } from './board'
import {
  UnreadableRecordError,
  clearanceRecordOf,
  goalRecordOf,
  readBoard,
  todoKeyOf,
  todoRecordOf,
} from './boardRecord'
import type { BoardRecord } from './boardRecord'
import { boardPrefixOf } from './boardScope'
import type { BoardScope } from './boardScope'

// The store does not offer compare-and-set. Changes made at once by several processes do not
// overwrite each other, since every change writes only the record of its own part of the board: a
// new goal, the clearance of a goal, or one TODO entry of a goal. Two changes write one key only
// when both change the same part, such as one TODO number of one goal, and the later write is then
// the newer state of that part.

/** Why the store could not read or change a board. The stored records are left as they were. */
export enum StoreFailure {
  NotRead = 'not-read',
  Unreadable = 'unreadable',
  NotSaved = 'not-saved',
}

export type Failed = { outcome: Outcome.Failed } & (
  | { failure: StoreFailure.NotRead; key: string; cause: Error }
  | { failure: StoreFailure.Unreadable; key: string }
  | { failure: StoreFailure.NotSaved; key: string; cause: Error }
)

/** A failed call on the store, passed up to the change that made it. */
class StoreCallError extends Error {
  readonly failed: Failed

  constructor(failed: Failed) {
    super(failed.failure)
    this.failed = failed
  }
}

export function loadBoard($: StoreEngine, scope: BoardScope): Promise<Read | Failed> {
  return returningFailure(async () => ({
    outcome: Outcome.Read,
    board: await readSettledBoard($, scope),
  }))
}

/**
 * Stores a new goal under a number that is free on the board. The store does not offer
 * compare-and-set, so the number is checked after the write: of two goals added at once with one
 * number, the goal whose key was set later is written again under the next free number.
 */
export function saveNewGoal(
  $: StoreEngine,
  scope: BoardScope,
  text: string,
  addedAt: number,
): Promise<Changed | AddRefused | Failed> {
  return returningFailure(async () => {
    const board = await readSettledBoard($, scope)
    const added = addGoal(board, { id: crypto.randomUUID(), text }, addedAt)

    return added.outcome === Outcome.Changed ? saveUnderFreeNumber($, scope, added.goal) : added
  })
}

export function saveClearedGoal(
  $: StoreEngine,
  scope: BoardScope,
  number: number,
  clearedAt: number,
): Promise<Changed | ChangeRefused | Failed> {
  return changeBoard(
    $,
    scope,
    board => clearGoal(board, number, clearedAt),
    goal => writeRecord($, clearanceRecordOf(scope, goal, clearedAt)),
  )
}

export function saveAttachedTodo(
  $: StoreEngine,
  scope: BoardScope,
  goalNumber: number,
  todo: Pick<AttachedTodo, 'number' | 'title'>,
  attachedAt: number,
): Promise<BoardChange | Failed> {
  return changeBoard(
    $,
    scope,
    board => attachTodo(board, goalNumber, todo, attachedAt),
    goal => writeRecord($, todoRecordOf(scope, goal, { ...todo, attachedAt })),
  )
}

export function saveDetachedTodo(
  $: StoreEngine,
  scope: BoardScope,
  goalNumber: number,
  todoNumber: string,
): Promise<BoardChange | Failed> {
  return changeBoard(
    $,
    scope,
    board => detachTodo(board, goalNumber, todoNumber),
    goal => {
      const key = todoKeyOf(scope, goal, todoNumber)

      return writeToStore($, key, () => $.store.delete(key))
    },
  )
}

export function describeStoreFailure(failed: Failed): string {
  switch (failed.failure) {
    case StoreFailure.NotRead:
      return describeRefusedRead(failed.key, failed.cause)
    case StoreFailure.Unreadable:
      return describeUnreadableRecord(failed.key)
    case StoreFailure.NotSaved:
      return describeRefusedWrite(failed.key, failed.cause)
  }
}

/**
 * Reads the board of the scope, applies `change` to it, and when the board changed, writes the
 * goal changed by it with `save`.
 */
function changeBoard<Change extends BoardChange>(
  $: StoreEngine,
  scope: BoardScope,
  change: (board: Board) => Change,
  save: (goal: Goal) => Promise<void>,
): Promise<Change | Failed> {
  return returningFailure(async () => {
    const changed = change(await readSettledBoard($, scope))
    if (changed.outcome === Outcome.Changed) {
      await save(changed.goal)
    }

    return changed
  })
}

async function saveUnderFreeNumber(
  $: StoreEngine,
  scope: BoardScope,
  added: Goal,
): Promise<Changed> {
  let goal = added
  for (;;) {
    await writeRecord($, goalRecordOf(scope, goal))
    const board = await readStoredBoard($, scope)
    if (!isNumberTaken(goal, board)) {
      return { outcome: Outcome.Changed, board: settledBoardOf(board), goal }
    }
    goal = { ...goal, number: nextGoalNumberOf(board) }
  }
}

async function readSettledBoard($: StoreEngine, scope: BoardScope): Promise<Board> {
  return settledBoardOf(await readStoredBoard($, scope))
}

async function readStoredBoard($: StoreEngine, scope: BoardScope): Promise<Board> {
  const prefix = boardPrefixOf(scope)
  const keys = await callStore(StoreFailure.NotRead, prefix, () => $.store.keys())
  const entries = await Promise.all(
    keys
      .filter(key => key.startsWith(prefix))
      .map(async key => ({
        key,
        value: await callStore(StoreFailure.NotRead, key, () => $.store.get(key)),
      })),
  )

  // A record deleted after the keys were listed is left out.
  return readBoard(
    scope,
    entries.filter(entry => entry.value !== undefined),
  )
}

function writeRecord($: StoreEngine, record: BoardRecord): Promise<void> {
  return writeToStore($, record.key, () => $.store.set(record.key, record.value))
}

function writeToStore($: StoreEngine, key: string, write: () => Promise<void>): Promise<void> {
  return callStore(StoreFailure.NotSaved, key, () => writeRetryingWhileLocked($, key, write))
}

/** Runs the call `call` on the store, and fails with the failure of the store under `key`. */
async function callStore<T>(
  failure: StoreFailure.NotRead | StoreFailure.NotSaved,
  key: string,
  call: () => Promise<T>,
): Promise<T> {
  try {
    return await call()
  } catch (error) {
    if (!(error instanceof Error)) {
      throw error
    }
    throw new StoreCallError({ outcome: Outcome.Failed, failure, key, cause: error })
  }
}

/** Runs `work`, and returns the failure of the store or of a stored record that stopped it. */
async function returningFailure<T>(work: () => Promise<T>): Promise<T | Failed> {
  try {
    return await work()
  } catch (error) {
    if (error instanceof StoreCallError) {
      return error.failed
    }
    if (error instanceof UnreadableRecordError) {
      return { outcome: Outcome.Failed, failure: StoreFailure.Unreadable, key: error.key }
    }
    throw error
  }
}
