import type { AttachedTodo, Board, Goal } from '../../types'
import {
  StoreCall,
  callStore,
  describeRefusedRead,
  describeRefusedWrite,
  describeUnreadableRecord,
  readEntriesUnder,
  returningStoreFailure,
  writeRetryingWhileLocked,
} from '../pluginStore'
import type { StoreEngine } from '../pluginStore'
import {
  Outcome,
  addGoal,
  attachTodo,
  clearGoal,
  detachTodo,
  editGoal,
  isNumberTaken,
  markGoalDone,
  nextGoalNumberOf,
  openGoalsByIdOf,
  removeDoneMark,
  setGoalDependency,
  setGoalPriority,
  settledBoardOf,
} from './board'
import type {
  AddRefused,
  BoardChange,
  ChangeRefused,
  Changed,
  DependentGoal,
  EditRefused,
  GoalEdit,
  LoopRefused,
  MarkRefused,
  NotChanged,
  NotOpenRefused,
  PrioritizedGoal,
  Read,
  Unchanged,
  UnmarkRefused,
} from './board'
import { goalsUnmarkedForDependency } from './dependency'
import type { MarkRemovalAsked, MarkedGoal, UnmarkedGoal } from './doneMark'
import {
  UnreadableRecordError,
  clearanceRecordOf,
  dependencyRecordOf,
  doneMarkRecordOf,
  goalRecordOf,
  markRemovalRecordOf,
  priorityRecordOf,
  readBoard,
  textRecordOf,
  todoKeyOf,
  todoRecordOf,
} from './boardRecord'
import type { BoardRecord } from './boardRecord'
import { boardPrefixOf } from './boardScope'
import type { BoardScope } from './boardScope'
import type { Priority } from './priority'

// The store does not offer compare-and-set. Changes made at once by several processes do not
// overwrite each other, since every change writes only the record of its own part of the board: a
// new goal, the text of a goal, the clearance of a goal, the done mark of a goal, the removal of a
// done mark, the priority of a goal, the dependency of a goal, or one TODO entry of a goal. Two
// changes write one key only when both change the same part, such as one TODO number of one goal,
// and the later write is then the newer state of that part. A removal contains the time of the mark
// it removes, so a mark set while the removal is written is still set afterwards.

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

/** The failure of the board for each failed call on the store. */
const FAILURE_OF_CALL: Record<StoreCall, StoreFailure.NotRead | StoreFailure.NotSaved> = {
  [StoreCall.List]: StoreFailure.NotRead,
  [StoreCall.Read]: StoreFailure.NotRead,
  [StoreCall.Write]: StoreFailure.NotSaved,
}

export function loadBoard($: StoreEngine, scope: BoardScope): Promise<Read | Failed> {
  return returningFailure(async () => ({
    outcome: Outcome.Read,
    board: await readSettledBoard($, scope),
  }))
}

/**
 * Stores a new goal under a number that is free on the board, refused as addGoal refuses it. The
 * store does not offer compare-and-set, so the number is checked after the write: of two goals
 * added at once with one number, the goal whose key was set later is written again under the next
 * free number.
 */
