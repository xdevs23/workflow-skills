import { describe, expect } from 'claude-code/testing'

import type { Goal } from '../types'
import { takeNotes } from './afterCompaction'
import type { CompactionNoteSource } from './afterCompaction'
import { goalRecordOf } from './goals/boardRecord'
import { sessionScope } from './goals/boardScope'
import { AFTER_COMPACTION } from './reminders/eventCadence'
import { enabledRecordOf, reminderRecordOf } from './reminders/reminderRecord'
import { textContainingInOrder } from './orderedTextTestSupport'
import { test } from './testDeclaration'
import {
  FIRST_SESSION,
  GOALS_NOT_EXHAUSTIVE,
  SUBAGENT,
  compact,
  promptsOfPlugin,
  startSession,
  startTurn,
} from './testSupport'

const OFFLINE_MODE: Goal = {
  id: 'goal-offline-mode',
  number: 1,
  text: 'Ship the offline mode',
  addedAt: 100,
  todos: [],
}

const READ_SPEC = 'Read .cache/specs/login-fix.md again before you go on.'

const OPEN_GOALS = [
  '# Open goals, by priority (P0 most important)',
  '1. Ship the offline mode',
  '',
  GOALS_NOT_EXHAUSTIVE,
].join('\n')

const GOALS_THEN_REMINDER = textContainingInOrder([OPEN_GOALS, READ_SPEC])

/** The records of the open goal 1 and of reminder 1, sent after a compaction and switched on. */
function storedGoalAndReminder(): Map<string, unknown> {
  const records = [
    goalRecordOf(sessionScope(FIRST_SESSION), OFFLINE_MODE),
    reminderRecordOf(FIRST_SESSION, {
      id: 'read-spec',
      number: 1,
      text: READ_SPEC,
      addedAt: 100,
      cadence: { kind: AFTER_COMPACTION.id, values: {} },
    }),
    enabledRecordOf(FIRST_SESSION, 'read-spec', true, 110),
  ]

  return new Map(records.map(record => [record.key, record.value]))
}

/** The triggers of a compaction that puts its summary in place of the conversation. */
const REPLACING_TRIGGERS = ['manual', 'auto', 'plugin'] as const

const VETO = 'The compaction is switched off.'

describe('the goals and the reminders after a compaction', () => {
  for (const trigger of REPLACING_TRIGGERS) {
    test(
      `a ${trigger} compaction during a turn adds both texts after the summary`,
      async ($, on) => {
        const session = await startSession($, on, { stored: storedGoalAndReminder() })
        await startTurn($)

        expect(await compact($, { trigger })).toEqual([GOALS_THEN_REMINDER])
        await session.clock.settle()
        expect(promptsOfPlugin(session)).toEqual([])
        expect(session.chatLines).toEqual([])
      },
    )

    test(
      `a ${trigger} compaction while no turn runs submits one prompt with both texts`,
      async ($, on) => {
        const session = await startSession($, on, { stored: storedGoalAndReminder() })

        expect(await compact($, { trigger })).toEqual([])
        await session.clock.settle()
        expect(promptsOfPlugin(session)).toEqual([GOALS_THEN_REMINDER])
        expect(session.chatLines).toEqual([])
      },
    )
  }

  test(
    'a compaction of a subagent or a workflow agent sends nothing and shows no line',
    async ($, on) => {
      const session = await startSession($, on, { stored: storedGoalAndReminder() })

      expect(await compact($, { agentId: SUBAGENT })).toEqual([])
      await startTurn($)
      expect(await compact($, { agentId: SUBAGENT })).toEqual([])
      await session.clock.settle()
      expect(promptsOfPlugin(session)).toEqual([])
      expect(session.chatLines).toEqual([])
    },
  )

  test(
    'a compaction of the main conversation after one of an agent adds both texts',
    async ($, on) => {
      await startSession($, on, { stored: storedGoalAndReminder() })
      await startTurn($)
      await compact($, { agentId: SUBAGENT })

      expect(await compact($)).toEqual([GOALS_THEN_REMINDER])
    },
  )

  test(
    'a compaction skipped by a hook beneath sends nothing, and the next compaction adds both texts',
    async ($, on) => {
      on('session.compact', { trigger: 'auto' }, () => ({ skip: VETO }))
      const session = await startSession($, on, { stored: storedGoalAndReminder() })

      await expect(compact($)).rejects.toThrow(VETO)
      await session.clock.settle()
      await startTurn($)
      await expect(compact($)).rejects.toThrow(VETO)
      expect(promptsOfPlugin(session)).toEqual([])
      expect(session.chatLines).toEqual([])
      expect(await compact($, { trigger: 'manual' })).toEqual([GOALS_THEN_REMINDER])
    },
  )

  test('a summary computed ahead of time sends nothing and shows no line', async ($, on) => {
    const session = await startSession($, on, { stored: storedGoalAndReminder() })
    await startTurn($)

    expect(await compact($, { trigger: 'precompute' })).toEqual([])
    await session.clock.settle()
    expect(promptsOfPlugin(session)).toEqual([])
    expect(session.chatLines).toEqual([])
  })

  test('a source that fails puts back the notes taken by the other sources', async () => {
    const restored: string[] = []
    const taken: CompactionNoteSource = {
      takeNote: () =>
        Promise.resolve({
          text: OPEN_GOALS,
          restore: () => {
            restored.push(OPEN_GOALS)

            return Promise.resolve()
          },
        }),
      describeNotSent: reason => reason,
    }
    const failing: CompactionNoteSource = {
      takeNote: () => Promise.reject(new Error('store unreadable')),
      describeNotSent: reason => reason,
    }

    await expect(takeNotes([taken, failing])).rejects.toThrow('store unreadable')
    expect(restored).toEqual([OPEN_GOALS])
  })
})
