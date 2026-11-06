import { describe, expect, test } from 'claude-code/testing'

import type { Board, Goal } from '../../types'
import {
  EMPTY_BOARD,
  MarkRemover,
  Outcome,
  Refusal,
  addGoal,
  attachTodo,
  boardWithChangesTakenBack,
  clearGoal,
  combinedBoardOf,
  detachTodo,
  doneMarkOf,
  editGoal,
  markGoalDone,
  openGoalsOf,
  removeDoneMark,
} from './board'
import type { AddRefused, BoardChange, EditRefused, MarkRefused, UnmarkRefused } from './board'

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
function boardOf(
  change: BoardChange | AddRefused | EditRefused | MarkRefused | UnmarkRefused,
): Board {
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

describe('editing a goal', () => {
  test('an edited goal keeps its number, its TODO entries and its place, with the new text', () => {
    const edited = boardOf(editGoal(THREE_GOALS, 2, '  Fix the export timeout by Friday\n', 500))

    expect(edited.goals).toEqual([
      FULL_APP,
      { ...LOGIN_FIX, text: 'Fix the export timeout by Friday', editedAt: 500 },
      TEST_HARNESS,
    ])
  })

  test('an edit to the text already on the goal leaves the board unchanged', () => {
    expect(editGoal(THREE_GOALS, 2, ' Fix the export timeout ', 500)).toEqual({
      outcome: Outcome.Unchanged,
      board: THREE_GOALS,
    })
  })

  test('an edit removes the done mark of the goal, as removed by the user', () => {
    const marked = boardOf(markGoalDone(THREE_GOALS, 2, 'release/v3.2.0', 400))
    const goal = goalOf(boardOf(editGoal(marked, 2, 'Release v3.2.1', 500)), 2) ?? LOGIN_FIX

    expect(doneMarkOf(goal)).toBeUndefined()
    expect(goal.markRemoval).toEqual({
      markedAt: 400,
      removedAt: 500,
      removedBy: MarkRemover.User,
    })
  })

  test('an edit without text is refused', () => {
    expect(editGoal(THREE_GOALS, 2, ' \n', 500)).toEqual({
      outcome: Outcome.Refused,
      refusal: Refusal.BlankText,
    })
  })

  test('editing a cleared goal or a number never given returns that the goal is not open', () => {
    const cleared = boardOf(clearGoal(THREE_GOALS, 2, 400))

    for (const number of [2, 7]) {
      expect(editGoal(cleared, number, 'Fix the export timeout by Friday', 500)).toEqual({
        outcome: Outcome.Refused,
        refusal: Refusal.GoalNotOpen,
        goal: number,
      })
    }
  })
})

describe('marking a goal as done', () => {
  const BY_USER = { removedAt: 600, removedBy: MarkRemover.User }

  test('a marked goal stays open, with the evidence without the white space around it', () => {
    const marked = boardOf(markGoalDone(THREE_GOALS, 2, ' release/v3.2.0 \n', 500))

    expect(openGoalsOf(marked)).toHaveLength(3)
    expect(goalOf(marked, 2)).toEqual({
      ...LOGIN_FIX,
      doneMark: { evidence: 'release/v3.2.0', markedAt: 500 },
    })
  })

  test('a new evidence replaces the mark, and the same evidence leaves the board unchanged', () => {
    const marked = boardOf(markGoalDone(THREE_GOALS, 2, 'release/v3.2.0', 500))

    expect(markGoalDone(marked, 2, 'release/v3.2.0', 510)).toEqual({
      outcome: Outcome.Unchanged,
      board: marked,
    })
    expect(goalOf(boardOf(markGoalDone(marked, 2, 'v3.2.1', 520)), 2)?.doneMark).toEqual({
      evidence: 'v3.2.1',
      markedAt: 520,
    })
  })

  test('a blank evidence and an evidence over 80 characters are refused', () => {
    expect(markGoalDone(THREE_GOALS, 2, ' \n', 500)).toEqual({
      outcome: Outcome.Refused,
      refusal: Refusal.BlankEvidence,
    })
    expect(markGoalDone(THREE_GOALS, 2, 'a'.repeat(81), 500)).toEqual({
      outcome: Outcome.Refused,
      refusal: Refusal.EvidenceTooLong,
    })
    // Counted in code points: 80 emoji are 160 UTF-16 code units.
    expect(markGoalDone(THREE_GOALS, 2, '\u{1F680}'.repeat(80), 500).outcome).toBe(
      Outcome.Changed,
    )
  })

  test('an evidence over several lines, or with a tab or a control character, is refused', () => {
    for (const evidence of [
      'v3.2.0\nsecond line',
      'v3.2.0\u2028second line',
      'release\tv3.2.0',
      'release/v3.2.0\u001b[2J',
    ]) {
      expect(markGoalDone(THREE_GOALS, 2, evidence, 500)).toEqual({
        outcome: Outcome.Refused,
        refusal: Refusal.EvidenceNotOneLine,
      })
    }
  })

  test('marking a cleared goal or a number never given returns that the goal is not open', () => {
    const cleared = boardOf(clearGoal(THREE_GOALS, 2, 400))

    for (const number of [2, 7]) {
      expect(markGoalDone(cleared, number, 'v3.2.0', 500)).toEqual({
        outcome: Outcome.Refused,
        refusal: Refusal.GoalNotOpen,
        goal: number,
      })
    }
  })

  test('a removed mark still has its evidence, and the goal is not marked', () => {
    const marked = boardOf(markGoalDone(THREE_GOALS, 2, 'v3.2.0', 500))
    const removed = boardOf(removeDoneMark(marked, 2, BY_USER))
    const goal = goalOf(removed, 2) ?? LOGIN_FIX

    expect(goal.doneMark).toEqual({ evidence: 'v3.2.0', markedAt: 500 })
    expect(goal.markRemoval).toEqual({ ...BY_USER, markedAt: 500 })
    expect(doneMarkOf(goal)).toBeUndefined()
    expect(removeDoneMark(removed, 2, BY_USER)).toEqual({
      outcome: Outcome.Refused,
      refusal: Refusal.NotMarkedDone,
      goal: 2,
    })
  })

  test('a reason is stored trimmed, and a blank or absent reason is not stored', () => {
    const marked = boardOf(markGoalDone(THREE_GOALS, 2, 'v3.2.0', 500))

    for (const [asked, stored] of [
      [{ ...BY_USER, reason: '  ' }, BY_USER],
      [{ ...BY_USER, reason: ' x ' }, { ...BY_USER, reason: 'x' }],
      [{ ...BY_USER, reason: '' }, BY_USER],
      [BY_USER, BY_USER],
    ] as const) {
      expect(goalOf(boardOf(removeDoneMark(marked, 2, asked)), 2)?.markRemoval).toEqual({
        ...stored,
        markedAt: 500,
      })
    }
  })

  test('a mark set after a removal is a mark again', () => {
    const marked = boardOf(markGoalDone(THREE_GOALS, 2, 'v3.2.0', 500))
    const removed = boardOf(removeDoneMark(marked, 2, BY_USER))
    const markedAgain = goalOf(boardOf(markGoalDone(removed, 2, 'v3.2.1', 700)), 2) ?? LOGIN_FIX

    expect(doneMarkOf(markedAgain)).toEqual({ evidence: 'v3.2.1', markedAt: 700 })
  })

  test('a removal of the mark shown leaves a mark set since then', () => {
    const marked = boardOf(markGoalDone(THREE_GOALS, 2, 'v3.2.0', 500))
    const markedAgain = boardOf(markGoalDone(marked, 2, 'v3.2.1', 510))

    expect(removeDoneMark(markedAgain, 2, BY_USER, 500)).toEqual({
      outcome: Outcome.Refused,
      refusal: Refusal.NotMarkedDone,
      goal: 2,
    })
    expect(removeDoneMark(marked, 2, BY_USER, 500).outcome).toBe(Outcome.Changed)
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

describe('combining two copies of a board', () => {
  test('keeps every goal added and every goal cleared in either copy', () => {
    const older = { goals: [FULL_APP, LOGIN_FIX] }
    const newer = boardOf(clearGoal(THREE_GOALS, 2, 400))

    for (const [first, second] of [[older, newer], [newer, older]] as const) {
      const combined = combinedBoardOf(first, second)

      expect(openGoalsOf(combined).map(goal => goal.id)).toEqual(
        expect.arrayContaining([FULL_APP.id, TEST_HARNESS.id]),
      )
      expect(openGoalsOf(combined)).toHaveLength(2)
      expect(goalOf(combined, 2)?.clearedAt).toBe(400)
    }
  })

  test('uses the text of the later edit of an open goal', () => {
    const edited = boardOf(editGoal(THREE_GOALS, 2, 'Fix the export timeout by Friday', 400))
    const editedAgain = boardOf(editGoal(edited, 2, 'Fix the export timeout today', 500))

    for (const [first, second] of [
      [THREE_GOALS, editedAgain],
      [editedAgain, THREE_GOALS],
      [edited, editedAgain],
      [editedAgain, edited],
    ] as const) {
      expect(goalOf(combinedBoardOf(first, second), 2)).toEqual(goalOf(editedAgain, 2))
    }
  })

  test('uses the done mark set later and the removal made later', () => {
    const marked = boardOf(markGoalDone(THREE_GOALS, 2, 'v3.2.0', 400))
    const removal = { removedAt: 500, removedBy: MarkRemover.User }
    const removed = boardOf(removeDoneMark(marked, 2, removal))
    const markedAgain = boardOf(markGoalDone(removed, 2, 'v3.2.1', 600))

    for (const [older, newer] of [
      [THREE_GOALS, marked],
      [marked, removed],
      [removed, markedAgain],
      [THREE_GOALS, markedAgain],
    ] as const) {
      for (const [first, second] of [[older, newer], [newer, older]] as const) {
        expect(goalOf(combinedBoardOf(first, second), 2)).toEqual(goalOf(newer, 2))
      }
    }
  })

  test('a mark set in one copy is still set when the other copy removed an older mark', () => {
    const marked = boardOf(markGoalDone(THREE_GOALS, 2, 'v3.2.0', 400))
    const removal = { removedAt: 500, removedBy: MarkRemover.User }
    const removed = boardOf(removeDoneMark(marked, 2, removal, 400))
    const markedElsewhere = boardOf(markGoalDone(marked, 2, 'v3.2.1', 450))

    for (const [first, second] of [
      [removed, markedElsewhere],
      [markedElsewhere, removed],
    ] as const) {
      const goal = goalOf(combinedBoardOf(first, second), 2) ?? LOGIN_FIX
      expect(doneMarkOf(goal)).toEqual({ evidence: 'v3.2.1', markedAt: 450 })
    }
  })
})

describe('taking back the changes of a note', () => {
  test('sets back the goals added or cleared between two copies, and keeps later changes', () => {
    const before = { goals: [FULL_APP, LOGIN_FIX] }
    const after = boardOf(clearGoal(THREE_GOALS, 2, 400))
    const later = boardOf(clearGoal(after, 1, 500))

    const takenBack = boardWithChangesTakenBack(later, before, after)

    expect(takenBack.goals.map(goal => goal.id)).toEqual([FULL_APP.id, LOGIN_FIX.id])
    expect(goalOf(takenBack, 1)?.clearedAt).toBe(500)
    expect(goalOf(takenBack, 2)?.clearedAt).toBeUndefined()
  })

  test('sets back the text of a goal edited between two copies', () => {
    const after = boardOf(editGoal(THREE_GOALS, 2, 'Fix the export timeout by Friday', 400))

    expect(boardWithChangesTakenBack(after, THREE_GOALS, after)).toEqual(THREE_GOALS)
  })

  test('sets back the done mark of a goal marked or unmarked between two copies', () => {
    const marked = boardOf(markGoalDone(THREE_GOALS, 2, 'v3.2.0', 400))
    const removal = { removedAt: 500, removedBy: MarkRemover.User }
    const removed = boardOf(removeDoneMark(marked, 2, removal))

    expect(boardWithChangesTakenBack(marked, THREE_GOALS, marked)).toEqual(THREE_GOALS)
    expect(boardWithChangesTakenBack(removed, marked, removed)).toEqual(marked)
  })
})
