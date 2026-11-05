import type { AttachedTodo, Board, Goal } from '../../types'
import { describeUnreadableRecord, isRecord } from '../pluginStore'
import { isPositiveInteger } from '../positiveInteger'
import { isTodoNumber } from './todoEntry'
import { boardPrefixOf } from './boardScope'
import type { BoardScope } from './boardScope'

// The version of the records written by this code. A record of a higher version was written by a
// newer plugin, whose fields this code can misread, so it is unreadable and left as it is.
const RECORD_VERSION = 1

/** The parts of a goal, each stored under a key of its own, so that a change writes one key. */
enum RecordPart {
  Goal = 'goal',
  Clearance = 'clearance',
  Todo = 'todo',
}

type StoredRecord = { version: typeof RECORD_VERSION } & (
  | { part: RecordPart.Goal; id: string; number: number; text: string; addedAt: number }
  | { part: RecordPart.Clearance; goalId: string; clearedAt: number }
  | { part: RecordPart.Todo; goalId: string; number: string; title: string; attachedAt: number }
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

export function todoKeyOf(scope: BoardScope, goal: Pick<Goal, 'id'>, todoNumber: string): string {
  return `${boardPrefixOf(scope)}${goal.id}:${RecordPart.Todo}:${todoNumber}`
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
  const clearances = new Map<string, number>()
  const todos = new Map<string, AttachedTodo[]>()
  for (const { record } of records) {
    switch (record.part) {
      case RecordPart.Goal: {
        const { id, number, text, addedAt } = record
        goals.push({ id, number, text, addedAt, todos: [] })
        break
      }
      case RecordPart.Clearance:
        clearances.set(record.goalId, record.clearedAt)
        break
      case RecordPart.Todo: {
        const { goalId, number, title, attachedAt } = record
        const entries = todos.get(goalId) ?? []
        entries.push({ number, title, attachedAt })
        todos.set(goalId, entries)
        break
      }
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
    goals: goals.map(goal => {
      const withTodos = { ...goal, todos: todos.get(goal.id) ?? [] }
      const clearedAt = clearances.get(goal.id)

      return clearedAt === undefined ? withTodos : { ...withTodos, clearedAt }
    }),
  }
}

function recordOf(scope: BoardScope, value: StoredRecord): BoardRecord {
  return { key: keyOf(scope, value), value }
}

function keyOf(scope: BoardScope, record: StoredRecord): string {
  switch (record.part) {
    case RecordPart.Goal:
      return `${boardPrefixOf(scope)}${record.id}`
    case RecordPart.Clearance:
      return `${boardPrefixOf(scope)}${record.goalId}:${RecordPart.Clearance}`
    case RecordPart.Todo:
      return todoKeyOf(scope, { id: record.goalId }, record.number)
  }
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
}
