import { describe, expect } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import type { Goal } from '../types'
import { takeNotes } from './afterCompaction'
import type { CompactionNoteSource } from './afterCompaction'
import { goalRecordOf } from './goals/boardRecord'
import { sessionScope } from './goals/boardScope'
import { AFTER_COMPACTION } from './reminders/eventCadence'
import { enabledRecordOf, reminderRecordOf } from './reminders/reminderRecord'
import { test } from './testDeclaration'
import {
  FIRST_SESSION,
  GOALS_NOT_EXHAUSTIVE,
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

const REMINDER = `Reminder from the user: ${READ_SPEC}`

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

function compact($: Engine) {
  return $.classic.SessionStart({ source: 'compact' })
}

describe('the goals and the reminders after a compaction', () => {
  test(
    'a compaction during a turn adds both texts to the context and shows both lines',
    async ($, on) => {
      const session = await startSession($, on, { stored: storedGoalAndReminder() })
      await startTurn($)

      expect((await compact($)).additionalContext).toEqual([OPEN_GOALS, REMINDER])
      await session.clock.settle()
      expect(promptsOfPlugin(session)).toEqual([])
      expect(session.chatLines).toEqual(
        expect.arrayContaining([
          'Goals: the open goal was sent to Claude',
          'Reminders: reminder 1 sent to Claude',
        ]),
      )
    },
  )

  test(
    'a compaction while no turn runs submits one prompt that carries both texts',
    async ($, on) => {
      const session = await startSession($, on, { stored: storedGoalAndReminder() })

      expect((await compact($)).additionalContext).toBeUndefined()
      await session.clock.settle()
      expect(promptsOfPlugin(session)).toEqual([`${OPEN_GOALS}\n\n${REMINDER}`])
    },
  )

  test('a source that fails puts back the notes taken by the other sources', async () => {
    const restored: string[] = []
    const taken: CompactionNoteSource = {
      takeNote: () =>
        Promise.resolve({
          text: OPEN_GOALS,
          line: 'Goals: the open goal was sent to Claude',
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
