import { describe, expect } from 'claude-code/testing'

import type { Board, Goal } from '../../types'
import { test } from '../testDeclaration'
import { EMPTY_BOARD } from './board'
import { MarkRemover } from './doneMark'
import type { MarkRemovalAsked } from './doneMark'
import {
  describeGoalChangesSent,
  describeOpenGoalsAfterCompaction,
  describeOpenGoalsAfterIdle,
  describeOpenGoalsSent,
} from './goalReminders'
import type { Priority } from './priority'

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

function unmarkedBy(asked: MarkRemovalAsked, goal: Goal): Goal {
  return { ...markedDone(goal), markRemoval: { markedAt: 800, removedAt: 850, ...asked } }
}

function prioritized(goal: Goal, priority: Priority): Goal {
  return { ...goal, prioritySetting: { value: priority, setAt: 700 } }
}

function withPriorityRemoved(goal: Goal): Goal {
  return { ...goal, prioritySetting: { setAt: 750 } }
}

function dependingOn(goal: Goal, dependsOn: Goal): Goal {
  return { ...goal, dependencySetting: { value: dependsOn.id, setAt: 760 } }
}

/** Goal 2 at P0, goals 1 and 3 at P1, and goal 4 without a priority, listed out of that order. */
const PRIORITIZED_GOALS: Board = {
  goals: [
    { ...NIGHTLY_BUILD, number: 4, id: 'unprioritized', todos: [] },
    prioritized(NIGHTLY_BUILD, 1),
    prioritized(HELP_PAGES, 0),
    prioritized(INVOICE_EXPORT, 1),
  ],
}

/** `text` without its first line, the heading of the open goals. */
function withoutHeading(text: string | undefined): string | undefined {
  return text?.split('\n').slice(1).join('\n')
}

/** `text` without its first paragraph, the opening that tells the model to work on the goals. */
function withoutOpening(text: string | undefined): string | undefined {
  return text?.split('\n\n').slice(1).join('\n\n')
}

/**
 * The goals are listed out of number order, so a test catches output that keeps the input order.
 */
const THREE_GOALS: Board = { goals: [NIGHTLY_BUILD, INVOICE_EXPORT, HELP_PAGES] }

const ALL_CLEARED: Board = { goals: THREE_GOALS.goals.map(cleared) }

describe('the open goals after a compaction', () => {
  test('lists each open goal in number order, with its TODO entries under it', () => {
    const board = { goals: [NIGHTLY_BUILD, INVOICE_EXPORT, cleared(HELP_PAGES)] }

    expect(withoutHeading(describeOpenGoalsAfterCompaction(board))).toBe(
      [
        '1. Ship the invoice export',
        '   #57 - Export names the currency',
        '   #12 - Export writes one file per month',
        '3. Speed up the nightly build',
      ].join('\n'),
    )
  })

  test('shows the done mark of a goal above its TODO entries, and leaves out a removed one', () => {
    const unmarked = unmarkedBy({ removedBy: MarkRemover.User }, NIGHTLY_BUILD)
    const board = { goals: [markedDone(INVOICE_EXPORT), unmarked] }

    expect(withoutHeading(describeOpenGoalsAfterCompaction(board))).toBe(
      [
        '1. Ship the invoice export',
        '   Marked as done by you: release/v2.4.0',
        '   #57 - Export names the currency',
        '   #12 - Export writes one file per month',
        '3. Speed up the nightly build',
      ].join('\n'),
    )
  })

  test('indents the TODO entries attached to goal 12 below its text', () => {
    const board = { goals: [{ ...HELP_PAGES, number: 12 }] }

    expect(withoutHeading(describeOpenGoalsAfterCompaction(board))).toBe(
      [
        '12. Translate the help pages',
        '    #20.1 - Help pages load the chosen language',
      ].join('\n'),
    )
  })

  test('lists the goals by priority, by number within one priority, and without one last', () => {
    const lines = describeOpenGoalsAfterCompaction(PRIORITIZED_GOALS)?.split('\n') ?? []

    expect(lines.flatMap(line => /^(\d+)\. /.exec(line)?.[1] ?? [])).toEqual(['2', '1', '3', '4'])
  })

  test('is left out for a board without open goals', () => {
    expect(describeOpenGoalsAfterCompaction(EMPTY_BOARD)).toBeUndefined()
    expect(describeOpenGoalsAfterCompaction(ALL_CLEARED)).toBeUndefined()
  })
})

