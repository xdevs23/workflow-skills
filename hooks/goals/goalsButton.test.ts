import { describe, expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On, RenderPropsOf, RenderSurface, RenderViewport } from 'claude-code'

import { PLUGIN } from '../names'
import { FOOTER_FACTS_ENGINE_VERSION } from '../promptFooter'
import { NO_TIME_LIMIT, startSession } from '../testSupport'
import { GOALS_PANE } from './goalNames'
import { ROTATION_CRASH, mountGoalsPane, storedBoard } from './goalPaneTestSupport'
import { OPEN_GOALS_KEY } from './goalsButton'

const MODES = ['focus', 'memory paused']
const MODES_AS_DRAWN = 'focus & memory paused'
const HINT = 'claude-fable-5-1 (high)'
const WORKING_HINT = `(shift+tab to cycle) · ${HINT} · esc to interrupt`
// Wide enough for the longest mode label, HINT, MODES and the button. Too narrow for WORKING_HINT.
const WIDE_ENOUGH = { columns: 100, rows: 40 }
const TOO_NARROW = { columns: 50, rows: 40 }

/**
 * Draws the footer beneath the plugin as the engine does: the hint line dim, and the mode labels
 * dim, joined by ` & `. Returns the drawings of the mode labels, counted as they happen.
 */
function drawFooterAsEngine(on: On): { modesDrawn: number } {
  const drawings = { modesDrawn: 0 }
  on('ui.render', { component: 'PromptHint' }, ($, e) => ({
    type: 'Text',
    props: { dimColor: true },
    children: [e.props.hint],
  }))
  on('ui.render', { component: 'SessionMode' }, ($, e) => {
    drawings.modesDrawn += 1

    return { type: 'Text', props: { dimColor: true }, children: [e.props.modes.join(' & ')] }
  })

  return drawings
}

/** Answers `$.session.version()` with the engine version `version`. */
function runOnEngine(on: On, version: string): void {
  on('session.version', () => ({ value: { version } }))
}

function hintOf(hint: string, tail?: string): RenderPropsOf['PromptHint'] {
  const props = { isDraft: false, isWorking: false, hint }

  return tail === undefined ? props : { ...props, tail }
}

/** Mounts the hint line of the terminal footer, drawing `hint`, in a viewport `viewport` wide. */
function mountHintLine($: Engine, hint: RenderPropsOf['PromptHint'], viewport: RenderViewport) {
  return $.ui.mount({
    plugin: PLUGIN,
    surface: 'terminal',
    component: 'PromptHint',
    props: hint,
    viewport,
  })
}

/** Mounts the mode labels `modes` of the footer of `surface`, in `viewport` when given. */
function mountModes(
  $: Engine,
  options: { surface: RenderSurface; modes: readonly string[]; viewport?: RenderViewport },
) {
  const target = {
    plugin: PLUGIN,
    surface: options.surface,
    component: 'SessionMode' as const,
    props: { modes: options.modes },
  }

  return $.ui.mount(
    options.viewport === undefined ? target : { ...target, viewport: options.viewport },
  )
}

/** Mounts the mode labels of the terminal footer beside a hint line HINT in `viewport`. */
async function mountFooterModes($: Engine, viewport: RenderViewport = WIDE_ENOUGH) {
  await mountHintLine($, hintOf(HINT), viewport)

  return mountModes($, { surface: 'terminal', modes: MODES, viewport })
}

const WIDEST_ROW_SEARCHED = 300

/** The fewest columns of a terminal footer that draws the button beside the hint line `hint`. */
async function narrowestRowWithButton($: Engine, hint: RenderPropsOf['PromptHint']) {
  for (let columns = 1; columns <= WIDEST_ROW_SEARCHED; columns += 1) {
    const viewport = { columns, rows: 40 }
    const hintLine = await mountHintLine($, hint, viewport)
    const footer = await mountModes($, { surface: 'terminal', modes: MODES, viewport })
    const button = await footer.find({ key: OPEN_GOALS_KEY })
    await Promise.all([hintLine.unmount(), footer.unmount()])
    if (button !== undefined) {
      return columns
    }
  }
  throw new Error(`No footer up to ${WIDEST_ROW_SEARCHED} columns draws the button.`)
}

