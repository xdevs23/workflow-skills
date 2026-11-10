import type { EngineInterface, MatchedHook, On, RenderInput, RenderPropsOf } from 'claude-code'

import { PLUGIN } from './names'

// The facts about the footer row of the terminal below were read from the engine of Claude Code
// 2.1.316 on 2026-11-06. The engine does not publish the layout of its footer. The facts decide
// only how many buttons fit. Where they no longer match the engine, a row too narrow for the
// buttons makes the engine move its right part onto a row of its own.
// The engine draws the permission mode before the hint line as `<symbol> <name> on`, from its table
// listing the modes, and hooks cannot read it. The mode that bypasses permissions has the longest
// label.
const LONGEST_MODE_LABEL = '⏵⏵ bypass permissions on'
// The engine puts ` · ` or a single space between the mode label and the hint line. The hint line
// is passed to a hook as drawn, its own ` · ` included, and its tail counts as if after a ` · `.
const WIDEST_PART_SEPARATOR = ' · '
// The engine draws the mode labels of SessionMode joined by ` & `.
const MODES_SEPARATOR = ' & '
// The footer row has 2 columns of padding at each side and 1 column between its left part and its
// right part. The engine moves the right part onto a separate row when both do not fit.
const FOOTER_PADDING_COLUMNS = 2
const FOOTER_GAP_COLUMNS = 1
// The terminal draws a Button as `[ label ]`.
const BUTTON_FRAME_COLUMNS = '[  ]'.length
/** The columns between the mode labels and each button drawn after them. */
const BUTTON_GAP_COLUMNS = 1

/** A button put on the prompt footer by a feature, after the mode labels. */
export type FooterButton = {
  /** The key of the button, unique among the buttons placed on the footer. */
  key: string
  label: string
}

/** The presses on one button of the prompt footer, as a matcher of `ui.press`. */
type PressesOnButton = {
  readonly plugin: typeof PLUGIN
  readonly component: 'SessionMode'
  readonly element: string
}

/**
 * The prompt footer, with the buttons placed on it after the mode labels, in the order placed. The
 * engine passes `$` only to a hook named where it is registered. So a feature places its button
 * and registers what a press on the button does as a `ui.press` hook of its own, in one statement:
 * `on('ui.press', footer.place(BUTTON), pressHook)`. The engine fails to load a hooks module that
 * keeps the value of a call taking `on`. So `createPromptFooter` creates the footer, and
 * `registerPromptFooter` registers its hooks.
 */
export type PromptFooter = {
  /**
   * Places `button` after the buttons placed before it, and returns the presses on it. Throws where
   * the label of `button` is empty or a button placed before has its key.
   */
  place: (button: FooterButton) => PressesOnButton
}

/** The right part of the footer row: the columns spanned by the row, and the mode labels in it. */
type RightPart = { columns: number; modes: readonly string[] }

/**
 * The most columns `text` can use on a terminal. A character outside ASCII is one or two columns
 * wide, depending on the terminal. This counts it as two.
 */
function mostColumnsOf(text: string): number {
  return [...text].reduce((columns, character) => columns + (character <= '\u007f' ? 1 : 2), 0)
}

/** The most columns the hint line `hint` can use as drawn, its tail included. */
function mostColumnsOfHintLine(hint: RenderPropsOf['PromptHint']): number {
  const parts = hint.tail === undefined ? [hint.hint] : [hint.hint, hint.tail]

  return mostColumnsOf(parts.join(WIDEST_PART_SEPARATOR))
}

/**
 * The columns needed by parts whose widths are `widths`, drawn side by side with a gap between each
 * two.
 */
function columnsSideBySide(widths: readonly number[]): number {
  const gaps = Math.max(widths.length - 1, 0)

  return widths.reduce((columns, width) => columns + width, 0) + gaps * BUTTON_GAP_COLUMNS
}

/**
 * How many of `buttons`, counted from the first, fit into `right` beside a hint line `hintColumns`
 * wide. The room allows for the longest label of a permission mode, whichever mode is drawn by the
 * engine before the hint line.
 */
function countButtonsFitting(
  buttons: readonly FooterButton[],
  right: RightPart,
  hintColumns: number,
): number {
  const left = mostColumnsOf(LONGEST_MODE_LABEL + WIDEST_PART_SEPARATOR) + hintColumns
  const room = right.columns - 2 * FOOTER_PADDING_COLUMNS - left - FOOTER_GAP_COLUMNS
  const modes = right.modes.length === 0 ? [] : [mostColumnsOf(right.modes.join(MODES_SEPARATOR))]
  const widths = buttons.map(button => mostColumnsOf(button.label) + BUTTON_FRAME_COLUMNS)
  const counts = widths.map((_, index) => index + 1)

  return (
    counts.findLast(count => columnsSideBySide([...modes, ...widths.slice(0, count)]) <= room) ?? 0
  )
}