describe('the open goals after idle minutes', () => {
  test('writes one paragraph per open goal in number order, with its TODO entries attached', () => {
    expect(withoutOpening(describeOpenGoalsAfterIdle(THREE_GOALS))).toBe(
      [
        'Goal 1 is not satisfied yet: Ship the invoice export. Attached: #57 (Export names the ' +
          'currency), #12 (Export writes one file per month).',
        'Goal 2 is not satisfied yet: Translate the help pages. Attached: #20.1 (Help pages ' +
          'load the chosen language).',
        'Goal 3 is not satisfied yet: Speed up the nightly build.',
      ].join('\n\n'),
    )
  })

  test('asks for the work while one open goal is not marked as done', () => {
    const board = { goals: [markedDone(INVOICE_EXPORT), NIGHTLY_BUILD] }

    expect(describeOpenGoalsAfterIdle(board)?.split('\n\n')).toHaveLength(3)
  })

  test('reminds of goals that are all marked as done without asking for more work', () => {
    const board = { goals: [markedDone(INVOICE_EXPORT), markedDone(NIGHTLY_BUILD)] }

    expect(describeOpenGoalsAfterIdle(board)).toBe(
      [
        'Goal 1 is not satisfied yet: Ship the invoice export. Marked as done by you: ' +
          'release/v2.4.0. Attached: #57 (Export names the currency), #12 (Export writes one ' +
          'file per month).',
        'Goal 3 is not satisfied yet: Speed up the nightly build. Marked as done by you: ' +
          'release/v2.4.0.',
      ].join('\n\n'),
    )
  })

  test('does not add a second stop to a goal whose text ends a sentence', () => {
    const board = { goals: [{ ...NIGHTLY_BUILD, text: 'Is the nightly build fast enough?' }] }

    expect(withoutOpening(describeOpenGoalsAfterIdle(board))).toBe(
      [
        'Goal 3 is not satisfied yet: Is the nightly build fast enough?',
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
      text: 'The user added Goal 3: Speed up the nightly build.',
      line: 'Goals: Goal 3 added, sent to Claude',
    })
  })

  test('shows a goal cleared since', () => {
    const now = { goals: [NIGHTLY_BUILD, INVOICE_EXPORT, cleared(HELP_PAGES)] }

    expect(describeGoalChangesSent(THREE_GOALS, now)).toEqual({
      text: 'The user cleared Goal 2.',
      line: 'Goals: Goal 2 cleared, sent to Claude',
    })
  })

  test('shows a goal edited since with its new text', () => {
    const edited = { ...HELP_PAGES, text: 'Translate the help' }
    const now = { goals: [NIGHTLY_BUILD, INVOICE_EXPORT, edited] }

    expect(describeGoalChangesSent(THREE_GOALS, now)).toEqual({
      text: 'The user edited Goal 2: Translate the help.',
      line: 'Goals: Goal 2 edited, sent to Claude',
    })
  })

  test('shows a goal edited since with its new text and the done mark removed by the edit', () => {
    const edited = {
      ...unmarkedBy({ removedBy: MarkRemover.User }, HELP_PAGES),
      text: 'Translate the help',
    }
    const seen = { goals: [NIGHTLY_BUILD, INVOICE_EXPORT, markedDone(HELP_PAGES)] }
    const now = { goals: [NIGHTLY_BUILD, INVOICE_EXPORT, edited] }

    expect(describeGoalChangesSent(seen, now)).toEqual({
      text:
        'The user edited Goal 2: Translate the help. The user removed your done mark from ' +
        'Goal 2.',
      line: 'Goals: Goal 2 edited and Goal 2 unmarked, sent to Claude',
    })
  })

  test('shows a done mark removed by the user since, and leaves out changes of the model', () => {
    const seen = { goals: [markedDone(INVOICE_EXPORT), HELP_PAGES, markedDone(NIGHTLY_BUILD)] }
    const now = {
      goals: [
        unmarkedBy({ removedBy: MarkRemover.User }, INVOICE_EXPORT),
        markedDone(HELP_PAGES),
        unmarkedBy({ removedBy: MarkRemover.Model }, NIGHTLY_BUILD),
      ],
    }

    expect(describeGoalChangesSent(seen, now)).toEqual({
      text: 'The user removed your done mark from Goal 1.',
      line: 'Goals: Goal 1 unmarked, sent to Claude',
    })
    expect(describeGoalChangesSent(now, now)).toBeUndefined()
  })

  test('shows the reason given by the user for a removed done mark', () => {
    const withReason = unmarkedBy(
      { removedBy: MarkRemover.User, reason: 'The export misses the March invoices' },
      INVOICE_EXPORT,
    )
    const seen = { goals: [markedDone(INVOICE_EXPORT)] }

    expect(describeGoalChangesSent(seen, { goals: [withReason] })).toEqual({
      text:
        'The user removed your done mark from Goal 1, with the reason: The export misses the ' +
        'March invoices.',
      line: 'Goals: Goal 1 unmarked, sent to Claude',
    })
  })

  test('shows a done mark removed by the user also after the model marked the goal again', () => {
    const markedAgain = {
      ...unmarkedBy({ removedBy: MarkRemover.User }, INVOICE_EXPORT),
      doneMark: { evidence: 'release/v2.4.1', markedAt: 870 },
    }

    const seen = { goals: [markedDone(INVOICE_EXPORT)] }

    expect(describeGoalChangesSent(seen, { goals: [markedAgain] })).toEqual({
      text: 'The user removed your done mark from Goal 1.',
      line: 'Goals: Goal 1 unmarked, sent to Claude',
    })
  })

  test('shows a priority set, changed or removed since', () => {
    const seen = {
      goals: [INVOICE_EXPORT, prioritized(HELP_PAGES, 2), prioritized(NIGHTLY_BUILD, 0)],
    }
    const now = {
      goals: [
        prioritized(INVOICE_EXPORT, 1),
        prioritized(HELP_PAGES, 0),
        withPriorityRemoved(NIGHTLY_BUILD),
      ],
    }

    expect(describeGoalChangesSent(seen, now)).toEqual({
      text:
        'The user set the priority of Goal 1 to P1. The user set the priority of Goal 2 to P0. ' +
        'The user removed the priority of Goal 3.',
      line:
        'Goals: Goal 1 priority set, Goal 2 priority set, and Goal 3 priority removed, sent to ' +
        'Claude',
    })
  })

  test('is left out for a priority set again to the priority the model saw', () => {
    const setAgain: Goal = { ...INVOICE_EXPORT, prioritySetting: { value: 1, setAt: 790 } }

    expect(
      describeGoalChangesSent({ goals: [prioritized(INVOICE_EXPORT, 1)] }, { goals: [setAgain] }),
    ).toBeUndefined()
  })

  test('shows that no goal is open once the last open goal is cleared', () => {
    const seen = { goals: [cleared(NIGHTLY_BUILD), cleared(INVOICE_EXPORT), HELP_PAGES] }

    expect(describeGoalChangesSent(seen, ALL_CLEARED)).toEqual({
      text: 'The user cleared Goal 2. No goal is open now.',
      line: 'Goals: Goal 2 cleared, sent to Claude',
    })
  })

  test('shows several changes in number order', () => {
    const seen = { goals: [INVOICE_EXPORT] }
    const now = { goals: [cleared(INVOICE_EXPORT), NIGHTLY_BUILD, HELP_PAGES] }

    expect(describeGoalChangesSent(seen, now)).toEqual({
      text:
        'The user cleared Goal 1. The user added Goal 2: Translate the help pages. ' +
        'The user added Goal 3: Speed up the nightly build.',
      line: 'Goals: Goal 1 cleared, Goal 2 added, and Goal 3 added, sent to Claude',
    })
  })

  test('shows a goal added and cleared since as both', () => {
    expect(describeGoalChangesSent(EMPTY_BOARD, { goals: [cleared(INVOICE_EXPORT)] })).toEqual({
      text:
        'The user added Goal 1: Ship the invoice export. The user cleared Goal 1. ' +
        'No goal is open now.',
      line: 'Goals: Goal 1 added and Goal 1 cleared, sent to Claude',
    })
  })

  test('lists the open goals to a model that saw no board yet', () => {
    const sent = describeGoalChangesSent(null, { goals: [INVOICE_EXPORT] })

    expect({ ...sent, text: withoutHeading(sent?.text) }).toEqual({
      text: [
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

    const sent = describeOpenGoalsSent(now, seen, describeOpenGoalsAfterIdle)

    expect({ ...sent, text: withoutOpening(sent?.text) }).toEqual({
      text: [
        'Goal 1 is not satisfied yet: Ship the invoice export. Attached: #57 (Export names the ' +
          'currency), #12 (Export writes one file per month).',
        'Goal 3 is not satisfied yet: Speed up the nightly build.',
        'The user cleared Goal 2. The user added Goal 3: Speed up the nightly build.',
      ].join('\n\n'),
      line: 'Goals: the 2 open goals were sent to Claude, with Goal 2 cleared and Goal 3 added',
    })
  })

  test('names the changes alone once no goal is open', () => {
    const seen = { goals: [INVOICE_EXPORT] }

    expect(
      describeOpenGoalsSent({ goals: [cleared(INVOICE_EXPORT)] }, seen, describeOpenGoalsAfterIdle),
    ).toEqual({
      text: 'The user cleared Goal 1. No goal is open now.',
      line: 'Goals: Goal 1 cleared, sent to Claude',
    })
  })

  test('is left out for a board without open goals or changes', () => {
    expect(describeOpenGoalsSent(ALL_CLEARED, null, describeOpenGoalsAfterIdle)).toBeUndefined()
  })
})

describe('the dependencies of the goals', () => {
  /** Goal 2 at P0, goal 3 at P1, and goal 1 depending on goal 2. */
  const DEPENDENT_GOALS: Board = {
    goals: [
      dependingOn(INVOICE_EXPORT, HELP_PAGES),
      prioritized(HELP_PAGES, 0),
      prioritized(NIGHTLY_BUILD, 1),
    ],
  }

  /** The lines of goal `number` in the block after a compaction, and its idle paragraph. */
  function partsOf(board: Board, number: number): string[] {
    const block = describeOpenGoalsAfterCompaction(board) ?? ''
    const paragraphs = describeOpenGoalsAfterIdle(board)?.split('\n\n') ?? []
    const lines = block.slice(block.indexOf(`\n${number}. `) + 1).split(/\n(?=\d+\. )/)[0] ?? ''

    return [lines, paragraphs.find(paragraph => paragraph.startsWith(`Goal ${number} `)) ?? '']
  }

  test('the lists name the dependency of a goal with the goal', () => {
    for (const part of partsOf(DEPENDENT_GOALS, 1)) {
      expect(part).toContain('Goal 2')
    }
  })

  test('a dependency on a goal marked as done or cleared is not named', () => {
    for (const done of [markedDone(HELP_PAGES), cleared(HELP_PAGES)]) {
      for (const part of partsOf({ goals: [dependingOn(NIGHTLY_BUILD, HELP_PAGES), done] }, 3)) {
        expect(part).not.toContain('Goal 2')
      }
    }
  })

  test('notes a dependency set or removed since', () => {
    const seen = { goals: [INVOICE_EXPORT, HELP_PAGES, dependingOn(NIGHTLY_BUILD, HELP_PAGES)] }
    const now = {
      goals: [
        dependingOn(INVOICE_EXPORT, HELP_PAGES),
        HELP_PAGES,
        { ...NIGHTLY_BUILD, dependencySetting: { setAt: 770 } },
      ],
    }

    expect(describeGoalChangesSent(seen, now)).toEqual({
      text: 'The user made Goal 1 depend on Goal 2. The user removed the dependency of Goal 3.',
      line: 'Goals: Goal 1 dependency set and Goal 3 dependency removed, sent to Claude',
    })
  })

  test('notes a done mark removed since the goal depended on was not marked as done', () => {
    const dependent = dependingOn(INVOICE_EXPORT, HELP_PAGES)
    const seen = { goals: [markedDone(dependent), markedDone(HELP_PAGES)] }
    const now = {
      goals: [
        unmarkedBy({ removedBy: MarkRemover.Dependency, dependencyNumber: 2 }, dependent),
        unmarkedBy({ removedBy: MarkRemover.User }, HELP_PAGES),
      ],
    }

    expect(describeGoalChangesSent(seen, now)).toEqual({
      text:
        'Your done mark on Goal 1 was removed, since Goal 1 depends on Goal 2, which was not ' +
        'marked as done. The user removed your done mark from Goal 2.',
      line: 'Goals: Goal 1 unmarked and Goal 2 unmarked, sent to Claude',
    })
  })
})
