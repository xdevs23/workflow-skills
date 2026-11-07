import { expect } from 'claude-code/testing'

import type { Board } from '../../types'
import { test } from '../testDeclaration'
import { FIRST_SESSION } from '../testSupport'
import type { DependentGoal, PrioritizedGoal } from './board'
import { MarkRemover } from './doneMark'
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
  todoRecordOf,
} from './boardRecord'
import { sessionScope } from './boardScope'

const SCOPE = sessionScope(FIRST_SESSION)

test('a board written as records and read back is the same board', () => {
  const board: Board = {
    goals: [
      {
        id: 'full-app',
        number: 1,
        text: 'Write the migration guide',
        addedAt: 100,
        todos: [
          { number: '38', title: 'Settings screen shows the account', attachedAt: 110 },
          { number: '234', title: 'Map shows the saved spots', attachedAt: 120 },
        ],
      },
      {
        id: 'login-fix',
        number: 2,
        text: 'Fix the export timeout',
        addedAt: 200,
        clearedAt: 300,
        todos: [{ number: '41', title: 'Login keeps the session', attachedAt: 210 }],
      },
    ],
  }
  const records = board.goals.flatMap(goal => [
    goalRecordOf(SCOPE, goal),
    ...(goal.clearedAt === undefined ? [] : [clearanceRecordOf(SCOPE, goal, goal.clearedAt)]),
    ...goal.todos.map(todo => todoRecordOf(SCOPE, goal, todo)),
  ])
  const stored = records.map(({ key, value }) => ({ key, value: structuredClone(value) }))

  expect(readBoard(SCOPE, stored)).toEqual(board)
})

test('an edited goal is read with the text of its edit, and keeps every other part', () => {
  const added = {
    id: 'login-fix',
    number: 2,
    text: 'Fix the export timeout',
    addedAt: 200,
    todos: [{ number: '41', title: 'Login keeps the session', attachedAt: 210 }],
  }
  const edited = { ...added, text: 'Fix the export timeout by Friday', editedAt: 300 }
  const records = [
    goalRecordOf(SCOPE, added),
    ...added.todos.map(todo => todoRecordOf(SCOPE, added, todo)),
    textRecordOf(SCOPE, edited, 300),
  ]

  expect(readBoard(SCOPE, records)).toEqual({ goals: [edited] })
})

test('a done mark and a removed done mark are read back as they were written', () => {
  const added = {
    id: 'login-fix',
    number: 2,
    text: 'Fix the export timeout',
    addedAt: 200,
    todos: [],
  }
  const marked = { ...added, doneMark: { evidence: 'release/v3.2.0', markedAt: 300 } }
  const removed = {
    ...marked,
    markRemoval: { markedAt: 300, removedAt: 400, removedBy: MarkRemover.User } as const,
  }

  const markRecords = [goalRecordOf(SCOPE, marked), doneMarkRecordOf(SCOPE, marked)]

  for (const [goal, records] of [
    [marked, markRecords],
    [removed, [...markRecords, markRemovalRecordOf(SCOPE, removed)]],
  ] as const) {
    const stored = records.map(({ key, value }) => ({ key, value: structuredClone(value) }))

    expect(readBoard(SCOPE, stored)).toEqual({ goals: [goal] })
  }
})

test('a done mark removed by someone this code does not know is unreadable', () => {
  const removed = {
    id: 'login-fix',
    number: 2,
    text: 'Fix the export timeout',
    addedAt: 200,
    todos: [],
    doneMark: { evidence: 'v3.2.0', markedAt: 300 },
    markRemoval: { markedAt: 300, removedAt: 400, removedBy: MarkRemover.User } as const,
  }
  const record = markRemovalRecordOf(SCOPE, removed)
  const stored = [
    { key: goalRecordOf(SCOPE, removed).key, value: goalRecordOf(SCOPE, removed).value },
    { key: record.key, value: { ...record.value, removedBy: 'bot' } },
  ]

  expect(() => readBoard(SCOPE, stored)).toThrow(UnreadableRecordError)
})

const MARKED = {
  id: 'login-fix',
  number: 2,
  text: 'Fix the export timeout',
  addedAt: 200,
  todos: [],
  doneMark: { evidence: 'release/v3.2.0', markedAt: 300 },
}
const UNMARKED = {
  ...MARKED,
  markRemoval: { markedAt: 300, removedAt: 400, removedBy: MarkRemover.User } as const,
}
const MARK_RECORDS = [goalRecordOf(SCOPE, MARKED), doneMarkRecordOf(SCOPE, MARKED)]
const REMOVAL_RECORD = markRemovalRecordOf(SCOPE, UNMARKED)

