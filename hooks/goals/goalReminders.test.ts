import { describe, expect, test } from 'claude-code/testing'

import type { Board, Goal } from '../../types'
import { EMPTY_BOARD } from './board'
import {
  describeGoalChanges,
  describeOpenGoalsAfterCompaction,
  describeOpenGoalsAfterIdle,
} from './goalReminders'

const INVOICE_EXPORT: Goal = {
  id: 'invoice-export',
  number: 1,
  text: 'Ship the invoice export',
  addedAt: 100,
  todos: [
    { number: '57', title: 'Export names the currency', attachedAt: 120 },
    { number: '12', title: 'Export writes one file per month', attachedAt: 130 },
  ],
}
const HELP_PAGES: Goal = {
  id: 'help-pages',
  number: 2,
  text: 'Translate the help pages',
  addedAt: 200,
  todos: [{ number: '20.1', title: 'Help pages load the chosen language', attachedAt: 210 }],
}
const NIGHTLY_BUILD: Goal = {
  id: 'nightly-build',
  number: 3,
  text: 'Speed up the nightly build',
  addedAt: 300,
  todos: [],
}

function cleared(goal: Goal): Goal {
  return { ...goal, clearedAt: 900 }
}

/** The goals are listed out of number order, so a test catches output that keeps the input order. */
const THREE_GOALS: Board = { goals: [NIGHTLY_BUILD, INVOICE_EXPORT, HELP_PAGES] }

const ALL_CLEARED: Board = { goals: THREE_GOALS.goals.map(cleared) }

describe('the open goals after a compaction', () => {
  test('lists each open goal in number order, with its TODO entries under it', () => {
    const board = { goals: [NIGHTLY_BUILD, INVOICE_EXPORT, cleared(HELP_PAGES)] }

    expect(describeOpenGoalsAfterCompaction(board)).toBe(
      [
        '# Open goals',
        '1. Ship the invoice export',
        '   #57 - Export names the currency',
        '   #12 - Export writes one file per month',
        '3. Speed up the nightly build',
      ].join('\n'),
    )
  })

  test('indents the TODO entries of goal #12 to its text', () => {
    const board = { goals: [{ ...HELP_PAGES, number: 12 }] }

    expect(describeOpenGoalsAfterCompaction(board)).toBe(
      [
        '# Open goals',
        '12. Translate the help pages',
        '    #20.1 - Help pages load the chosen language',
      ].join('\n'),
    )
  })

  test('is left out for a board without open goals', () => {
    expect(describeOpenGoalsAfterCompaction(EMPTY_BOARD)).toBeUndefined()
    expect(describeOpenGoalsAfterCompaction(ALL_CLEARED)).toBeUndefined()
  })
})

describe('the open goals after idle minutes', () => {
  test('writes one paragraph per open goal in number order, with its TODO entries attached', () => {
    expect(describeOpenGoalsAfterIdle(THREE_GOALS)).toBe(
      [
        'Goal #1 is not satisfied yet: Ship the invoice export. Attached: #57 (Export names the ' +
          'currency), #12 (Export writes one file per month).',
        'Goal #2 is not satisfied yet: Translate the help pages. Attached: #20.1 (Help pages ' +
          'load the chosen language).',
        'Goal #3 is not satisfied yet: Speed up the nightly build.',
      ].join('\n\n'),
    )
  })

  test('does not add a second stop to a goal whose text ends a sentence', () => {
    const board = { goals: [{ ...NIGHTLY_BUILD, text: 'Is the nightly build fast enough?' }] }

    expect(describeOpenGoalsAfterIdle(board)).toBe(
      'Goal #3 is not satisfied yet: Is the nightly build fast enough?',
    )
  })

  test('is left out for a board without open goals', () => {
    expect(describeOpenGoalsAfterIdle(EMPTY_BOARD)).toBeUndefined()
    expect(describeOpenGoalsAfterIdle(ALL_CLEARED)).toBeUndefined()
  })
})

describe('the changes to the board since the model saw it', () => {
  test('shows a goal added since', () => {
    const seen = { goals: [INVOICE_EXPORT, HELP_PAGES] }

    expect(describeGoalChanges(seen, THREE_GOALS)).toBe(
      'The user added goal #3: Speed up the nightly build.',
    )
  })

  test('shows a goal cleared since', () => {
    const now = { goals: [NIGHTLY_BUILD, INVOICE_EXPORT, cleared(HELP_PAGES)] }

    expect(describeGoalChanges(THREE_GOALS, now)).toBe('The user cleared goal #2.')
  })

  test('shows that no goal is open once the last open goal is cleared', () => {
    const seen = { goals: [cleared(NIGHTLY_BUILD), cleared(INVOICE_EXPORT), HELP_PAGES] }

    expect(describeGoalChanges(seen, ALL_CLEARED)).toBe(
      'The user cleared goal #2. No goal is open now.',
    )
  })

  test('shows several changes in number order', () => {
    const seen = { goals: [INVOICE_EXPORT] }
    const now = { goals: [cleared(INVOICE_EXPORT), NIGHTLY_BUILD, HELP_PAGES] }

    expect(describeGoalChanges(seen, now)).toBe(
      'The user cleared goal #1. The user added goal #2: Translate the help pages. ' +
        'The user added goal #3: Speed up the nightly build.',
    )
  })

  test('shows a goal added and cleared since as both', () => {
    expect(describeGoalChanges(EMPTY_BOARD, { goals: [cleared(INVOICE_EXPORT)] })).toBe(
      'The user added goal #1: Ship the invoice export. The user cleared goal #1. ' +
        'No goal is open now.',
    )
  })

  test('is left out when goals were neither added nor cleared', () => {
    const detached = { goals: [NIGHTLY_BUILD, INVOICE_EXPORT, { ...HELP_PAGES, todos: [] }] }

    expect(describeGoalChanges(THREE_GOALS, THREE_GOALS)).toBeUndefined()
    expect(describeGoalChanges(THREE_GOALS, detached)).toBeUndefined()
    expect(describeGoalChanges(ALL_CLEARED, ALL_CLEARED)).toBeUndefined()
  })
})
