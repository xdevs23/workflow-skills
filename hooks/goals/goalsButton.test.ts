import { describe, expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

import { PLUGIN } from '../names'
import { FIRST_SESSION, NO_TIME_LIMIT, startSession } from '../testSupport'
import { GOALS_PANE } from './goalNames'
import { ROTATION_CRASH, mountGoalsPane, storedBoard } from './goalPaneTestSupport'
import { OPEN_GOALS_KEY } from './goalsButton'

const MODES = ['focus', 'memory paused']
const MODES_AS_DRAWN = 'focus & memory paused'

/** Draws the mode labels beneath the plugin as the engine does: dim, joined by ` & `. */
function drawModesAsEngine(on: On): void {
  on('ui.render', { component: 'SessionMode' }, ($, e) => ({
    type: 'Text',
    props: { dimColor: true },
    children: [e.props.modes.join(' & ')],
  }))
}

function mountFooterModes($: Engine) {
  return $.ui.mount({
    plugin: PLUGIN,
    surface: 'terminal',
    component: 'SessionMode',
    props: { modes: MODES },
  })
}

describe('the Goals button in the prompt footer', () => {
  test(
    'the footer keeps the mode labels as drawn and gains the button after them',
    NO_TIME_LIMIT,
    async ($, on) => {
      drawModesAsEngine(on)
      await startSession($, on, { stored: storedBoard() })
      const footer = await mountFooterModes($)

      expect(await footer.drawn()).toMatchObject({
        type: 'Box',
        children: [
          { type: 'Text', props: { dimColor: true }, children: [MODES_AS_DRAWN] },
          { type: 'Button', props: { key: OPEN_GOALS_KEY, label: 'Goals' } },
        ],
      })
    },
  )

  test(
    'before the session read its board, the footer draws the mode labels alone',
    NO_TIME_LIMIT,
    async ($, on) => {
      drawModesAsEngine(on)
      on('session.id', () => ({ value: FIRST_SESSION }))
      const footer = await mountFooterModes($)

      expect(await footer.find({ type: 'Text', text: MODES_AS_DRAWN })).toBeDefined()
      expect(await footer.find({ key: OPEN_GOALS_KEY })).toBeUndefined()
    },
  )

  test(
    'a press reads the board again and opens the Goals pane on it',
    NO_TIME_LIMIT,
    async ($, on) => {
      drawModesAsEngine(on)
      const session = await startSession($, on)
      for (const [key, value] of storedBoard()) {
        session.store.set(key, value)
      }
      const footer = await mountFooterModes($)
      await footer.press({ key: OPEN_GOALS_KEY })

      expect(session.panes).toEqual([GOALS_PANE])
      const pane = await mountGoalsPane($, 'terminal')
      expect(await pane.find({ type: 'Text', text: ROTATION_CRASH.text })).toBeDefined()
    },
  )

  test(
    'a pane that cannot open is shown in a toast with the commands in its place',
    NO_TIME_LIMIT,
    async ($, on) => {
      on('ui.open', { id: GOALS_PANE }, () => ({
        value: { isPlaced: false, reason: 'every pane slot is taken' },
      }))
      drawModesAsEngine(on)
      const session = await startSession($, on, { stored: storedBoard() })
      const footer = await mountFooterModes($)
      await footer.press({ key: OPEN_GOALS_KEY })

      expect(session.toasts).toHaveLength(1)
      expect(session.toasts[0]).toContain('every pane slot is taken')
      expect(session.toasts[0]).toContain('/goals add <text>')
      expect(session.logs).toContain(session.toasts[0])
    },
  )
})
