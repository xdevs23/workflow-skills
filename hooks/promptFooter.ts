import type { EngineInterface, MatchedHook, On, RenderInput, RenderPropsOf } from 'claude-code'

// The facts about the footer row of the terminal below were read from the engine of Claude Code
// FOOTER_FACTS_ENGINE_VERSION on 2026-11-06. The engine does not publish the layout of its footer,
// so another version of the engine may draw the row in another way.
export const FOOTER_FACTS_ENGINE_VERSION = '2.1.316'
// The engine draws the permission mode before the hint line as `<symbol> <name> on`, from its table
// of modes, and hooks cannot read it. The mode that bypasses permissions has the longest label.
const LONGEST_MODE_LABEL = '⏵⏵ bypass permissions on'
// The engine puts ` · ` or a single space between the mode label and the hint line. The hint line
// reaches a hook as drawn, its own ` · ` included, and its tail counts as if after a ` · `.
const WIDEST_PART_SEPARATOR = ' · '
// The engine draws the mode labels of SessionMode joined by ` & `.
const MODES_SEPARATOR = ' & '
// The footer row has 2 columns of padding at each side and 1 column between its left part and its
// right part. The engine moves the right part onto a separate row when both do not fit.
const FOOTER_PADDING_COLUMNS = 2
const FOOTER_GAP_COLUMNS = 1
// The terminal draws a Button as `[ label ]`.
const BUTTON_FRAME_COLUMNS = '[  ]'.length
/** The columns between the mode labels and a button drawn after them. */
export const BUTTON_GAP_COLUMNS = 1

/** A button after the mode labels of the footer row, with what decides whether it fits there. */
type ButtonAfterModes = {
  /** The columns of the viewport the footer row spans. */
  columns: number
  /** The mode labels drawn at the right end of the row. */
  modes: readonly string[]
  label: string
}

/**
 * The most columns `text` can use on a terminal. A character outside ASCII is one or two columns
 * wide, depending on the terminal, so it counts as two.
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
 * Whether the footer row has room for `button` beside a hint line `hintColumns` wide, so the button
 * sits on the same row. The room allows for the longest label of a permission mode, whichever mode
 * the engine draws before the hint line.
 */
function fitsOnFooterRow(button: ButtonAfterModes, hintColumns: number): boolean {
  const left = mostColumnsOf(LONGEST_MODE_LABEL + WIDEST_PART_SEPARATOR) + hintColumns
  const modes =
    button.modes.length === 0
      ? 0
      : mostColumnsOf(button.modes.join(MODES_SEPARATOR)) + BUTTON_GAP_COLUMNS
  const right = modes + mostColumnsOf(button.label) + BUTTON_FRAME_COLUMNS

  return 2 * FOOTER_PADDING_COLUMNS + left + FOOTER_GAP_COLUMNS + right <= button.columns
}

/**
 * The footer row of the terminal, as last drawn: its hint line, and the button last asked about.
 * A write of the state fails while a render hook draws, so the hooks of the row share this object,
 * built once where they are registered. Only the next drawing of the hint line replaces its
 * record.
 */
export class FooterRow {
  #hintColumns: number | undefined
  #button: ButtonAfterModes | undefined

  /** Records `button` as the button last asked about, and returns whether it fits on the row. */
  recordButton(button: ButtonAfterModes): boolean {
    this.#button = button

    return this.#hasRoom()
  }

  /** Records the hint line `hint`, and returns whether that changed the room for the button. */
  recordHintLine(hint: RenderPropsOf['PromptHint']): boolean {
    const hadRoom = this.#hasRoom()
    this.#hintColumns = mostColumnsOfHintLine(hint)

    return this.#hasRoom() !== hadRoom
  }

  #hasRoom(): boolean {
    return (
      this.#button !== undefined &&
      this.#hintColumns !== undefined &&
      fitsOnFooterRow(this.#button, this.#hintColumns)
    )
  }
}

/**
 * Whether the footer row `row`, where `e` is drawn, has room for a button labelled `label` after
 * its mode labels. The facts about the row hold for the terminal of one version of the engine, so
 * the button fits on every other surface and is left out on the terminal of another version.
 */
export async function hasFooterRoomForButton(
  $: EngineInterface,
  row: FooterRow,
  e: RenderInput<'SessionMode'>,
  label: string,
): Promise<boolean> {
  if (e.surface !== 'terminal') {
    return true
  }

  return (
    e.viewport !== undefined &&
    (await $.session.version()).version === FOOTER_FACTS_ENGINE_VERSION &&
    row.recordButton({ columns: e.viewport.columns, modes: e.props.modes, label })
  )
}

type DrawHintLine = MatchedHook<'ui.render', { component: 'PromptHint'; surface: 'terminal' }>

/**
 * Draws the hint line of the terminal as the engine draws it, and records it in `row`. Where that
 * changes the room for the button, every drawing of the plugin is drawn again.
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

/** Registers the hook that measures the hint line into `row`. */
export function registerPromptFooter(on: On, row: FooterRow): void {
  on('ui.render', { component: 'PromptHint', surface: 'terminal' }, ($, e, next) =>
    measureHintLine(row, $, e, next),
  )
}
