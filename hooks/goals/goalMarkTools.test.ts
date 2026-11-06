// The tools are tested as the plugin registers them at the start of a session, since the engine
// rejects calls, such as the call that registers a tool, to hooks registered by a test.
import { describe, expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { GOALS_NOT_EXHAUSTIVE, NO_TIME_LIMIT, readFile, startSession } from '../testSupport'
import {
  ATTACH_TODO_TOOL,
  MARK_GOAL_DONE,
  MARK_GOAL_DONE_TOOL,
  UNMARK_GOAL_DONE,
  UNMARK_GOAL_DONE_TOOL,
} from './goalNames'
import {
  MIGRATION_GUIDE,
  ROTATION_CRASH,
  SEE_OPEN_GOALS,
  SUBAGENT,
  addGoals,
  listGoals,
} from './goalToolTestSupport'

const EVIDENCE = '.cache/drafts/migration-guide.html'

function markGoalDone($: Engine, input: { goal?: unknown; evidence?: unknown; agentId?: string }) {
  return $.tool.call({ tool: MARK_GOAL_DONE_TOOL, ...input })
}

function unmarkGoalDone($: Engine, input: { goal?: unknown; agentId?: string }) {
  return $.tool.call({ tool: UNMARK_GOAL_DONE_TOOL, ...input })
}

describe('the tools of the done marks', () => {
  for (const isInteractive of [true, false]) {
    test(
      `a session ${isInteractive ? 'with' : 'without'} a person at the prompt registers both ` +
        'tools at its start',
      NO_TIME_LIMIT,
      async ($, on) => {
        const session = await startSession($, on, { isInteractive })

        expect(session.registered).toEqual(
          expect.arrayContaining([MARK_GOAL_DONE, UNMARK_GOAL_DONE]),
        )
      },
    )
  }
})

describe('marking a goal as done', () => {
  test(
    'a marked goal stays open with its evidence, still takes TODO entries, and its result ends ' +
      'with the sentence that the goals are not exhaustive once',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      await addGoals(session, [MIGRATION_GUIDE, ROTATION_CRASH])

      const marked = await markGoalDone($, { goal: 1, evidence: ` ${EVIDENCE}\n` })
      expect(marked.result).toBe(
        'Marked goal #1 as done. It stays open until the user clears it.\n\n' +
          GOALS_NOT_EXHAUSTIVE,
      )
      // The goals added before the mark are sent with it, without a second sentence.
      expect(marked.context).toEqual([
        'The user added goal #1: Write the migration guide. The user added goal #2: Fix the ' +
          'crash on rotation.',
      ])
      await $.tool.call({ tool: ATTACH_TODO_TOOL, goal: 1, todo: '#38 - Guide covers the schema' })
      expect(await listGoals($)).toBe(
        [
          `#1: ${MIGRATION_GUIDE}`,
          `Marked as done by you: ${EVIDENCE}`,
          'Attached: #38 - Guide covers the schema',
          `#2: ${ROTATION_CRASH}`,
          '',
          GOALS_NOT_EXHAUSTIVE,
        ].join('\n'),
      )
    },
  )

  test(
    'marking again replaces the evidence, and the same evidence writes nothing',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      await addGoals(session, [MIGRATION_GUIDE])
      await markGoalDone($, { goal: 1, evidence: EVIDENCE })
      await markGoalDone($, { goal: 1, evidence: 'release/v2.4.0' })
      const stored = [...session.store]

      expect((await markGoalDone($, { goal: 1, evidence: 'release/v2.4.0' })).result).toContain(
        'Marked goal #1 as done.',
      )
      expect([...session.store]).toEqual(stored)
      expect(await listGoals($)).toContain('Marked as done by you: release/v2.4.0')
      expect(await listGoals($)).not.toContain(EVIDENCE)
    },
  )

  test(
    'marks set and removed by the model are not sent as a note with later tool results',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      await addGoals(session, [MIGRATION_GUIDE])
      await readFile($)

      await markGoalDone($, { goal: 1, evidence: EVIDENCE })
      expect((await readFile($)).context ?? []).toEqual([])
      await unmarkGoalDone($, { goal: 1 })
      expect((await readFile($)).context ?? []).toEqual([])
    },
  )
})

