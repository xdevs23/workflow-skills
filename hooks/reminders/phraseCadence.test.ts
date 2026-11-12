import { describe, expect } from 'claude-code/testing'
import type { On } from 'claude-code'

import { textContainingInOrder } from '../orderedTextTestSupport'
import { test } from '../testDeclaration'
import { FIRST_SESSION, SUBAGENT, startSession, stopTurn } from '../testSupport'
import { CadenceProblem, readSettings } from './cadenceKind'
import { PHRASE_CADENCE, PHRASE_KIND } from './phraseCadence'
import { enabledRecordOf, reminderRecordOf } from './reminderRecord'

const MARK_GOAL = 'Mark the goal done with its evidence when you finish testing.'
const SCREENSHOT = 'Open the login screen on the emulator and take a screenshot.'
const START_BUILD = "Start a build whenever it's ready."

const TESTS_PASS = 'Finished testing: all 212 tests pass.'

/**
 * The records of three reminders of the kind "when Claude says" in FIRST_SESSION: reminder 1 on
 * the phrases "finished testing" and "tests pass", stored as the text an earlier version typed
 * them into, reminder 2 on "installed on the emulator" and switched off, and reminder 3 on
 * "tests pass".
 */
function storedReminders(): Map<string, unknown> {
  const reminders = [
    { id: 'mark-goal', text: MARK_GOAL, phrases: '"finished testing", "tests pass"' },
    { id: 'screenshot', text: SCREENSHOT, phrases: ['installed on the emulator'] },
    { id: 'start-build', text: START_BUILD, phrases: ['tests pass'] },
  ]
  const records = [
    ...reminders.map(({ id, text, phrases }, index) =>
      reminderRecordOf(FIRST_SESSION, {
        id,
        number: index + 1,
        text,
        addedAt: (index + 1) * 100,
        cadence: { kind: PHRASE_KIND.id, values: { phrases } },
      }),
    ),
    enabledRecordOf(FIRST_SESSION, 'mark-goal', true, 110),
    enabledRecordOf(FIRST_SESSION, 'start-build', true, 310),
  ]

  return new Map(records.map(record => [record.key, record.value]))
}

/** Replaces the classic Stop hook of the engine beneath the plugin, so it passes every end. */
function stopBeneath(on: On): void {
  on('classic.Stop', () => ({}))
}

describe('the phrases of a card set to the kind "when Claude says"', () => {
  test('the phrases added to the card are read', () => {
    const read = readSettings(PHRASE_KIND, { phrases: ['finished testing', 'tests pass'] })

    expect(read instanceof CadenceProblem ? read : read.phrases).toHaveLength(2)
  })

  for (const phrases of [[], ['tests pass', ' ']]) {
    test(`${JSON.stringify(phrases)} is refused with the problem shown on the card`, () => {
      expect(readSettings(PHRASE_KIND, { phrases })).toBeInstanceOf(CadenceProblem)
    })
  }

  test('a text stored by an earlier version is read as phrases in double quotes', () => {
    const stored = ' "finished testing" ,"tests pass" '

    expect(PHRASE_CADENCE.describe({ phrases: stored })).toBe(
      'when Claude says "finished testing", "tests pass"',
    )
  })

  test('a stored text that does not read as phrases in double quotes is a problem', () => {
    const unreadable = { phrases: '"tests pass", "done' }

    expect(readSettings(PHRASE_KIND, unreadable)).toBeInstanceOf(CadenceProblem)
    expect(PHRASE_CADENCE.describe(unreadable)).toBe(PHRASE_KIND.label)
  })
})

describe('the end of a turn on a message with a phrase of a reminder', () => {
  test(
    'the reminders switched on with a phrase in the message are sent by their texts',
    async ($, on) => {
      stopBeneath(on)
      const session = await startSession($, on, { stored: storedReminders() })

      const stopped = await stopTurn($, { message: TESTS_PASS })

      expect(stopped.block).toEqual(textContainingInOrder([MARK_GOAL, START_BUILD], [SCREENSHOT]))
      expect(session.chatLines).toContain('Reminders: reminders 1 and 3 sent to Claude')
    },
  )

  test(
    'a phrase matches in any case and across a line break',
    async ($, on) => {
      stopBeneath(on)
      await startSession($, on, { stored: storedReminders() })

      const stopped = await stopTurn($, { message: 'The suite is green, so I FINISHED\ntesting.' })

      expect(stopped.block).toEqual(textContainingInOrder([MARK_GOAL], [START_BUILD, SCREENSHOT]))
    },
  )

  const notSending = [
    'The commit is titled `tests pass` and the suite is green.',
    'The log says "tests pass" for the old branch.',
    '> tests pass\n\nThat line is from yesterday.',
    'All tests passed on the branch.',
    'The debug build is installed on the emulator.',
  ]
  for (const message of notSending) {
    test(`${JSON.stringify(message)} sends no reminder`, async ($, on) => {
      stopBeneath(on)
      const session = await startSession($, on, { stored: storedReminders() })

      expect((await stopTurn($, { message })).block).toBeUndefined()
      expect(session.chatLines.filter(line => line.startsWith('Reminders:'))).toEqual([])
    })
  }

  test('the end that follows a block passes', async ($, on) => {
    stopBeneath(on)
    await startSession($, on, { stored: storedReminders() })

    expect((await stopTurn($, { message: TESTS_PASS, followsBlock: true })).block).toBeUndefined()
  })

  test('the end of a subagent passes', async ($, on) => {
    stopBeneath(on)
    await startSession($, on, { stored: storedReminders() })

    expect((await stopTurn($, { message: TESTS_PASS, agentId: SUBAGENT })).block).toBeUndefined()
  })
})