describe('the Goals button in the prompt footer', () => {
  test(
    'the footer draws the mode labels as before and adds the button after them',
    async ($, on) => {
      drawFooterAsEngine(on)
      runOnEngine(on, FOOTER_FACTS_ENGINE_VERSION)
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

  test('a footer without mode labels draws the button', async ($, on) => {
    drawFooterAsEngine(on)
    runOnEngine(on, FOOTER_FACTS_ENGINE_VERSION)
    await mountHintLine($, hintOf(HINT), WIDE_ENOUGH)
    const footer = await mountModes($, { surface: 'terminal', modes: [], viewport: WIDE_ENOUGH })

    expect(await footer.find({ key: OPEN_GOALS_KEY })).toBeDefined()
  })

  test('a footer row too narrow for the button draws the mode labels alone', async ($, on) => {
    drawFooterAsEngine(on)
    runOnEngine(on, FOOTER_FACTS_ENGINE_VERSION)
    const footer = await mountFooterModes($, TOO_NARROW)

    expect(await footer.find({ type: 'Text', text: MODES_AS_DRAWN })).toBeDefined()
    expect(await footer.find({ key: OPEN_GOALS_KEY })).toBeUndefined()
  })

  test('a hint line that grows past the room of the row removes the button', async ($, on) => {
    drawFooterAsEngine(on)
    runOnEngine(on, FOOTER_FACTS_ENGINE_VERSION)
    const hintLine = await mountHintLine($, hintOf(HINT), WIDE_ENOUGH)
    const footer = await mountModes($, { surface: 'terminal', modes: MODES, viewport: WIDE_ENOUGH })
    expect(await footer.find({ key: OPEN_GOALS_KEY })).toBeDefined()

    await hintLine.redraw({ isDraft: false, isWorking: true, hint: WORKING_HINT })

    expect(await hintLine.drawn()).toMatchObject({
      type: 'Text',
      props: { dimColor: true },
      children: [WORKING_HINT],
    })
    expect(await footer.find({ key: OPEN_GOALS_KEY })).toBeUndefined()
  })

  test(
    'a hint line that changes within the room of the row draws the footer once',
    async ($, on) => {
      const drawings = drawFooterAsEngine(on)
      runOnEngine(on, FOOTER_FACTS_ENGINE_VERSION)
      const hintLine = await mountHintLine($, hintOf(HINT), WIDE_ENOUGH)
      await mountModes($, { surface: 'terminal', modes: MODES, viewport: WIDE_ENOUGH })
      const drawnBefore = drawings.modesDrawn

      await hintLine.redraw(hintOf('? for shortcuts'))

      expect(drawings.modesDrawn).toBe(drawnBefore)
    },
  )

  test('before the hint line is drawn, the footer draws the mode labels alone', async ($, on) => {
    drawFooterAsEngine(on)
    runOnEngine(on, FOOTER_FACTS_ENGINE_VERSION)
    const footer = await mountModes($, { surface: 'terminal', modes: MODES, viewport: WIDE_ENOUGH })

    expect(await footer.find({ type: 'Text', text: MODES_AS_DRAWN })).toBeDefined()
    expect(await footer.find({ key: OPEN_GOALS_KEY })).toBeUndefined()
  })

  test(
    'a terminal that has not measured its viewport draws the mode labels alone',
    async ($, on) => {
      drawFooterAsEngine(on)
      runOnEngine(on, FOOTER_FACTS_ENGINE_VERSION)
      await mountHintLine($, hintOf(HINT), WIDE_ENOUGH)
      const footer = await mountModes($, { surface: 'terminal', modes: MODES })

      expect(await footer.find({ type: 'Text', text: MODES_AS_DRAWN })).toBeDefined()
      expect(await footer.find({ key: OPEN_GOALS_KEY })).toBeUndefined()
    },
  )

  test(
    'on another version of the engine, the footer draws the mode labels alone',
    async ($, on) => {
      drawFooterAsEngine(on)
      runOnEngine(on, `${FOOTER_FACTS_ENGINE_VERSION}-dev.20261106.t120000.sha1a2b3c4`)
      const footer = await mountFooterModes($)

      expect(await footer.find({ type: 'Text', text: MODES_AS_DRAWN })).toBeDefined()
      expect(await footer.find({ key: OPEN_GOALS_KEY })).toBeUndefined()
    },
  )

  test(
    'the desktop draws the button in a viewport too narrow for the terminal row',
    async ($, on) => {
      drawFooterAsEngine(on)
      runOnEngine(on, FOOTER_FACTS_ENGINE_VERSION)
      const footer = await mountModes($, { surface: 'desktop', modes: MODES, viewport: TOO_NARROW })

      expect(await footer.find({ key: OPEN_GOALS_KEY })).toBeDefined()
    },
  )

  test('a tail after the hint line needs columns of its own', async ($, on) => {
    drawFooterAsEngine(on)
    runOnEngine(on, FOOTER_FACTS_ENGINE_VERSION)

    expect(await narrowestRowWithButton($, hintOf(HINT, 'goal 2 open'))).toBeGreaterThan(
      await narrowestRowWithButton($, hintOf(HINT)),
    )
  })

  test('a character outside ASCII needs more columns than one inside it', async ($, on) => {
    drawFooterAsEngine(on)
    runOnEngine(on, FOOTER_FACTS_ENGINE_VERSION)

    expect(await narrowestRowWithButton($, hintOf('模型'))).toBeGreaterThan(
      await narrowestRowWithButton($, hintOf('ab')),
    )
  })

  test(
    'a press reads the board again and opens the Goals pane on it',
    NO_TIME_LIMIT,
    async ($, on) => {
      drawFooterAsEngine(on)
      runOnEngine(on, FOOTER_FACTS_ENGINE_VERSION)
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
      runOnEngine(on, FOOTER_FACTS_ENGINE_VERSION)
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
