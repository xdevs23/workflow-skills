import { describe, expect } from 'claude-code/testing'

import type { Cadence } from '../../types'
import { drawFooterAsEngine, mountFooterModes, runOnEngine } from '../footerTestSupport'
import { FOOTER_FACTS_ENGINE_VERSION } from '../promptFooter'
import { test } from '../testDeclaration'
import { FIRST_SESSION, mountPane, startSession } from '../testSupport'
import { PHRASE_KIND } from './phraseCadence'
import { REMINDERS_PANE } from './reminderNames'
import { reminderRecordOf } from './reminderRecord'
import { REMINDERS_BUTTON } from './remindersButton'

const START_BUILD = "Start a build whenever it's ready."
const SAYS_TESTS_PASS: Cadence = { kind: PHRASE_KIND.id, values: { phrases: '"tests pass"' } }
const UNREADABLE_STORE = 'the store file is not readable'

describe('the Reminders button in the prompt footer', () => {
  test('a press reads the reminders again and opens the Reminders pane on them', async ($, on) => {
    drawFooterAsEngine(on)
    runOnEngine(on, FOOTER_FACTS_ENGINE_VERSION)
    const session = await startSession($, on)
    const record = reminderRecordOf(FIRST_SESSION, {
      id: 'start-build',
      number: 1,
      text: START_BUILD,
      addedAt: 100,
      cadence: SAYS_TESTS_PASS,
    })
    session.store.set(record.key, record.value)
    const footer = await mountFooterModes($)
    await footer.press({ key: REMINDERS_BUTTON.key })

    expect(session.panes).toEqual([REMINDERS_PANE])
    const pane = await mountPane($, 'terminal', REMINDERS_PANE)
    expect(await pane.find({ type: 'Text', text: START_BUILD })).toBeDefined()
    expect(session.toasts).toEqual([])
  })

  test('reminders that cannot be read are shown in a toast with the reason', async ($, on) => {
    drawFooterAsEngine(on)
    runOnEngine(on, FOOTER_FACTS_ENGINE_VERSION)
    const session = await startSession($, on)
    session.keysRefusal = UNREADABLE_STORE
    const footer = await mountFooterModes($)
    await footer.press({ key: REMINDERS_BUTTON.key })

    expect(session.toasts).toHaveLength(1)
    expect(session.toasts[0]).toStartWith('The reminders of this session could not be read.')
    expect(session.toasts[0]).toContain(UNREADABLE_STORE)
    expect(session.logs).toContain(session.toasts[0])
    expect(session.panes).toEqual([REMINDERS_PANE])
  })

  test('a pane that cannot open is shown in a toast with the reason', async ($, on) => {
    on('ui.open', { id: REMINDERS_PANE }, () => ({
      value: { isPlaced: false, reason: 'every pane slot is taken' },
    }))
    drawFooterAsEngine(on)
    runOnEngine(on, FOOTER_FACTS_ENGINE_VERSION)
    const session = await startSession($, on)
    const footer = await mountFooterModes($)
    await footer.press({ key: REMINDERS_BUTTON.key })

    expect(session.toasts).toEqual([
      'The Reminders pane could not open: every pane slot is taken. Press Reminders again, and ' +
        'look for the cause in the debug log if the pane still does not open.',
    ])
    expect(session.logs).toContain(session.toasts[0])
  })
})
