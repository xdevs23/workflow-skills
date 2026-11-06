import { describe, expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On, RenderViewport } from 'claude-code'

import { PLUGIN } from '../names'
import { FIRST_SESSION, NO_TIME_LIMIT, startSession } from '../testSupport'
import { GOALS_PANE } from './goalNames'
import { ROTATION_CRASH, mountGoalsPane, storedBoard } from './goalPaneTestSupport'
import { OPEN_GOALS_KEY } from './goalsButton'

const MODES = ['focus', 'memory paused']
const MODES_AS_DRAWN = 'focus & memory paused'

/**
 * Draws the footer beneath the plugin as the engine does: the hint line dim, and the mode labels
 * dim, joined by ` & `.
 */
function drawFooterAsEngine(on: On): void {
  on('ui.render', { component: 'PromptHint' }, ($, e) => ({
    type: 'Text',
    props: { dimColor: true },
    children: [e.props.hint],
  }))
  on('ui.render', { component: 'SessionMode' }, ($, e) => ({
    type: 'Text',
    props: { dimColor: true },
    children: [e.props.modes.join(' & ')],
  }))
}

const HINT = 'claude-fable-5-1 (high)'
const WORKING_HINT = `(shift+tab to cycle) · ${HINT} · esc to interrupt`
// Wide enough for the longest mode label, HINT, MODES and the button, not for WORKING_HINT.
const WIDE_ENOUGH = { columns: 100, rows: 40 }
const TOO_NARROW = { columns: 50, rows: 40 }

/** Mounts the hint line of the footer, drawing `hint`, in a viewport `viewport` wide. */
function mountHintLine($: Engine, hint: string, viewport: RenderViewport) {
  return $.ui.mount({
    plugin: PLUGIN,
    surface: 'terminal',
    component: 'PromptHint',
    props: { isDraft: false, isWorking: false, hint },
    viewport,
  })
}

/** Mounts the mode labels of the footer beside a hint line HINT in a viewport `viewport` wide. */
async function mountFooterModes($: Engine, viewport: RenderViewport = WIDE_ENOUGH) {
  await mountHintLine($, HINT, viewport)

  return mountModesOnly($, viewport)
}

function mountModesOnly($: Engine, viewport: RenderViewport) {
  return $.ui.mount({
    plugin: PLUGIN,
    surface: 'terminal',
    component: 'SessionMode',
    props: { modes: MODES },
    viewport,
  })
}

describe('the Goals button in the prompt footer', () => {
  test(
    'the footer keeps the mode labels as drawn and gains the button after them',
    NO_TIME_LIMIT,
    async ($, on) => {
      drawFooterAsEngine(on)
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
    'a footer row without room for the button draws the mode labels alone',
    NO_TIME_LIMIT,
    async ($, on) => {
      drawFooterAsEngine(on)
      await startSession($, on, { stored: storedBoard() })
      const footer = await mountFooterModes($, TOO_NARROW)

      expect(await footer.find({ type: 'Text', text: MODES_AS_DRAWN })).toBeDefined()
      expect(await footer.find({ key: OPEN_GOALS_KEY })).toBeUndefined()
    },
  )

  test(
    'a hint line that grows past the room of the row takes the button away',
    NO_TIME_LIMIT,
    async ($, on) => {
      drawFooterAsEngine(on)
      await startSession($, on, { stored: storedBoard() })
      const hintLine = await mountHintLine($, HINT, WIDE_ENOUGH)
      const footer = await mountModesOnly($, WIDE_ENOUGH)
      expect(await footer.find({ key: OPEN_GOALS_KEY })).toBeDefined()

      await hintLine.redraw({ isDraft: false, isWorking: true, hint: WORKING_HINT })

      expect(await hintLine.drawn()).toMatchObject({
        type: 'Text',
        props: { dimColor: true },
        children: [WORKING_HINT],
      })
      expect(await footer.find({ key: OPEN_GOALS_KEY })).toBeUndefined()
    },
  )

  test(
    'before the session read its board, the footer draws the mode labels alone',
    NO_TIME_LIMIT,
    async ($, on) => {
      drawFooterAsEngine(on)
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
      drawFooterAsEngine(on)
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
      drawFooterAsEngine(on)
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
