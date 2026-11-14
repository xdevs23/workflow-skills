import type { AttachedTodo, Board, Goal } from '../../types'
import {
  StoreCall,
  deleteRecord,
  describeRefusedRead,
  describeRefusedWrite,
  describeUnreadableRecord,
  readEntriesIn,
  readEntriesUnder,
  returningStoreFailure,
  writeRecord,
} from '../pluginStore'
import type { StoreEngine } from '../pluginStore'
import { importedIdsOf } from '../importedId'
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
  openGoalsOf,
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
import { importedGoalsOf } from './goalImport'
import type { ImportedGoal } from './goalImport'
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

/** The goals imported into a board, as they were stored. */
export type GoalsImported = { outcome: Outcome.Changed; imported: readonly ImportedGoal[] }

/** An import into the board `into` of the open goals with the ids `picked` of the board `from`. */
export type GoalImport = { into: BoardScope; from: Board; picked: ReadonlySet<string> }

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

/** Reads the board of the scope from the records under the keys of `keys`, listed before. */
export function loadBoardIn(
  $: StoreEngine,
  scope: BoardScope,
  keys: readonly string[],
): Promise<Read | Failed> {
  return returningFailure(async () => ({
    outcome: Outcome.Read,
    board: settledBoardOf(readBoard(scope, await readEntriesIn($, boardPrefixOf(scope), keys))),
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

/**
 * Stores the goals of `goalImport` made by importedGoalsOf under the ids given by importedIdsOf,
 * each with its priority and dependency right after it, and then gives every goal whose number was
 * taken meanwhile a free number, as saveNewGoal does. A dependency is stored by the id of the goal
 * depended on, so it still points at that goal when the goal is stored under another number. Goals
 * stored by an import that failed are found on the board by the next import of the same goals,
 * which stores only the rest.
 */
export function saveImportedGoals(
  $: StoreEngine,
  { into, from, picked }: GoalImport,
  importedAt: number,
): Promise<GoalsImported | Failed> {
  return returningFailure(async () => {
    const newIds = await importedIdsOf(
      into.id,
      openGoalsOf(from).map(goal => goal.id),
    )
    const target = await readStoredBoard($, into)
    const imported = importedGoalsOf(from, { pickedIds: picked, newIds }, target, importedAt)
    for (const { goal } of imported) {
      await writeRecord($, goalRecordOf(into, goal))
      await Promise.all(settingRecordsOf(into, goal).map(record => writeRecord($, record)))
    }
    const { storedAs } = await settleNumbers(
      $,
      into,
      imported.map(({ goal }) => goal),
    )

    return {
      outcome: Outcome.Changed,
      imported: imported.map(each => ({ ...each, goal: storedAs(each.goal) })),
    }
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
    goal => deleteRecord($, todoKeyOf(scope, goal, todoNumber)),
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
  await writeRecord($, goalRecordOf(scope, added))
  const { board, storedAs } = await settleNumbers($, scope, [added])

  return { outcome: Outcome.Changed, board, goal: storedAs(added), unmarked: [] }
}

/**
 * Reads the board after the goals `written` were stored, and stores each of them whose number a
 * goal listed before it took under the next free numbers, until none is taken. Returns the settled
 * board, and each goal of `written` as it is stored.
 */
async function settleNumbers(
  $: StoreEngine,
  scope: BoardScope,
  written: readonly Goal[],
): Promise<{ board: Board; storedAs: (goal: Goal) => Goal }> {
  const board = await readStoredBoard($, scope)
  const firstFree = nextGoalNumberOf(board)
  const renumbered = written
    .filter(goal => isNumberTaken(goal, board))
    .map((goal, index) => ({ ...goal, number: firstFree + index }))
  if (renumbered.length === 0) {
    const numbers = new Map(written.map(goal => [goal.id, goal.number]))

    return {
      board: settledBoardOf(board),
      storedAs: goal => ({ ...goal, number: numbers.get(goal.id) ?? goal.number }),
    }
  }
  for (const goal of renumbered) {
    await writeRecord($, goalRecordOf(scope, goal))
  }
  const byId = new Map(renumbered.map(goal => [goal.id, goal]))

  return settleNumbers(
    $,
    scope,
    written.map(goal => byId.get(goal.id) ?? goal),
  )
}

/** The records of the priority and the dependency set on `goal`. */
function settingRecordsOf(scope: BoardScope, goal: Goal): BoardRecord[] {
  const { prioritySetting, dependencySetting } = goal

  return [
    ...(prioritySetting === undefined
      ? []
      : [priorityRecordOf(scope, { ...goal, prioritySetting })]),
    ...(dependencySetting === undefined
      ? []
      : [dependencyRecordOf(scope, { ...goal, dependencySetting })]),
  ]
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
