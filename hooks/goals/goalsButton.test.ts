import { describe, expect } from 'claude-code/testing'

import { drawFooterAsEngine, mountFooterModes, runOnEngine } from '../footerTestSupport'
import { FOOTER_FACTS_ENGINE_VERSION } from '../promptFooter'
import { test } from '../testDeclaration'
import { startSession } from '../testSupport'
import { GOALS_PANE } from './goalNames'
import {
  NOT_READ,
  ROTATION_CRASH,
  UNREADABLE_STORE,
  mountGoalsPane,
  storedBoard,
} from './goalPaneTestSupport'
import { GOALS_BUTTON } from './goalsButton'

describe('the Goals button in the prompt footer', () => {
  test('a press reads the board again and opens the Goals pane on it', async ($, on) => {
    drawFooterAsEngine(on)
    runOnEngine(on, FOOTER_FACTS_ENGINE_VERSION)
    const session = await startSession($, on)
    for (const [key, value] of storedBoard()) {
      session.store.set(key, value)
    }
    const footer = await mountFooterModes($)
    await footer.press({ key: GOALS_BUTTON.key })

    expect(session.panes).toEqual([GOALS_PANE])
    const pane = await mountGoalsPane($, 'terminal')
    expect(await pane.find({ type: 'Text', text: ROTATION_CRASH.text })).toBeDefined()
  })

  test('a pane that cannot open is shown in a toast with the reason', async ($, on) => {
    on('ui.open', { id: GOALS_PANE }, () => ({
      value: { isPlaced: false, reason: 'every pane slot is taken' },
    }))
    drawFooterAsEngine(on)
    runOnEngine(on, FOOTER_FACTS_ENGINE_VERSION)
    const session = await startSession($, on, { stored: storedBoard() })
    const footer = await mountFooterModes($)
    await footer.press({ key: GOALS_BUTTON.key })

    expect(session.toasts).toEqual([
      'The Goals pane could not open: every pane slot is taken. Press Goals again, and look for ' +
        'the cause in the debug log if the pane still does not open.',
    ])
    expect(session.logs).toContain(session.toasts[0])
  })

  test('a board that cannot be read is shown in a toast with the reason', async ($, on) => {
    drawFooterAsEngine(on)
    runOnEngine(on, FOOTER_FACTS_ENGINE_VERSION)
    const session = await startSession($, on, { stored: storedBoard() })
    session.keysRefusal = UNREADABLE_STORE
    const footer = await mountFooterModes($)
    await footer.press({ key: GOALS_BUTTON.key })

    expect(session.toasts).toHaveLength(1)
    expect(session.toasts[0]).toStartWith(NOT_READ)
    expect(session.toasts[0]).toContain(UNREADABLE_STORE)
    expect(session.logs).toContain(session.toasts[0])
    expect(session.panes).toEqual([GOALS_PANE])
  })
})
