import { describe, expect } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { test } from '../testDeclaration'
import type { Cadence } from '../../types'
import { EVERY_EVENT } from '../everyEvent'
import {
  FIRST_SESSION,
  mountPane,
  SECOND_SESSION,
  SUBAGENT,
  endTurn,
  notesOfToolResult,
  promptsOfPlugin,
  startSession,
  startTurn,
  switchSession,
} from '../testSupport'
import type { Session } from '../testSupport'
import { firstDueTimeAfter } from '../timedWork'
import { REMINDERS_COMMAND, REMINDERS_PANE } from './reminderNames'
import { enabledRecordOf, reminderRecordOf, removalRecordOf } from './reminderRecord'
import { TIME_KIND, TimeUnit } from './timeKind'

const MINUTE = 60_000
const HOUR = 60 * MINUTE

/** The longest wait a timer of the engine holds, which the mock clock does not enforce. */
const LONGEST_TIMER_WAIT = 2_147_483_647

/** The time of the mock clock when the test session starts, at which the reminders were added. */
const NOW = 1000

const CHECK_CI = 'Check the CI run of PR #318 and fix what fails.'
const UPDATE_SPEC = 'Update .cache/specs/login-fix.md with what is done.'
const READ_SPEC = 'Read .cache/specs/login-fix.md again before you go on.'

const EVERY_HOUR: Cadence = { kind: TIME_KIND.id, values: { amount: '1', unit: TimeUnit.Hours } }

function noteOf(text: string): string {
  return `Reminder from the user: ${text}`
}

/** The records of the reminders `reminders` of FIRST_SESSION, added at NOW. */
function storedReminders(
  reminders: readonly { id: string; text: string; cadence: Cadence; isEnabled: boolean }[],
): Map<string, unknown> {
  const records = reminders.flatMap(({ id, text, cadence, isEnabled }, index) => [
    reminderRecordOf(FIRST_SESSION, { id, number: index + 1, text, addedAt: NOW, cadence }),
    ...(isEnabled ? [enabledRecordOf(FIRST_SESSION, id, true, NOW)] : []),
  ])

  return new Map(records.map(record => [record.key, record.value]))
}

/** Starts a session with CHECK_CI sent every hour. */
function startWithHourlyReminder(
  $: Engine,
  on: Parameters<typeof startSession>[1],
  options: { isStateKept?: boolean } = {},
) {
  return startSession($, on, {
    ...options,
    stored: storedReminders([
      { id: 'check-ci', text: CHECK_CI, cadence: EVERY_HOUR, isEnabled: true },
    ]),
  })
}

/** Reads the reminders of the session again, as /reminders does. */
async function openReminders($: Engine): Promise<void> {
  await $.command.run({
    command: REMINDERS_COMMAND,
    args: '',
    origin: { kind: 'composer' },
    presentation: { isFullscreen: true, columns: 120 },
  })
}

function sentLinesOf(session: Session): string[] {
  return session.chatLines.filter(line => line.startsWith('Reminders:'))
}

/** The pane on the terminal, and the next due times its cards show. */
async function mountWithNextTimes($: Engine) {
  const pane = await mountPane($, 'terminal', REMINDERS_PANE)
  const nextLines = async () =>
    (await pane.findAll({ type: 'Text', text: /^· next / })).map(line => line.text)

  return { pane, nextLines }
}

