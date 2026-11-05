import { describe, expect, test } from 'claude-code/testing'

import type { Board, Goal } from '../../types'
import {
  EMPTY_BOARD,
  Outcome,
  Refusal,
  addGoal,
  attachTodo,
  clearGoal,
  detachTodo,
  openGoalsOf,
} from './board'
import type { AddRefused, BoardChange } from './board'

const FULL_APP: Goal = {
  id: 'full-app',
  number: 1,
  text: 'Write the migration guide',
  addedAt: 100,
  todos: [{ number: '38', title: 'Settings screen shows the account', attachedAt: 110 }],
}
const LOGIN_FIX: Goal = {
  id: 'login-fix',
  number: 2,
  text: 'Fix the export timeout',
  addedAt: 200,
  todos: [
    { number: '42', title: 'Release v3.2.0', attachedAt: 210 },
    { number: '41', title: 'Login keeps the session after a token refresh', attachedAt: 220 },
  ],
}
const TEST_HARNESS: Goal = {
  id: 'test-harness',
  number: 3,
  text: 'Speed up the nightly build',
  addedAt: 300,
  todos: [],
}

const THREE_GOALS: Board = { goals: [FULL_APP, LOGIN_FIX, TEST_HARNESS] }

/** The board after a change, failing the test when the change was refused. */
function boardOf(change: BoardChange | AddRefused): Board {
  if (change.outcome === Outcome.Refused) {
    throw new Error(`The change was refused: ${change.refusal}`)
  }

  return change.board
}

function goalOf(board: Board, number: number): Goal | undefined {
  return board.goals.find(goal => goal.number === number)
}

describe('goal numbers', () => {
  test('the first goal of a board is #1', () => {
    const added = addGoal(EMPTY_BOARD, { id: 'a', text: 'Write the migration guide' }, 100)

    expect(boardOf(added).goals).toEqual([
      { id: 'a', number: 1, text: 'Write the migration guide', addedAt: 100, todos: [] },
    ])
  })

  test('a goal added after #2 and #3 were cleared gets #4', () => {
    const cleared = boardOf(clearGoal(boardOf(clearGoal(THREE_GOALS, 2, 400)), 3, 410))
    const added = boardOf(addGoal(cleared, { id: 'listing', text: 'Store listing' }, 500))

    expect(added.goals.map(goal => goal.number)).toEqual([1, 2, 3, 4])
    expect(openGoalsOf(added).map(goal => goal.number)).toEqual([1, 4])
  })

  test('a goal added after the newest goal was cleared does not get its number', () => {
    const cleared = boardOf(clearGoal(THREE_GOALS, 3, 400))
    const added = addGoal(cleared, { id: 'listing', text: 'Store listing' }, 500)

    expect(boardOf(added).goals.at(-1)?.number).toBe(4)
  })

  test('a goal added to a board whose highest number is listed first gets the number above', () => {
    const board = { goals: [TEST_HARNESS, FULL_APP] }
    const added = addGoal(board, { id: 'listing', text: 'Store listing' }, 500)

    expect(boardOf(added).goals.at(-1)?.number).toBe(4)
  })

  test('a goal is added with its text without the white space around it', () => {
    const added = addGoal(EMPTY_BOARD, { id: 'a', text: '  Write the migration guide\n' }, 100)

    expect(boardOf(added).goals[0]?.text).toBe('Write the migration guide')
  })

  test('a goal expected under a number another goal has by now is not added', () => {
    expect(addGoal(THREE_GOALS, { id: 'listing', text: 'Store listing' }, 500, 3)).toEqual({
      outcome: Outcome.Refused,
      refusal: Refusal.NumberTaken,
      goal: 3,
    })
  })

  test('a goal expected under the next number gets it', () => {
    const added = addGoal(THREE_GOALS, { id: 'listing', text: 'Store listing' }, 500, 4)

    expect(boardOf(added).goals.at(-1)?.number).toBe(4)
  })

  test('a goal without text is not added', () => {
    expect(addGoal(THREE_GOALS, { id: 'blank', text: ' \n' }, 500)).toEqual({
      outcome: Outcome.Refused,
      refusal: Refusal.BlankText,
    })
  })
})