test('a done mark removed with a reason is read back with that reason', () => {
  const withReason = {
    ...MARKED,
    markRemoval: { ...UNMARKED.markRemoval, reason: 'The export still times out at 10000 rows' },
  }

  expect(readBoard(SCOPE, [...MARK_RECORDS, markRemovalRecordOf(SCOPE, withReason)])).toEqual({
    goals: [withReason],
  })
})

test('a removal stored without a reason field is read without a reason', () => {
  const stored = {
    key: REMOVAL_RECORD.key,
    value: { version: 1, part: 'done-mark-removal', goalId: MARKED.id, ...UNMARKED.markRemoval },
  }

  expect(readBoard(SCOPE, [...MARK_RECORDS, stored])).toEqual({ goals: [UNMARKED] })
})

test('a removal with a reason that is not a text or is blank is read without a reason', () => {
  for (const reason of [7, '  ']) {
    const stored = { key: REMOVAL_RECORD.key, value: { ...REMOVAL_RECORD.value, reason } }

    expect(readBoard(SCOPE, [...MARK_RECORDS, stored])).toEqual({ goals: [UNMARKED] })
  }
})

const PRIORITIZED: PrioritizedGoal = { ...MARKED, prioritySetting: { value: 2, setAt: 500 } }
const PRIORITY_RECORD = priorityRecordOf(SCOPE, PRIORITIZED)

test('a priority and the removal of a priority are read back under one key as written', () => {
  const removed = { ...MARKED, prioritySetting: { setAt: 600 } }
  const removal = priorityRecordOf(SCOPE, removed)

  expect(removal.key).toBe(PRIORITY_RECORD.key)
  expect(readBoard(SCOPE, [...MARK_RECORDS, PRIORITY_RECORD])).toEqual({ goals: [PRIORITIZED] })
  expect(readBoard(SCOPE, [...MARK_RECORDS, removal])).toEqual({ goals: [removed] })
})

test('a priority record with a priority other than P0 to P9 is unreadable', () => {
  for (const value of [10, -1, 1.5, '1', null]) {
    const stored = { key: PRIORITY_RECORD.key, value: { ...PRIORITY_RECORD.value, value } }

    expect(() => readBoard(SCOPE, [...MARK_RECORDS, stored])).toThrow(UnreadableRecordError)
  }
})

const DEPENDENT: DependentGoal = {
  ...MARKED,
  dependencySetting: { value: 'full-app', setAt: 500 },
}
const DEPENDENCY_RECORD = dependencyRecordOf(SCOPE, DEPENDENT)

test('a dependency and its removal are read back under one key as written', () => {
  const removed = { ...MARKED, dependencySetting: { setAt: 600 } }
  const removal = dependencyRecordOf(SCOPE, removed)

  expect(removal.key).toBe(DEPENDENCY_RECORD.key)
  expect(readBoard(SCOPE, [...MARK_RECORDS, DEPENDENCY_RECORD])).toEqual({ goals: [DEPENDENT] })
  expect(readBoard(SCOPE, [...MARK_RECORDS, removal])).toEqual({ goals: [removed] })
})

test('a dependency record whose goal depended on is not an id is unreadable', () => {
  for (const value of [7, null]) {
    const stored = { key: DEPENDENCY_RECORD.key, value: { ...DEPENDENCY_RECORD.value, value } }

    expect(() => readBoard(SCOPE, [...MARK_RECORDS, stored])).toThrow(UnreadableRecordError)
  }
})

test('a mark removed for a dependency is read back with the number of the goal depended on', () => {
  const unmarked = {
    ...MARKED,
    markRemoval: {
      markedAt: 300,
      removedAt: 400,
      removedBy: MarkRemover.Dependency,
      dependencyNumber: 1,
    },
  } as const
  const removal = markRemovalRecordOf(SCOPE, unmarked)

  expect(readBoard(SCOPE, [...MARK_RECORDS, removal])).toEqual({ goals: [unmarked] })
  for (const dependencyNumber of [undefined, 0, '1']) {
    const stored = { key: removal.key, value: { ...removal.value, dependencyNumber } }

    expect(() => readBoard(SCOPE, [...MARK_RECORDS, stored])).toThrow(UnreadableRecordError)
  }
})
