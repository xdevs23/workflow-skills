import { describe, expect, test } from 'claude-code/testing'

import type { Board, Goal } from '../../types'
import { EMPTY_BOARD, MarkRemover } from './board'
import {
  describeGoalChangesSent,
  describeOpenGoalsAfterCompaction,
  describeOpenGoalsAfterIdle,
  describeOpenGoalsSent,
} from './goalReminders'
import { IDLE_WITH_UNFINISHED_GOALS } from '../testSupport'

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

function markedDone(goal: Goal): Goal {
  return { ...goal, doneMark: { evidence: 'release/v2.4.0', markedAt: 800 } }
}

function unmarkedBy(removedBy: MarkRemover, goal: Goal): Goal {
  return { ...markedDone(goal), markRemoval: { markedAt: 800, removedAt: 850, removedBy } }
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

  test('shows the done mark of a goal above its TODO entries, and leaves out a removed one', () => {
    const unmarked = unmarkedBy(MarkRemover.User, NIGHTLY_BUILD)
    const board = { goals: [markedDone(INVOICE_EXPORT), unmarked] }

    expect(describeOpenGoalsAfterCompaction(board)).toBe(
      [
        '# Open goals',
        '1. Ship the invoice export',
        '   Marked as done by you: release/v2.4.0',
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
        IDLE_WITH_UNFINISHED_GOALS,
        'Goal #1 is not satisfied yet: Ship the invoice export. Attached: #57 (Export names the ' +
          'currency), #12 (Export writes one file per month).',
        'Goal #2 is not satisfied yet: Translate the help pages. Attached: #20.1 (Help pages ' +
          'load the chosen language).',
        'Goal #3 is not satisfied yet: Speed up the nightly build.',
      ].join('\n\n'),
    )
  })

  test('asks for the work while one open goal is not marked as done', () => {
    const board = { goals: [markedDone(INVOICE_EXPORT), NIGHTLY_BUILD] }

    expect(describeOpenGoalsAfterIdle(board)?.split('\n\n')[0]).toBe(IDLE_WITH_UNFINISHED_GOALS)
  })

  test('reminds of goals that are all marked as done without asking for more work', () => {
    const board = { goals: [markedDone(INVOICE_EXPORT), markedDone(NIGHTLY_BUILD)] }

    expect(describeOpenGoalsAfterIdle(board)).toBe(
      [
        'Goal #1 is not satisfied yet: Ship the invoice export. Marked as done by you: ' +
          'release/v2.4.0. Attached: #57 (Export names the currency), #12 (Export writes one ' +
          'file per month).',
        'Goal #3 is not satisfied yet: Speed up the nightly build. Marked as done by you: ' +
          'release/v2.4.0.',
      ].join('\n\n'),
    )
  })

  test('does not add a second stop to a goal whose text ends a sentence', () => {
    const board = { goals: [{ ...NIGHTLY_BUILD, text: 'Is the nightly build fast enough?' }] }

    expect(describeOpenGoalsAfterIdle(board)).toBe(
      [
        IDLE_WITH_UNFINISHED_GOALS,
        'Goal #3 is not satisfied yet: Is the nightly build fast enough?',
      ].join('\n\n'),
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

    expect(describeGoalChangesSent(seen, THREE_GOALS)).toEqual({
      text: 'The user added goal #3: Speed up the nightly build.',
      line: 'Goals: goal 3 added, sent to Claude',
    })
  })

  test('shows a goal cleared since', () => {
    const now = { goals: [NIGHTLY_BUILD, INVOICE_EXPORT, cleared(HELP_PAGES)] }

    expect(describeGoalChangesSent(THREE_GOALS, now)).toEqual({
      text: 'The user cleared goal #2.',
      line: 'Goals: goal 2 cleared, sent to Claude',
    })
  })

  test('shows a goal edited since with its new text', () => {
    const edited = { ...HELP_PAGES, text: 'Translate the help' }
    const now = { goals: [NIGHTLY_BUILD, INVOICE_EXPORT, edited] }

    expect(describeGoalChangesSent(THREE_GOALS, now)).toEqual({
      text: 'The user edited goal #2: Translate the help.',
      line: 'Goals: goal 2 edited, sent to Claude',
    })
  })

  test('shows a goal edited since with its new text and the done mark removed by the edit', () => {
    const edited = { ...unmarkedBy(MarkRemover.User, HELP_PAGES), text: 'Translate the help' }
    const seen = { goals: [NIGHTLY_BUILD, INVOICE_EXPORT, markedDone(HELP_PAGES)] }
    const now = { goals: [NIGHTLY_BUILD, INVOICE_EXPORT, edited] }

    expect(describeGoalChangesSent(seen, now)).toEqual({
      text:
        'The user edited goal #2: Translate the help. The user removed your done mark from ' +
        'goal #2.',
      line: 'Goals: goal 2 edited and goal 2 unmarked, sent to Claude',
    })
  })

  test('shows a done mark removed by the user since, and leaves out changes of the model', () => {
    const seen = { goals: [markedDone(INVOICE_EXPORT), HELP_PAGES, markedDone(NIGHTLY_BUILD)] }
    const now = {
      goals: [
        unmarkedBy(MarkRemover.User, INVOICE_EXPORT),
        markedDone(HELP_PAGES),
        unmarkedBy(MarkRemover.Model, NIGHTLY_BUILD),
      ],
    }

    expect(describeGoalChangesSent(seen, now)).toEqual({
      text: 'The user removed your done mark from goal #1.',
      line: 'Goals: goal 1 unmarked, sent to Claude',
    })
    expect(describeGoalChangesSent(now, now)).toBeUndefined()
  })

  test('shows a done mark removed by the user also after the model marked the goal again', () => {
    const markedAgain = {
      ...unmarkedBy(MarkRemover.User, INVOICE_EXPORT),
      doneMark: { evidence: 'release/v2.4.1', markedAt: 870 },
    }

    const seen = { goals: [markedDone(INVOICE_EXPORT)] }

    expect(describeGoalChangesSent(seen, { goals: [markedAgain] })).toEqual({
      text: 'The user removed your done mark from goal #1.',
      line: 'Goals: goal 1 unmarked, sent to Claude',
    })
  })

  test('shows that no goal is open once the last open goal is cleared', () => {
    const seen = { goals: [cleared(NIGHTLY_BUILD), cleared(INVOICE_EXPORT), HELP_PAGES] }

    expect(describeGoalChangesSent(seen, ALL_CLEARED)).toEqual({
      text: 'The user cleared goal #2. No goal is open now.',
      line: 'Goals: goal 2 cleared, sent to Claude',
    })
  })

  test('shows several changes in number order', () => {
    const seen = { goals: [INVOICE_EXPORT] }
    const now = { goals: [cleared(INVOICE_EXPORT), NIGHTLY_BUILD, HELP_PAGES] }

    expect(describeGoalChangesSent(seen, now)).toEqual({
      text:
        'The user cleared goal #1. The user added goal #2: Translate the help pages. ' +
        'The user added goal #3: Speed up the nightly build.',
      line: 'Goals: goal 1 cleared, goal 2 added, and goal 3 added, sent to Claude',
    })
  })

  test('shows a goal added and cleared since as both', () => {
    expect(describeGoalChangesSent(EMPTY_BOARD, { goals: [cleared(INVOICE_EXPORT)] })).toEqual({
      text:
        'The user added goal #1: Ship the invoice export. The user cleared goal #1. ' +
        'No goal is open now.',
      line: 'Goals: goal 1 added and goal 1 cleared, sent to Claude',
    })
  })

  test('lists the open goals to a model that saw no board yet', () => {
    expect(describeGoalChangesSent(null, { goals: [INVOICE_EXPORT] })).toEqual({
      text: [
        '# Open goals',
        '1. Ship the invoice export',
        '   #57 - Export names the currency',
        '   #12 - Export writes one file per month',
      ].join('\n'),
      line: 'Goals: the open goal was sent to Claude',
    })
  })

  test('is left out when goals were neither added nor cleared', () => {
    const detached = { goals: [NIGHTLY_BUILD, INVOICE_EXPORT, { ...HELP_PAGES, todos: [] }] }

    expect(describeGoalChangesSent(THREE_GOALS, THREE_GOALS)).toBeUndefined()
    expect(describeGoalChangesSent(THREE_GOALS, detached)).toBeUndefined()
    expect(describeGoalChangesSent(ALL_CLEARED, ALL_CLEARED)).toBeUndefined()
    expect(describeGoalChangesSent(null, ALL_CLEARED)).toBeUndefined()
  })
})

