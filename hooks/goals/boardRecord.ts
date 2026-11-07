import type { AttachedTodo, Board, Goal, Setting } from '../../types'
import { describeUnreadableRecord, isRecord } from '../pluginStore'
import { isPositiveInteger } from '../positiveInteger'
import type { DependentGoal, PrioritizedGoal } from './board'
import { MarkRemover, markRemovalAskedOf } from './doneMark'
import type { MarkRemovalAsked, MarkedGoal, UnmarkedGoal } from './doneMark'
import { isPriority } from './priority'
import type { Priority } from './priority'
import { settingOf } from './setting'
import { isTodoNumber } from './todoEntry'
import { boardPrefixOf } from './boardScope'
import type { BoardScope } from './boardScope'

// The version of the records written by this code. A record of a higher version was written by a
// newer plugin, whose fields this code can misread, so it is unreadable and left as it is.
const RECORD_VERSION = 1

/** The parts of a goal, each stored under a key of its own, so that a change writes one key. */
enum RecordPart {
  Goal = 'goal',
  Text = 'text',
  Clearance = 'clearance',
  Todo = 'todo',
  DoneMark = 'done-mark',
  MarkRemoval = 'done-mark-removal',
  Priority = 'priority',
  Dependency = 'dependency',
}

type StoredRecord = { version: typeof RECORD_VERSION } & (
  | { part: RecordPart.Goal; id: string; number: number; text: string; addedAt: number }
  | { part: RecordPart.Text; goalId: string; text: string; editedAt: number }
  | { part: RecordPart.Clearance; goalId: string; clearedAt: number }
  | { part: RecordPart.Todo; goalId: string; number: string; title: string; attachedAt: number }
  | { part: RecordPart.DoneMark; goalId: string; evidence: string; markedAt: number }
  | ({
      part: RecordPart.MarkRemoval
      goalId: string
      markedAt: number
      removedAt: number
    } & MarkRemovalAsked)
  | ({ part: RecordPart.Priority; goalId: string } & Setting<Priority>)
  | ({ part: RecordPart.Dependency; goalId: string } & Setting<string>)
)

/** A record of a board in the form written to the store, under its key. */
export type BoardRecord = { key: string; value: StoredRecord }

/** A value read from the store, under its key. */
export type StoredEntry = { key: string; value: unknown }

export class UnreadableRecordError extends Error {
  readonly key: string

  constructor(key: string) {
    super(describeUnreadableRecord(key))
    this.key = key
  }
}

export function goalRecordOf(scope: BoardScope, goal: Goal): BoardRecord {
  const { id, number, text, addedAt } = goal

  return recordOf(scope, {
    version: RECORD_VERSION,
    part: RecordPart.Goal,
    id,
    number,
    text,
    addedAt,
  })
}

/**
 * The record of the text given to `goal` by an edit. A goal is read with the text of this record in
 * place of the text given when it was added.
 */
export function textRecordOf(scope: BoardScope, goal: Goal, editedAt: number): BoardRecord {
  return recordOf(scope, {
    version: RECORD_VERSION,
    part: RecordPart.Text,
    goalId: goal.id,
    text: goal.text,
    editedAt,
  })
}

export function clearanceRecordOf(scope: BoardScope, goal: Goal, clearedAt: number): BoardRecord {
  return recordOf(scope, {
    version: RECORD_VERSION,
    part: RecordPart.Clearance,
    goalId: goal.id,
    clearedAt,
  })
}

export function todoRecordOf(scope: BoardScope, goal: Goal, todo: AttachedTodo): BoardRecord {
  const { number, title, attachedAt } = todo

  return recordOf(scope, {
    version: RECORD_VERSION,
    part: RecordPart.Todo,
    goalId: goal.id,
    number,
    title,
    attachedAt,
  })
}

/** The record of the done mark of `goal`, written only when the mark is set. */
export function doneMarkRecordOf(scope: BoardScope, goal: MarkedGoal): BoardRecord {
  const { evidence, markedAt } = goal.doneMark

  return recordOf(scope, {
    version: RECORD_VERSION,
    part: RecordPart.DoneMark,
    goalId: goal.id,
    evidence,
    markedAt,
  })
}

/**
 * The record of the removal of a done mark of `goal`. It is a record of its own, so a mark set
 * while the removal of an older mark is written is still set afterwards.
 */
export function markRemovalRecordOf(scope: BoardScope, goal: UnmarkedGoal): BoardRecord {
  const { markedAt, removedAt } = goal.markRemoval

  return recordOf(scope, {
    version: RECORD_VERSION,
    part: RecordPart.MarkRemoval,
    goalId: goal.id,
    markedAt,
    removedAt,
    ...markRemovalAskedOf(goal.markRemoval),
  })
}