describe('the card of a reminder sent every given time', () => {
  test(
    'the card shows the next due time while the reminder is on, and the time after it once it ' +
      'passed',
    async ($, on) => {
      // Noon of January 2, 1970 in the time zone of the machine, after the start of the clock.
      const addedAt = new Date(1970, 0, 2, 12, 0).getTime()
      const stored = [
        { id: 'check-ci', isEnabled: true },
        { id: 'update-spec', isEnabled: false },
      ].flatMap(({ id, isEnabled }, index) => [
        reminderRecordOf(FIRST_SESSION, {
          id,
          number: index + 1,
          text: CHECK_CI,
          addedAt,
          cadence: EVERY_HOUR,
        }),
        enabledRecordOf(FIRST_SESSION, id, isEnabled, addedAt),
      ])
      const session = await startSession($, on, {
        stored: new Map(stored.map(record => [record.key, record.value])),
      })
      await session.clock.advance(addedAt + 0.5 * HOUR - NOW)
      const { pane, nextLines } = await mountWithNextTimes($)

      expect(await pane.findAll({ type: 'Text', text: 'every 1 hour' })).toHaveLength(2)
      expect(await nextLines()).toEqual(['· next 13:00'])
      await session.clock.advance(0.5 * HOUR)
      expect(await nextLines()).toEqual(['· next 14:00'])
    },
  )

  // The hooks of the plugin do not see a write of the state made by a press in the pane, so a hook
  // that followed the writes of the reminders missed every switch made in the pane.
  test(
    'a reminder switched on in the pane while the session is idle shows its next due time at ' +
      'once, and is sent then',
    async ($, on) => {
      const session = await startSession($, on, {
        stored: storedReminders([
          { id: 'check-ci', text: CHECK_CI, cadence: EVERY_HOUR, isEnabled: false },
        ]),
      })
      const { pane, nextLines } = await mountWithNextTimes($)
      await pane.press({ key: 'switch-1' })
      expect(await nextLines()).toHaveLength(1)

      await session.clock.advance(HOUR)
      expect(promptsOfPlugin(session)).toEqual([noteOf(CHECK_CI)])
    },
  )

  test(
    'a reminder switched off in the pane shows no next due time, and is not sent',
    async ($, on) => {
      const session = await startWithHourlyReminder($, on)
      const { pane, nextLines } = await mountWithNextTimes($)
      expect(await nextLines()).toHaveLength(1)
      await pane.press({ key: 'switch-1' })

      expect(await nextLines()).toEqual([])
      await session.clock.advance(HOUR)
      expect(promptsOfPlugin(session)).toEqual([])
    },
  )

  test('the due times follow the time the reminder was added, strictly after the given time', () => {
    expect(firstDueTimeAfter(NOW, HOUR, NOW - HOUR)).toBe(NOW + HOUR)
    expect(firstDueTimeAfter(NOW, HOUR, NOW)).toBe(NOW + HOUR)
    expect(firstDueTimeAfter(NOW, HOUR, NOW + HOUR)).toBe(NOW + 2 * HOUR)
    expect(firstDueTimeAfter(NOW, HOUR, NOW + 2.5 * HOUR)).toBe(NOW + 3 * HOUR)
  })
})

