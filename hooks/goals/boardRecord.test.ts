import { expect, test } from 'claude-code/testing'

import type { Board } from '../../types'
import { FIRST_SESSION } from '../testSupport'
import { MarkRemover } from './board'
import {
  UnreadableRecordError,
  clearanceRecordOf,
  doneMarkRecordOf,
  goalRecordOf,
  markRemovalRecordOf,
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
    markRemoval: { markedAt: 300, removedAt: 400, removedBy: MarkRemover.User },
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
    markRemoval: { markedAt: 300, removedAt: 400, removedBy: MarkRemover.User },
  }
  const record = markRemovalRecordOf(SCOPE, removed)
  const stored = [
    { key: goalRecordOf(SCOPE, removed).key, value: goalRecordOf(SCOPE, removed).value },
    { key: record.key, value: { ...record.value, removedBy: 'bot' } },
  ]

  expect(() => readBoard(SCOPE, stored)).toThrow(UnreadableRecordError)
})