describe('the open goals sent with the changes since the model saw the board', () => {
  test('names the open goals and the changes sent with them in one line', () => {
    const seen = { goals: [INVOICE_EXPORT, HELP_PAGES] }
    const now = { goals: [INVOICE_EXPORT, cleared(HELP_PAGES), NIGHTLY_BUILD] }

    expect(describeOpenGoalsSent(now, seen, describeOpenGoalsAfterIdle)).toEqual({
      text: [
        IDLE_WITH_UNFINISHED_GOALS,
        'Goal #1 is not satisfied yet: Ship the invoice export. Attached: #57 (Export names the ' +
          'currency), #12 (Export writes one file per month).',
        'Goal #3 is not satisfied yet: Speed up the nightly build.',
        'The user cleared goal #2. The user added goal #3: Speed up the nightly build.',
      ].join('\n\n'),
      line: 'Goals: the 2 open goals were sent to Claude, with goal 2 cleared and goal 3 added',
    })
  })

  test('names the changes alone once no goal is open', () => {
    const seen = { goals: [INVOICE_EXPORT] }

    expect(
      describeOpenGoalsSent({ goals: [cleared(INVOICE_EXPORT)] }, seen, describeOpenGoalsAfterIdle),
    ).toEqual({
      text: 'The user cleared goal #1. No goal is open now.',
      line: 'Goals: goal 1 cleared, sent to Claude',
    })
  })

  test('is left out for a board without open goals or changes', () => {
    expect(describeOpenGoalsSent(ALL_CLEARED, null, describeOpenGoalsAfterIdle)).toBeUndefined()
  })
})