/**
 * The record of the priority of `goal`. The removal of a priority is a record without a priority,
 * so a copy of the board read before the removal cannot set the priority again.
 */
export function priorityRecordOf(scope: BoardScope, goal: PrioritizedGoal): BoardRecord {
  return recordOf(scope, {
    version: RECORD_VERSION,
    part: RecordPart.Priority,
    goalId: goal.id,
    ...goal.prioritySetting,
  })
}

/**
 * The record of the dependency of `goal`, by the id of the goal depended on. The removal of a
 * dependency is a record without one, so a copy of the board read before the removal cannot set
 * the dependency again.
 */
export function dependencyRecordOf(scope: BoardScope, goal: DependentGoal): BoardRecord {
  return recordOf(scope, {
    version: RECORD_VERSION,
    part: RecordPart.Dependency,
    goalId: goal.id,
    ...goal.dependencySetting,
  })
}

export function todoKeyOf(scope: BoardScope, goal: Pick<Goal, 'id'>, todoNumber: string): string {
  return `${partKeyOf(scope, goal.id, RecordPart.Todo)}:${todoNumber}`
}

/**
 * Reads the records of the board of `scope`, in the order their keys were first set, into the
 * board. Fails with UnreadableRecordError on a record of another shape or a higher version, on a
 * record under a key other than the key built from it, and on a clearance or an entry whose goal is
 * missing.
 */
export function readBoard(scope: BoardScope, entries: readonly StoredEntry[]): Board {
  const records = entries.map(({ key, value }) => ({ key, record: readRecord(scope, key, value) }))
  const goals: Goal[] = []
  const todos = new Map<string, AttachedTodo[]>()
  const patches = new Map<string, GoalPatch>()
  for (const { record } of records) {
    switch (record.part) {
      case RecordPart.Goal: {
        const { id, number, text, addedAt } = record
        goals.push({ id, number, text, addedAt, todos: [] })
        break
      }
      case RecordPart.Todo: {
        const { goalId, number, title, attachedAt } = record
        const entries = todos.get(goalId) ?? []
        entries.push({ number, title, attachedAt })
        todos.set(goalId, entries)
        break
      }
      default:
        patches.set(record.goalId, { ...patches.get(record.goalId), ...patchOf(record) })
    }
  }
  const goalIds = new Set(goals.map(goal => goal.id))
  const orphan = records.find(
    ({ record }) => record.part !== RecordPart.Goal && !goalIds.has(record.goalId),
  )
  if (orphan !== undefined) {
    throw new UnreadableRecordError(orphan.key)
  }

  return {
    goals: goals.map(goal => ({
      ...goal,
      ...patches.get(goal.id),
      todos: todos.get(goal.id) ?? [],
    })),
  }
}

/** The fields of a goal stored in records of their own, each replaced by a later record. */
type GoalPatch = Partial<Omit<Goal, 'id' | 'number' | 'addedAt' | 'todos'>>

/** The fields of a goal stored in `record`. */
function patchOf(
  record: Exclude<StoredRecord, { part: RecordPart.Goal | RecordPart.Todo }>,
): GoalPatch {
  switch (record.part) {
    case RecordPart.Text:
      return { text: record.text, editedAt: record.editedAt }
    case RecordPart.Clearance:
      return { clearedAt: record.clearedAt }
    case RecordPart.DoneMark:
      return { doneMark: { evidence: record.evidence, markedAt: record.markedAt } }
    case RecordPart.MarkRemoval: {
      const { markedAt, removedAt } = record

      return { markRemoval: { markedAt, removedAt, ...markRemovalAskedOf(record) } }
    }
    case RecordPart.Priority:
      return { prioritySetting: settingOf(record.value, record.setAt) }
    case RecordPart.Dependency:
      return { dependencySetting: settingOf(record.value, record.setAt) }
  }
}

function recordOf(scope: BoardScope, value: StoredRecord): BoardRecord {
  return { key: keyOf(scope, value), value }
}

function keyOf(scope: BoardScope, record: StoredRecord): string {
  switch (record.part) {
    case RecordPart.Goal:
      return `${boardPrefixOf(scope)}${record.id}`
    case RecordPart.Todo:
      return todoKeyOf(scope, { id: record.goalId }, record.number)
    case RecordPart.Text:
    case RecordPart.Clearance:
    case RecordPart.DoneMark:
    case RecordPart.MarkRemoval:
    case RecordPart.Priority:
    case RecordPart.Dependency:
      return partKeyOf(scope, record.goalId, record.part)
  }
}