describe('clearing a goal', () => {
  test('a cleared goal is still on the board, with the time it was cleared', () => {
    const cleared = boardOf(clearGoal(THREE_GOALS, 2, 400))

    expect(goalOf(cleared, 2)).toEqual({ ...LOGIN_FIX, clearedAt: 400 })
    expect(openGoalsOf(cleared)).toEqual([FULL_APP, TEST_HARNESS])
  })

  test('clearing a cleared goal or a number never given returns that the goal is not open', () => {
    const cleared = boardOf(clearGoal(THREE_GOALS, 2, 400))
    const notOpen = (goal: number) => ({
      outcome: Outcome.Refused,
      refusal: Refusal.GoalNotOpen,
      goal,
    })

    expect(clearGoal(cleared, 2, 500)).toEqual(notOpen(2))
    expect(clearGoal(cleared, 7, 500)).toEqual(notOpen(7))
  })
})

describe('attaching a TODO entry', () => {
  test('a new TODO number is attached after the entries of the goal', () => {
    const attached = boardOf(
      attachTodo(THREE_GOALS, 1, { number: '234', title: 'Map shows the saved spots' }, 500),
    )

    expect(goalOf(attached, 1)?.todos).toEqual([
      ...FULL_APP.todos,
      { number: '234', title: 'Map shows the saved spots', attachedAt: 500 },
    ])
  })

  test('attaching #41 again under a newer title replaces #41 in its place', () => {
    const attached = boardOf(
      attachTodo(THREE_GOALS, 2, { number: '41', title: 'Login survives an app restart' }, 500),
    )

    expect(goalOf(attached, 2)?.todos).toEqual([
      { number: '42', title: 'Release v3.2.0', attachedAt: 210 },
      { number: '41', title: 'Login survives an app restart', attachedAt: 500 },
    ])
  })

  test('attaching #41 again under the same title leaves the board unchanged', () => {
    const change = attachTodo(
      THREE_GOALS,
      2,
      { number: '41', title: 'Login keeps the session after a token refresh' },
      500,
    )

    expect(change).toEqual({ outcome: Outcome.Unchanged, board: THREE_GOALS })
  })

  test('attaching to a cleared goal returns that the goal is not open', () => {
    const cleared = boardOf(clearGoal(THREE_GOALS, 2, 400))

    expect(attachTodo(cleared, 2, { number: '45', title: 'Reuse one emulator boot' }, 500)).toEqual({
      outcome: Outcome.Refused,
      refusal: Refusal.GoalNotOpen,
      goal: 2,
    })
  })

  test('a TODO number of a sub-unit is attached', () => {
    const attached = boardOf(
      attachTodo(THREE_GOALS, 2, { number: '41.1', title: 'Token refresh keeps the user' }, 500),
    )

    expect(goalOf(attached, 2)?.todos.map(todo => todo.number)).toEqual(['42', '41', '41.1'])
  })

  test('a TODO number that is not a number of an entry in TODO.md is not attached', () => {
    for (const number of ['0', '-3', '41.', '.1', '41.0', '#41', ' 41', '']) {
      expect(attachTodo(THREE_GOALS, 1, { number, title: 'Settings' }, 500)).toEqual({
        outcome: Outcome.Refused,
        refusal: Refusal.NotTodoNumber,
        todo: number,
      })
    }
  })

  test('a TODO entry without a title is not attached', () => {
    expect(attachTodo(THREE_GOALS, 1, { number: '45', title: ' \n' }, 500)).toEqual({
      outcome: Outcome.Refused,
      refusal: Refusal.BlankTitle,
    })
  })
})

describe('detaching a TODO entry', () => {
  test('the entry is removed from the goal, and the other entries are in the same order', () => {
    const detached = boardOf(detachTodo(THREE_GOALS, 2, '42'))

    expect(goalOf(detached, 2)?.todos).toEqual([LOGIN_FIX.todos[1]])
    expect(goalOf(detached, 1)).toEqual(FULL_APP)
  })

  test('detaching an entry missing from the goal returns that it is not attached', () => {
    expect(detachTodo(THREE_GOALS, 1, '41')).toEqual({
      outcome: Outcome.Refused,
      refusal: Refusal.TodoNotAttached,
      goal: 1,
      todo: '41',
    })
  })

  test('detaching from a cleared goal returns that the goal is not open', () => {
    const cleared = boardOf(clearGoal(THREE_GOALS, 2, 400))

    expect(detachTodo(cleared, 2, '42')).toEqual({
      outcome: Outcome.Refused,
      refusal: Refusal.GoalNotOpen,
      goal: 2,
    })
  })
})