describe('a reminder sent every given time', () => {
  test(
    'while the session is idle, the text alone is sent as a prompt at every due time',
    async ($, on) => {
      const session = await startWithHourlyReminder($, on)
      await session.clock.advance(HOUR - 1)
      expect(promptsOfPlugin(session)).toEqual([])

      await session.clock.advance(1)
      expect(promptsOfPlugin(session)).toEqual([noteOf(CHECK_CI)])
      expect(sentLinesOf(session)).toEqual([])
      await session.clock.advance(HOUR)
      expect(promptsOfPlugin(session)).toEqual([noteOf(CHECK_CI), noteOf(CHECK_CI)])
    },
  )

  test(
    'a due time during a turn goes with the next tool result of the main conversation, once',
    async ($, on) => {
      const session = await startWithHourlyReminder($, on)
      await startTurn($)
      await session.clock.advance(HOUR)
      expect(promptsOfPlugin(session)).toEqual([])
      expect(await notesOfToolResult($, SUBAGENT)).toEqual([])

      expect(await notesOfToolResult($)).toEqual([noteOf(CHECK_CI)])
      expect(sentLinesOf(session)).toEqual(['Reminders: reminder 1 sent to Claude'])
      expect(await notesOfToolResult($)).toEqual([])
      await endTurn($)
      await session.clock.settle()
      expect(promptsOfPlugin(session)).toEqual([])
    },
  )

  test(
    'a reminder every 700 hours, longer than a timer holds, is sent at its due time',
    async ($, on) => {
      on('clock.after', EVERY_EVENT, ($, e, next) =>
        e.ms > LONGEST_TIMER_WAIT ? { deny: 'a timer holds no longer wait' } : next(e),
      )
      const session = await startSession($, on, {
        stored: storedReminders([
          {
            id: 'check-ci',
            text: CHECK_CI,
            cadence: { kind: TIME_KIND.id, values: { amount: '700', unit: TimeUnit.Hours } },
            isEnabled: true,
          },
        ]),
      })
      await session.clock.advance(700 * HOUR - 1)
      expect(promptsOfPlugin(session)).toEqual([])

      await session.clock.advance(1)
      expect(promptsOfPlugin(session)).toEqual([noteOf(CHECK_CI)])
    },
  )

  test(
    'a turn through several due times without a tool call is followed by one prompt, and the ' +
      'next comes at the following due time',
    async ($, on) => {
      const session = await startWithHourlyReminder($, on)
      await startTurn($)
      await session.clock.advance(2.5 * HOUR)
      await endTurn($)
      await session.clock.settle()
      expect(promptsOfPlugin(session)).toEqual([noteOf(CHECK_CI)])
      await session.clock.advance(0.5 * HOUR - 1)
      expect(promptsOfPlugin(session)).toEqual([noteOf(CHECK_CI)])

      await session.clock.advance(1)
      expect(promptsOfPlugin(session)).toEqual([noteOf(CHECK_CI), noteOf(CHECK_CI)])
    },
  )

  test(
    'reminders due at once go in one note, by number',
    async ($, on) => {
      const session = await startSession($, on, {
        stored: storedReminders([
          { id: 'check-ci', text: CHECK_CI, cadence: EVERY_HOUR, isEnabled: true },
          {
            id: 'update-spec',
            text: UPDATE_SPEC,
            cadence: { kind: TIME_KIND.id, values: { amount: '30', unit: TimeUnit.Minutes } },
            isEnabled: true,
          },
        ]),
      })
      await startTurn($)
      await session.clock.advance(HOUR)

      expect(await notesOfToolResult($)).toEqual([
        `${noteOf(CHECK_CI)}\n\n${noteOf(UPDATE_SPEC)}`,
      ])
      expect(sentLinesOf(session)).toEqual(['Reminders: reminders 1 and 2 sent to Claude'])
    },
  )

  test(
    'a reminder switched off, removed or of a cadence with a problem is never sent',
    async ($, on) => {
      const stored = storedReminders([
        { id: 'check-ci', text: CHECK_CI, cadence: EVERY_HOUR, isEnabled: false },
        { id: 'update-spec', text: UPDATE_SPEC, cadence: EVERY_HOUR, isEnabled: true },
        {
          id: 'read-spec',
          text: READ_SPEC,
          cadence: { kind: TIME_KIND.id, values: { amount: '0', unit: TimeUnit.Hours } },
          isEnabled: true,
        },
      ])
      const removal = removalRecordOf(FIRST_SESSION, 'update-spec', NOW)
      stored.set(removal.key, removal.value)
      const session = await startSession($, on, { stored })
      await session.clock.advance(3 * HOUR)
      await startTurn($)

      expect(await notesOfToolResult($)).toEqual([])
      expect(promptsOfPlugin(session)).toEqual([])
    },
  )

  test(
    'a tool call while no reminder sent every given time is on reads neither clock nor store',
    async ($, on) => {
      let calls = 0
      const count = () => {
        calls += 1
      }
      on('clock.now', EVERY_EVENT, ($, e, next) => (count(), next(e)))
      on('store.get', EVERY_EVENT, ($, e, next) => (count(), next(e)))
      on('store.keys', EVERY_EVENT, ($, e, next) => (count(), next(e)))
      await startSession($, on, {
        stored: storedReminders([
          { id: 'check-ci', text: CHECK_CI, cadence: EVERY_HOUR, isEnabled: false },
        ]),
      })
      await startTurn($)
      const before = calls

      expect(await notesOfToolResult($)).toEqual([])
      expect(calls).toBe(before)
    },
  )

  test(
    'a reminder switched on later is first sent at its first due time after the switch',
    async ($, on) => {
      const session = await startSession($, on, {
        stored: storedReminders([
          { id: 'check-ci', text: CHECK_CI, cadence: EVERY_HOUR, isEnabled: false },
        ]),
      })
      await session.clock.advance(1.5 * HOUR)
      const switched = enabledRecordOf(FIRST_SESSION, 'check-ci', true, NOW + 1.5 * HOUR)
      session.store.set(switched.key, switched.value)
      await openReminders($)
      await session.clock.settle()
      expect(promptsOfPlugin(session)).toEqual([])
      await session.clock.advance(0.5 * HOUR - 1)
      expect(promptsOfPlugin(session)).toEqual([])

      await session.clock.advance(1)
      expect(promptsOfPlugin(session)).toEqual([noteOf(CHECK_CI)])
    },
  )

  test(
    'a prompt dropped by the engine leaves the reminder due for the next tool result',
    async ($, on) => {
      const session = await startWithHourlyReminder($, on)
      session.droppedPrompt = 'a stop hook is active'
      await session.clock.advance(HOUR)
      expect(promptsOfPlugin(session)).toEqual([noteOf(CHECK_CI)])
      await startTurn($)

      expect(await notesOfToolResult($)).toEqual([noteOf(CHECK_CI)])
      expect(session.toasts).toEqual([])
    },
  )

  test(
    'another session is sent nothing, and the session switched back to is sent its reminder at ' +
      'its first due time after the switch',
    async ($, on) => {
      const session = await startWithHourlyReminder($, on, { isStateKept: true })
      await session.clock.advance(0.5 * HOUR)
      await switchSession($, session, { id: SECOND_SESSION, reason: 'resume' })
      await session.clock.advance(0.75 * HOUR)
      await startTurn($)
      expect(await notesOfToolResult($)).toEqual([])
      await endTurn($)
      await session.clock.settle()
      expect(promptsOfPlugin(session)).toEqual([])

      await switchSession($, session, { id: FIRST_SESSION, reason: 'resume' })
      await session.clock.advance(0.75 * HOUR - 1)
      expect(promptsOfPlugin(session)).toEqual([])
      await session.clock.advance(1)
      expect(promptsOfPlugin(session)).toEqual([noteOf(CHECK_CI)])
    },
  )
})