/** The key of the record of the part `part` of the goal with the id `goalId`. */
function partKeyOf(scope: BoardScope, goalId: string, part: RecordPart): string {
  return `${boardPrefixOf(scope)}${goalId}:${part}`
}

function readRecord(scope: BoardScope, key: string, value: unknown): StoredRecord {
  const record = parseRecord(value)
  if (record === undefined || keyOf(scope, record) !== key) {
    throw new UnreadableRecordError(key)
  }

  return record
}

function parseRecord(value: unknown): StoredRecord | undefined {
  if (!isRecord(value) || value.version !== RECORD_VERSION) {
    return undefined
  }
  const part = Object.values(RecordPart).find(each => each === value.part)

  return part === undefined ? undefined : PARSERS[part](value)
}

const PARSERS: Record<RecordPart, (value: Record<string, unknown>) => StoredRecord | undefined> = {
  [RecordPart.Goal]: ({ id, number, text, addedAt }) =>
    typeof id === 'string' &&
    isPositiveInteger(number) &&
    typeof text === 'string' &&
    typeof addedAt === 'number'
      ? { version: RECORD_VERSION, part: RecordPart.Goal, id, number, text, addedAt }
      : undefined,
  [RecordPart.Text]: ({ goalId, text, editedAt }) =>
    typeof goalId === 'string' && typeof text === 'string' && typeof editedAt === 'number'
      ? { version: RECORD_VERSION, part: RecordPart.Text, goalId, text, editedAt }
      : undefined,
  [RecordPart.Clearance]: ({ goalId, clearedAt }) =>
    typeof goalId === 'string' && typeof clearedAt === 'number'
      ? { version: RECORD_VERSION, part: RecordPart.Clearance, goalId, clearedAt }
      : undefined,
  [RecordPart.Todo]: ({ goalId, number, title, attachedAt }) =>
    typeof goalId === 'string' &&
    isTodoNumber(number) &&
    typeof title === 'string' &&
    typeof attachedAt === 'number'
      ? { version: RECORD_VERSION, part: RecordPart.Todo, goalId, number, title, attachedAt }
      : undefined,
  [RecordPart.DoneMark]: ({ goalId, evidence, markedAt }) =>
    typeof goalId === 'string' && typeof evidence === 'string' && typeof markedAt === 'number'
      ? { version: RECORD_VERSION, part: RecordPart.DoneMark, goalId, evidence, markedAt }
      : undefined,
  [RecordPart.MarkRemoval]: ({ goalId, markedAt, removedAt, ...asked }) => {
    const removal = readMarkRemovalAsked(asked)

    return typeof goalId === 'string' &&
      typeof markedAt === 'number' &&
      typeof removedAt === 'number' &&
      removal !== undefined
      ? {
          version: RECORD_VERSION,
          part: RecordPart.MarkRemoval,
          goalId,
          markedAt,
          removedAt,
          ...removal,
        }
      : undefined
  },
  [RecordPart.Priority]: ({ goalId, value, setAt }) =>
    typeof goalId === 'string' &&
    (value === undefined || isPriority(value)) &&
    typeof setAt === 'number'
      ? { version: RECORD_VERSION, part: RecordPart.Priority, goalId, ...settingOf(value, setAt) }
      : undefined,
  [RecordPart.Dependency]: ({ goalId, value, setAt }) =>
    typeof goalId === 'string' &&
    (value === undefined || typeof value === 'string') &&
    typeof setAt === 'number'
      ? { version: RECORD_VERSION, part: RecordPart.Dependency, goalId, ...settingOf(value, setAt) }
      : undefined,
}

/**
 * Reads the remover of a stored removal, with the fields of that remover. A reason that is not
 * text, or is blank, reads as absent.
 */
function readMarkRemovalAsked({
  removedBy,
  reason,
  dependencyNumber,
}: Record<string, unknown>): MarkRemovalAsked | undefined {
  const remover = Object.values(MarkRemover).find(each => each === removedBy)
  switch (remover) {
    case undefined:
      return undefined
    case MarkRemover.Model:
      return { removedBy: remover }
    case MarkRemover.User:
      return markRemovalAskedOf(
        typeof reason === 'string' ? { removedBy: remover, reason } : { removedBy: remover },
      )
    case MarkRemover.Dependency:
      return isPositiveInteger(dependencyNumber)
        ? { removedBy: remover, dependencyNumber }
        : undefined
  }
}