export function saveNewGoal(
  $: StoreEngine,
  scope: BoardScope,
  text: string,
  addedAt: number,
  expectedNumber?: number,
): Promise<Changed | AddRefused | Failed> {
  return returningFailure(async () => {
    const board = await readSettledBoard($, scope)
    const added = addGoal(board, { id: crypto.randomUUID(), text }, addedAt, expectedNumber)

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

export function saveEditedGoal(
  $: StoreEngine,
  scope: BoardScope,
  number: number,
  edit: GoalEdit,
  editedAt: number,
): Promise<Changed | Unchanged | EditRefused | Failed> {
  return changeBoard(
    $,
    scope,
    board => editGoal(board, number, edit, editedAt),
    goal => writeRecord($, textRecordOf(scope, goal, editedAt)),
  )
}

/**
 * Marks the goal as done as markGoalDone does, and writes the mark. A dependency can lose its mark,
 * or be set on the goal, while the mark is written, so the board is read back after the write, and
 * every mark it leaves waiting for a dependency is removed.
 */
export function saveDoneMark(
  $: StoreEngine,
  scope: BoardScope,
  number: number,
  evidence: string,
  markedAt: number,
): Promise<Changed<MarkedGoal> | Unchanged | MarkRefused | Failed> {
  return changeBoard(
    $,
    scope,
    board => markGoalDone(board, number, evidence, markedAt),
    async goal => {
      await writeRecord($, doneMarkRecordOf(scope, goal))
      const stored = openGoalsByIdOf(await readSettledBoard($, scope))
      await writeMarkRemovals($, scope, goalsUnmarkedForDependency(stored, markedAt))
    },
  )
}

/** Removes the done mark as removeDoneMark does, and writes the removal. */
export function saveRemovedDoneMark(
  $: StoreEngine,
  scope: BoardScope,
  number: number,
  removal: MarkRemovalAsked & { removedAt: number },
  markedAt?: number,
): Promise<Changed<UnmarkedGoal> | UnmarkRefused | Failed> {
  return changeBoard(
    $,
    scope,
    board => removeDoneMark(board, number, removal, markedAt),
    goal => writeRecord($, markRemovalRecordOf(scope, goal)),
  )
}

/** Sets or removes the priority as setGoalPriority does, and writes the priority. */
export function saveGoalPriority(
  $: StoreEngine,
  scope: BoardScope,
  number: number,
  priority: Priority | undefined,
  setAt: number,
): Promise<Changed<PrioritizedGoal> | Unchanged | NotOpenRefused | Failed> {
  return changeBoard(
    $,
    scope,
    board => setGoalPriority(board, number, priority, setAt),
    goal => writeRecord($, priorityRecordOf(scope, goal)),
  )
}

/** Sets or removes the dependency as setGoalDependency does, and writes the dependency. */
export function saveGoalDependency(
  $: StoreEngine,
  scope: BoardScope,
  number: number,
  dependsOn: number | undefined,
  setAt: number,
): Promise<Changed<DependentGoal> | Unchanged | NotOpenRefused | LoopRefused | Failed> {
  return changeBoard(
    $,
    scope,
    board => setGoalDependency(board, number, dependsOn, setAt),
    goal => writeRecord($, dependencyRecordOf(scope, goal)),
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
 * removals of the done marks removed with the change, and then the goal changed by it with `save`.
 * A change whose save failed is not stored, so a retry finds the same marks to remove again, and a
 * goal is never stored with a mark that the change removed.
 */
function changeBoard<Other extends NotChanged, Changing extends Goal = Goal>(
  $: StoreEngine,
  scope: BoardScope,
  change: (board: Board) => Changed<Changing> | Other,
  save: (goal: Changing) => Promise<void>,
): Promise<Changed<Changing> | Other | Failed> {
  return returningFailure(async () => {
    const changed = change(await readSettledBoard($, scope))
    if (changed.outcome === Outcome.Changed) {
      await writeMarkRemovals($, scope, changed.unmarked)
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
      return { outcome: Outcome.Changed, board: settledBoardOf(board), goal, unmarked: [] }
    }
    goal = { ...goal, number: nextGoalNumberOf(board) }
  }
}

async function readSettledBoard($: StoreEngine, scope: BoardScope): Promise<Board> {
  return settledBoardOf(await readStoredBoard($, scope))
}

async function readStoredBoard($: StoreEngine, scope: BoardScope): Promise<Board> {
  return readBoard(scope, await readEntriesUnder($, boardPrefixOf(scope)))
}

async function writeMarkRemovals(
  $: StoreEngine,
  scope: BoardScope,
  unmarked: readonly UnmarkedGoal[],
): Promise<void> {
  await Promise.all(unmarked.map(goal => writeRecord($, markRemovalRecordOf(scope, goal))))
}

function writeRecord($: StoreEngine, record: BoardRecord): Promise<void> {
  return writeToStore($, record.key, () => $.store.set(record.key, record.value))
}

function writeToStore($: StoreEngine, key: string, write: () => Promise<void>): Promise<void> {
  return callStore(StoreCall.Write, key, () => writeRetryingWhileLocked($, key, write))
}

/** Runs `work`, and returns the failure of the store or of a stored record that stopped it. */
async function returningFailure<T>(work: () => Promise<T>): Promise<T | Failed> {
  try {
    return await returningStoreFailure(work, ({ call, key, cause }) => ({
      outcome: Outcome.Failed,
      failure: FAILURE_OF_CALL[call],
      key,
      cause,
    }))
  } catch (error) {
    if (error instanceof UnreadableRecordError) {
      return { outcome: Outcome.Failed, failure: StoreFailure.Unreadable, key: error.key }
    }
    throw error
  }
}
