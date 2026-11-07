import { describe, expect } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { RenderPropsOf } from 'claude-code'

import {
  HINT,
  MODES,
  MODES_AS_DRAWN,
  WIDEST_ROW_SEARCHED,
  WIDE_ENOUGH,
  drawFooterAsEngine,
  hintOf,
  mountFooterModes,
  mountHintLine,
  mountModes,
  runOnEngine,
} from './footerTestSupport'
import { GOALS_BUTTON } from './goals/goalsButton'
import { FOOTER_FACTS_ENGINE_VERSION, createPromptFooter } from './promptFooter'
import { REMINDERS_BUTTON } from './reminders/remindersButton'
import { test } from './testDeclaration'
import { startSession } from './testSupport'

const WORKING_HINT = `(shift+tab to cycle) · ${HINT} · esc to interrupt`
const NOTES_BUTTON = { key: 'open-notes', label: 'Notes' }
/** Another plugin, which draws a button under the key of the Goals button. */
const EXPLAINER = 'explainer'
/** The toast shown by a press on the button drawn by EXPLAINER. */
const EXPLAINED = 'Explained by another plugin'

/**
 * The fewest columns needed by a terminal footer to draw the button keyed `key` beside the hint
 * line `hint`.
 */
async function narrowestRowWithButton($: Engine, hint: RenderPropsOf['PromptHint'], key: string) {
  for (let columns = 1; columns <= WIDEST_ROW_SEARCHED; columns += 1) {
    const viewport = { columns, rows: 40 }
    const hintLine = await mountHintLine($, hint, viewport)
    const footer = await mountModes($, { surface: 'terminal', modes: MODES, viewport })
    const button = await footer.find({ key })
    await Promise.all([hintLine.unmount(), footer.unmount()])
    if (button !== undefined) {
      return columns
    }
  }
  throw new Error(`No footer up to ${WIDEST_ROW_SEARCHED} columns draws the button ${key}.`)
}

/** A terminal footer row one column too narrow for the button keyed `key` beside HINT. */
async function rowTooNarrowFor($: Engine, key: string) {
  return { columns: (await narrowestRowWithButton($, hintOf(HINT), key)) - 1, rows: 40 }
}

/** The narrowest terminal footer row that draws the button keyed `key` beside HINT. */
async function narrowestRowFor($: Engine, key: string) {
  return { columns: await narrowestRowWithButton($, hintOf(HINT), key), rows: 40 }
}

