import { expect, test } from 'claude-code/testing'

import type { Board } from '../../types'
import { FIRST_SESSION } from '../testSupport'
import { clearanceRecordOf, goalRecordOf, readBoard, todoRecordOf } from './boardRecord'
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