/**
 * The footer row of the terminal with the buttons placed on it, as last drawn: its hint line, and
 * the right part recorded last. Writing the state fails while a render hook draws. The hooks of the
 * row therefore share this object, created once by `createPromptFooter`. The record of the hint
 * line is replaced only when the engine draws the hint line again.
 */
class FooterRow {
  readonly #buttons: FooterButton[] = []
  #hintColumns: number | undefined
  #right: RightPart | undefined

  /** Every button placed on the row, in the order placed. */
  get buttons(): readonly FooterButton[] {
    return this.#buttons
  }

  /** Places `button` after the buttons placed before it, as `PromptFooter.place` describes. */
  place(button: FooterButton): PressesOnButton {
    if (button.label === '') {
      throw new Error(`The footer button ${button.key} has an empty label.`)
    }
    if (this.#buttons.some(placed => placed.key === button.key)) {
      throw new Error(`Two footer buttons have the key ${button.key}.`)
    }
    this.#buttons.push(button)

    return { plugin: PLUGIN, component: 'SessionMode', element: button.key }
  }

  /** Records `right` as the most recent right part, `undefined` for a viewport not measured. */
  recordRightPart(right: RightPart | undefined): void {
    this.#right = right
  }

  /** Records the hint line `hint`, and returns whether that changed how many buttons fit. */
  recordHintLine(hint: RenderPropsOf['PromptHint']): boolean {
    const fittedBefore = this.#countFitting()
    this.#hintColumns = mostColumnsOfHintLine(hint)

    return this.#countFitting() !== fittedBefore
  }

  /** The buttons, counted from the first, that fit beside the hint line and the right part. */
  findButtonsFitting(): readonly FooterButton[] {
    return this.#buttons.slice(0, this.#countFitting())
  }

  #countFitting(): number {
    return this.#right === undefined || this.#hintColumns === undefined
      ? 0
      : countButtonsFitting(this.#buttons, this.#right, this.#hintColumns)
  }
}

/** Records in `row` the right part of the terminal footer where `e` is drawn. */
function recordRightPartOf(row: FooterRow, e: RenderInput<'SessionMode'>): void {
  if (e.surface === 'terminal') {
    row.recordRightPart(
      e.viewport === undefined ? undefined : { columns: e.viewport.columns, modes: e.props.modes },
    )
  }
}

/**
 * The buttons placed on `row`, counted from the first, with room after the mode labels where `e`
 * is drawn. Every button fits on every surface but the terminal.
 */
function findButtonsWithRoom(
  row: FooterRow,
  e: RenderInput<'SessionMode'>,
): readonly FooterButton[] {
  return e.surface === 'terminal' ? row.findButtonsFitting() : row.buttons
}

type DrawModes = MatchedHook<'ui.render', { component: 'SessionMode' }>

/**
 * Draws the mode labels of the prompt footer as the engine draws them, with the buttons placed on
 * `row` after them in the order placed, as many as `row` has room for. The `ui.press` hook of a
 * feature is called for every press on its button. So the closure of the button does nothing.
 */
async function drawButtonsAfterModes(
  row: FooterRow,
  $: EngineInterface,
  e: Parameters<DrawModes>[1],
  next: Parameters<DrawModes>[2],
): Promise<Awaited<ReturnType<DrawModes>>> {
  recordRightPartOf(row, e)
  const drawn = findButtonsWithRoom(row, e)
  if (drawn.length === 0) {
    return next(e)
  }
  const { Box, Button } = $.ui.resolve(e)

  return (
    <Box columnGap={BUTTON_GAP_COLUMNS}>
      {await next(e)}
      {drawn.map(button => (
        <Button key={button.key} label={button.label} dimColor onPress={() => undefined} />
      ))}
    </Box>
  )
}

type DrawHintLine = MatchedHook<'ui.render', { component: 'PromptHint'; surface: 'terminal' }>

/**
 * Draws the hint line of the terminal as the engine draws it, and records it in `row`. Where that
 * changes how many buttons fit, the engine draws every part of the plugin again.
 */
function measureHintLine(
  row: FooterRow,
  $: EngineInterface,
  e: Parameters<DrawHintLine>[1],
  next: Parameters<DrawHintLine>[2],
): ReturnType<DrawHintLine> {
  if (row.recordHintLine(e.props)) {
    $.ui.invalidate('ui.render')
  }

  return next(e)
}

/** Creates the prompt footer, for the features to place their buttons on. */
export function createPromptFooter(): FooterRow {
  return new FooterRow()
}

/**
 * Registers the hooks of the prompt footer `row`, created by `createPromptFooter`. Where the row
 * cannot fit every button, the buttons are left out, starting with the last one.
 */
export function registerPromptFooter(on: On, row: FooterRow): void {
  on('ui.render', { component: 'PromptHint', surface: 'terminal' }, ($, e, next) =>
    measureHintLine(row, $, e, next),
  )
  on('ui.render', { component: 'SessionMode' }, ($, e, next) =>
    drawButtonsAfterModes(row, $, e, next),
  )
}