describe('the buttons in the prompt footer', () => {
  test(
    'the footer draws the mode labels as before and adds Goals, then Reminders after them',
    async ($, on) => {
      drawFooterAsEngine(on)
      runOnEngine(on, FOOTER_FACTS_ENGINE_VERSION)
      const footer = await mountFooterModes($)

      expect(await footer.drawn()).toMatchObject({
        type: 'Box',
        children: [
          { type: 'Text', props: { dimColor: true }, children: [MODES_AS_DRAWN] },
          { type: 'Button', props: { key: GOALS_BUTTON.key, label: GOALS_BUTTON.label } },
          { type: 'Button', props: { key: REMINDERS_BUTTON.key, label: REMINDERS_BUTTON.label } },
        ],
      })
    },
  )

  test('a row with room for one button draws the first and leaves out the last', async ($, on) => {
    drawFooterAsEngine(on)
    runOnEngine(on, FOOTER_FACTS_ENGINE_VERSION)
    const footer = await mountFooterModes($, await rowTooNarrowFor($, REMINDERS_BUTTON.key))

    expect(await footer.find({ key: GOALS_BUTTON.key })).toBeDefined()
    expect(await footer.find({ key: REMINDERS_BUTTON.key })).toBeUndefined()
  })

  test('the second button needs columns and a gap beside the first', async ($, on) => {
    drawFooterAsEngine(on)
    runOnEngine(on, FOOTER_FACTS_ENGINE_VERSION)
    const forGoals = await narrowestRowWithButton($, hintOf(HINT), GOALS_BUTTON.key)
    const forBoth = await narrowestRowWithButton($, hintOf(HINT), REMINDERS_BUTTON.key)

    expect(forBoth - forGoals).toBe(` [ ${REMINDERS_BUTTON.label} ]`.length)
  })

  test('a footer without mode labels draws the button', async ($, on) => {
    drawFooterAsEngine(on)
    runOnEngine(on, FOOTER_FACTS_ENGINE_VERSION)
    await mountHintLine($, hintOf(HINT), WIDE_ENOUGH)
    const footer = await mountModes($, { surface: 'terminal', modes: [], viewport: WIDE_ENOUGH })

    expect(await footer.find({ key: GOALS_BUTTON.key })).toBeDefined()
  })

  test('a footer row too narrow for any button draws the mode labels alone', async ($, on) => {
    drawFooterAsEngine(on)
    runOnEngine(on, FOOTER_FACTS_ENGINE_VERSION)
    const footer = await mountFooterModes($, await rowTooNarrowFor($, GOALS_BUTTON.key))

    expect(await footer.drawn()).toMatchObject({
      type: 'Text',
      props: { dimColor: true },
      children: [MODES_AS_DRAWN],
    })
  })

  test('a hint line that grows past the room in the row removes the button', async ($, on) => {
    drawFooterAsEngine(on)
    runOnEngine(on, FOOTER_FACTS_ENGINE_VERSION)
    const viewport = await narrowestRowFor($, GOALS_BUTTON.key)
    const hintLine = await mountHintLine($, hintOf(HINT), viewport)
    const footer = await mountModes($, { surface: 'terminal', modes: MODES, viewport })
    expect(await footer.find({ key: GOALS_BUTTON.key })).toBeDefined()

    await hintLine.redraw({ isDraft: false, isWorking: true, hint: WORKING_HINT })

    expect(await hintLine.drawn()).toMatchObject({
      type: 'Text',
      props: { dimColor: true },
      children: [WORKING_HINT],
    })
    expect(await footer.find({ key: GOALS_BUTTON.key })).toBeUndefined()
  })

  test(
    'a hint line that grows from room for both buttons to room for one removes the last',
    async ($, on) => {
      drawFooterAsEngine(on)
      runOnEngine(on, FOOTER_FACTS_ENGINE_VERSION)
      const viewport = await narrowestRowFor($, REMINDERS_BUTTON.key)
      const hintLine = await mountHintLine($, hintOf(HINT), viewport)
      const footer = await mountModes($, { surface: 'terminal', modes: MODES, viewport })
      expect(await footer.find({ key: REMINDERS_BUTTON.key })).toBeDefined()

      await hintLine.redraw(hintOf(`${HINT}.`))

      expect(await footer.find({ key: GOALS_BUTTON.key })).toBeDefined()
      expect(await footer.find({ key: REMINDERS_BUTTON.key })).toBeUndefined()
    },
  )

  test(
    'a hint line that changes within the room in the row draws the footer once',
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
    expect(await footer.find({ key: GOALS_BUTTON.key })).toBeUndefined()
  })

  test(
    'a terminal that has not measured its viewport draws the mode labels alone',
    async ($, on) => {
      drawFooterAsEngine(on)
      runOnEngine(on, FOOTER_FACTS_ENGINE_VERSION)
      await mountHintLine($, hintOf(HINT), WIDE_ENOUGH)
      const footer = await mountModes($, { surface: 'terminal', modes: MODES })

      expect(await footer.find({ type: 'Text', text: MODES_AS_DRAWN })).toBeDefined()
      expect(await footer.find({ key: GOALS_BUTTON.key })).toBeUndefined()
    },
  )

  test('on another engine version, the footer draws the mode labels alone', async ($, on) => {
    drawFooterAsEngine(on)
    runOnEngine(on, `${FOOTER_FACTS_ENGINE_VERSION}-dev.20261106.t120000.sha1a2b3c4`)
    const footer = await mountFooterModes($)

    expect(await footer.find({ type: 'Text', text: MODES_AS_DRAWN })).toBeDefined()
    expect(await footer.find({ key: GOALS_BUTTON.key })).toBeUndefined()
  })

  test(
    'the desktop draws every button in a viewport too narrow for the terminal row',
    async ($, on) => {
      drawFooterAsEngine(on)
      runOnEngine(on, FOOTER_FACTS_ENGINE_VERSION)
      const viewport = await rowTooNarrowFor($, GOALS_BUTTON.key)
      const footer = await mountModes($, { surface: 'desktop', modes: MODES, viewport })

      expect(await footer.find({ key: GOALS_BUTTON.key })).toBeDefined()
      expect(await footer.find({ key: REMINDERS_BUTTON.key })).toBeDefined()
    },
  )

  test('a tail after the hint line adds columns', async ($, on) => {
    drawFooterAsEngine(on)
    runOnEngine(on, FOOTER_FACTS_ENGINE_VERSION)

    expect(
      await narrowestRowWithButton($, hintOf(HINT, 'goal 2 open'), GOALS_BUTTON.key),
    ).toBeGreaterThan(await narrowestRowWithButton($, hintOf(HINT), GOALS_BUTTON.key))
  })

  test('a character outside ASCII needs more columns than one inside it', async ($, on) => {
    drawFooterAsEngine(on)
    runOnEngine(on, FOOTER_FACTS_ENGINE_VERSION)

    expect(await narrowestRowWithButton($, hintOf('模型'), GOALS_BUTTON.key)).toBeGreaterThan(
      await narrowestRowWithButton($, hintOf('ab'), GOALS_BUTTON.key),
    )
  })
})

describe('placing a button on the prompt footer', () => {
  test('a button with the key of a button placed before throws', () => {
    const footer = createPromptFooter()
    footer.place(NOTES_BUTTON)

    expect(() => footer.place({ ...NOTES_BUTTON, label: 'Other notes' })).toThrow(
      `Two footer buttons have the key ${NOTES_BUTTON.key}.`,
    )
  })

  test('a button with an empty label throws', () => {
    const footer = createPromptFooter()

    expect(() => footer.place({ ...NOTES_BUTTON, label: '' })).toThrow(
      `The footer button ${NOTES_BUTTON.key} has an empty label.`,
    )
  })
})

describe('a press on a button of another plugin', () => {
  test(
    'a button keyed as the Goals button by another plugin runs the closure of that plugin',
    async ($, on) => {
      const session = await startSession($, on)
      const footer = await mountModes($, { surface: 'desktop', modes: MODES })
      await footer.press({ key: GOALS_BUTTON.key, plugin: EXPLAINER })

      expect(session.toasts).toEqual([EXPLAINED])
      expect(session.panes).toEqual([])
    },
    [
      {
        name: EXPLAINER,
        // An inline plugin runs in an environment of its own and cannot read the constants of this
        // module, so its key and toast are written out: the key of GOALS_BUTTON and EXPLAINED.
        register: on => {
          on('ui.render', { component: 'SessionMode' }, ($, e) =>
            $.ui.resolve(e).Button({
              key: 'open-goals',
              label: 'Explain',
              onPress: () => {
                $.ui.toast('Explained by another plugin')
              },
            }),
          )
        },
      },
    ],
  )
})