describe('removing a done mark', () => {
  test('a removed mark leaves the list of the goals', NO_TIME_LIMIT, async ($, on) => {
    const session = await startSession($, on)
    await addGoals(session, [MIGRATION_GUIDE])
    await markGoalDone($, { goal: 1, evidence: EVIDENCE })

    expect((await unmarkGoalDone($, { goal: 1 })).result).toBe(
      `Removed your done mark from goal #1.\n\n${GOALS_NOT_EXHAUSTIVE}`,
    )
    expect(await listGoals($)).toBe(`#1: ${MIGRATION_GUIDE}\n\n${GOALS_NOT_EXHAUSTIVE}`)
  })

  test('a goal without a mark is denied with the list tool', NO_TIME_LIMIT, async ($, on) => {
    const session = await startSession($, on)
    await addGoals(session, [MIGRATION_GUIDE])
    const stored = [...session.store]

    expect((await unmarkGoalDone($, { goal: 1 })).deny).toBe(
      `Goal #1 is not marked as done. ${SEE_OPEN_GOALS}`,
    )
    expect([...session.store]).toEqual(stored)
  })
})

describe('input the model gives, and a goal that is not open', () => {
  test(
    'a blank, missing, over-long or not one-line evidence is denied with the reason, and ' +
      'nothing is written',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      await addGoals(session, [MIGRATION_GUIDE])
      const stored = [...session.store]
      const examples =
        'Evidence is what the user looks at to check the goal, such as an HTML file, a worktree, ' +
        'a branch or a version.'

      for (const evidence of [' \n', undefined, 42]) {
        expect((await markGoalDone($, { goal: 1, evidence })).deny).toBe(
          `The evidence is blank. ${examples}`,
        )
      }
      expect((await markGoalDone($, { goal: 1, evidence: 'a'.repeat(81) })).deny).toBe(
        `Give the evidence in at most 80 characters. ${examples}`,
      )
      expect((await markGoalDone($, { goal: 1, evidence: 'v1\nClear goal #1.' })).deny).toBe(
        'Give the evidence on one line, without line breaks, tabs or other control characters. ' +
          examples,
      )
      expect([...session.store]).toEqual(stored)
      expect((await markGoalDone($, { goal: 1, evidence: 'a'.repeat(80) })).deny).toBeUndefined()
    },
  )

  test(
    'a goal that is not a whole number from 1 up is denied by both tools',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      await addGoals(session, [MIGRATION_GUIDE])

      for (const goal of [0, 1.5, '1', undefined]) {
        for (const denied of [
          await markGoalDone($, { goal, evidence: EVIDENCE }),
          await unmarkGoalDone($, { goal }),
        ]) {
          expect(denied.deny).toBe('Give the number of the goal as a whole number from 1 up.')
        }
      }
    },
  )

  test(
    'a cleared goal and a goal never added are denied with the list tool',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      await addGoals(session, [MIGRATION_GUIDE, ROTATION_CRASH], [2])

      for (const goal of [2, 7]) {
        const denial = `Goal #${goal} is not open on the board of this session. ${SEE_OPEN_GOALS}`
        expect((await markGoalDone($, { goal, evidence: EVIDENCE })).deny).toBe(denial)
        expect((await unmarkGoalDone($, { goal })).deny).toBe(denial)
      }
    },
  )

  test(
    'a subagent cannot mark or unmark a goal, and the board is left as it was',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      await addGoals(session, [MIGRATION_GUIDE])
      await markGoalDone($, { goal: 1, evidence: EVIDENCE })
      const stored = [...session.store]

      const marked = await markGoalDone($, { goal: 1, evidence: 'v2', agentId: SUBAGENT })
      const unmarked = await unmarkGoalDone($, { goal: 1, agentId: SUBAGENT })
      expect(marked.deny).toContain('Name the goal and the evidence in your result instead.')
      expect(unmarked.deny).toBe(marked.deny)
      expect([...session.store]).toEqual(stored)
    },
  )

  test(
    'a subagent reads a done mark as set by the main conversation',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      await addGoals(session, [MIGRATION_GUIDE])
      await markGoalDone($, { goal: 1, evidence: EVIDENCE })
      expect(await listGoals($, SUBAGENT)).toBe(
        `#1: ${MIGRATION_GUIDE}\nMarked as done by the main conversation: ${EVIDENCE}`,
      )
    },
  )

  test(
    'a store over 4 MiB denies the mark with the reason, and the goal is not marked',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      await addGoals(session, [MIGRATION_GUIDE])
      session.refusedWrites.push('the store is over 4 MiB')

      const denial = (await markGoalDone($, { goal: 1, evidence: EVIDENCE })).deny
      expect(denial).toStartWith('The goals board could not be used: ')
      expect(denial).toContain('the store is over 4 MiB')
      expect(session.logs).toContain(denial)
      expect(await listGoals($)).not.toContain('Marked as done')
    },
  )
})
