import { describe, expect } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { test } from '../testDeclaration'
import type { Reminder } from '../../types'
import {
  FIRST_SESSION,
  compact,
  promptsOfPlugin,
  startSession,
  startTurn,
  typePrompt,
} from '../testSupport'
import type { Session } from '../testSupport'
import type { CadenceKind } from './cadenceKind'
import { AFTER_BACKGROUND_TASK, AFTER_COMPACTION } from './eventCadence'
import { enabledRecordOf, reminderRecordOf } from './reminderRecord'

const START_BUILD = "Start a build whenever it's ready."
const READ_SPEC = 'Read .cache/specs/login-fix.md again before you go on.'
const CHECK_CI = 'Check the CI run of PR #318 and fix what fails.'

type StoredReminder = Pick<Reminder, 'id' | 'text' | 'isEnabled'> & {
  kind: CadenceKind<undefined, never>
}

/** Reminder 1 after a background task, reminder 2 after a compaction, both switched on. */
const BOTH_ON: readonly StoredReminder[] = [
  { id: 'start-build', text: START_BUILD, kind: AFTER_BACKGROUND_TASK, isEnabled: true },
  { id: 'read-spec', text: READ_SPEC, kind: AFTER_COMPACTION, isEnabled: true },
]

/** The records of `reminders` in FIRST_SESSION, numbered in the order given. */
function storedRemindersOf(reminders: readonly StoredReminder[]): Map<string, unknown> {
  const records = reminders.flatMap(({ id, text, kind, isEnabled }, index) => [
    reminderRecordOf(FIRST_SESSION, {
      id,
      number: index + 1,
      text,
      addedAt: 100 * (index + 1),
      cadence: { kind: kind.id, values: {} },
    }),
    enabledRecordOf(FIRST_SESSION, id, isEnabled, 100 * (index + 1) + 10),
  ])

  return new Map(records.map(record => [record.key, record.value]))
}

function notifyTaskEnded($: Engine) {
  return $.prompt.submit({
    text: 'Agent "Run the connected tests" completed',
    origin: { kind: 'task-notification' },
    wait: false,
  })
}

/** The toast for the reminders after a compaction left unsent, with any reason. */
const NOT_SENT_TOAST = new RegExp(
  String.raw`^The reminders set to come after a compaction could not be sent to Claude: .+\. ` +
    String.raw`Open /reminders and send their texts to Claude in a prompt\.$`,
  'u',
)

/** The transcript lines about the reminders, which the model does not read. */
function reminderLinesOf(session: Session): string[] {
  return session.chatLines.filter(line => line.startsWith('Reminders: '))
}

describe('the reminders sent after a background task', () => {
  test(
    'the notification of a task that ended carries the texts of those switched on',
    async ($, on) => {
      const session = await startSession($, on, {
        stored: storedRemindersOf([
          ...BOTH_ON,
          { id: 'check-ci', text: CHECK_CI, kind: AFTER_BACKGROUND_TASK, isEnabled: true },
        ]),
      })

      expect((await notifyTaskEnded($)).context).toEqual([
        `Reminder from the user: ${START_BUILD}\n\nReminder from the user: ${CHECK_CI}`,
      ])
      expect(reminderLinesOf(session)).toEqual(['Reminders: reminders 1 and 3 sent to Claude'])
    },
  )

  test('a prompt typed by the user carries no reminder', async ($, on) => {
    const session = await startSession($, on, { stored: storedRemindersOf(BOTH_ON) })

    expect((await typePrompt($, 'go on')).context).toBeUndefined()
    expect(reminderLinesOf(session)).toEqual([])
  })

  test('a reminder switched off is not sent', async ($, on) => {
    const session = await startSession($, on, {
      stored: storedRemindersOf([
        { id: 'start-build', text: START_BUILD, kind: AFTER_BACKGROUND_TASK, isEnabled: false },
      ]),
    })

    expect((await notifyTaskEnded($)).context).toBeUndefined()
    expect(reminderLinesOf(session)).toEqual([])
  })
})

describe('the reminders sent after a compaction', () => {
  test(
    'a compaction during a turn adds the texts of those switched on after the summary',
    async ($, on) => {
      const session = await startSession($, on, { stored: storedRemindersOf(BOTH_ON) })
      await startTurn($)

      expect(await compact($)).toEqual([`Reminder from the user: ${READ_SPEC}`])
      await session.clock.settle()
      expect(promptsOfPlugin(session)).toEqual([])
      expect(reminderLinesOf(session)).toEqual([])
    },
  )

  test(
    'a compaction while no turn runs sends the texts as a prompt that starts a turn',
    async ($, on) => {
      const session = await startSession($, on, { stored: storedRemindersOf(BOTH_ON) })

      expect(await compact($)).toEqual([])
      await session.clock.settle()
      expect(promptsOfPlugin(session)).toEqual([`Reminder from the user: ${READ_SPEC}`])
      expect(reminderLinesOf(session)).toEqual([])
    },
  )

  test(
    'a prompt dropped by the engine after a compaction shows the reason in a toast',
    async ($, on) => {
      const session = await startSession($, on, { stored: storedRemindersOf(BOTH_ON) })
      session.droppedPrompt = 'a stop hook is active'
      await compact($)
      await session.clock.settle()

      expect(promptsOfPlugin(session)).toEqual([`Reminder from the user: ${READ_SPEC}`])
      expect(session.toasts).toEqual([expect.stringMatching(NOT_SENT_TOAST)])
      expect(session.toasts[0]).toContain(': a stop hook is active.')
    },
  )

  test(
    'a prompt after a compaction that fails beneath the plugin shows the failure in a toast',
    async ($, on) => {
      on('prompt.submit', { origin: { kind: 'plugin' } }, () => {
        throw new Error('failed in a test hook')
      })
      const session = await startSession($, on, { stored: storedRemindersOf(BOTH_ON) })
      await compact($)
      await session.clock.settle()

      expect(session.toasts).toEqual([expect.stringMatching(NOT_SENT_TOAST)])
    },
  )
})
