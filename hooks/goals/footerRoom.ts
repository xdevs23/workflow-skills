import type { RenderSurface } from 'claude-code'

// The facts of the footer row below were read from the engine of Claude Code 2.1.316 on 2026-11-06.
// The engine draws the permission mode before the hint line as `<symbol> <name> on`, from its table
// of modes, and no hook sees it. The mode that bypasses permissions has the longest label.
const LONGEST_MODE_LABEL = '⏵⏵ bypass permissions on'
// The engine puts ` · ` or a single space between the mode label and the hint line.
const WIDEST_MODE_SEPARATOR = ' · '
// The engine draws the mode labels of SessionMode joined by ` & `.
const MODES_SEPARATOR = ' & '
// The footer row has 2 columns of padding at each side and 1 column between its left part and its
// right part, and moves the right part onto a row of its own when both do not fit.
const FOOTER_PADDING_COLUMNS = 2
const FOOTER_GAP_COLUMNS = 1
// The terminal draws a Button as `[ label ]`.
const BUTTON_FRAME_COLUMNS = '[  ]'.length
// The Box of the Goals button puts 1 column between the mode labels and the button.
const MODES_GAP_COLUMNS = 1

/** The footer row as a render hook sees it. */
export type FooterRow = {
  /** The columns of the viewport the footer row spans. */
  columns: number
  /** The most columns the hint line can take, as `mostColumnsOf` counts them. */
  hintColumns: number
  /** The mode labels drawn at the right end of the row. */
  modes: readonly string[]
}

/**
 * The most columns `text` can take on a terminal. A character outside ASCII takes one column or
 * two, and only the terminal knows which, so it counts as two.
 */
export function mostColumnsOf(text: string): number {
  return [...text].reduce((columns, character) => columns + (character <= '\u007f' ? 1 : 2), 0)
}

/**
 * Whether the footer row `row` has room for a button labelled `label` after its mode labels, so
 * the button takes no row of its own. The room allows for the longest label of a permission mode,
 * whichever mode the engine draws before the hint line.
 */
export function hasFooterRoomForButton(row: FooterRow, label: string): boolean {
  const left = mostColumnsOf(LONGEST_MODE_LABEL + WIDEST_MODE_SEPARATOR) + row.hintColumns
  const modes =
    row.modes.length === 0 ? 0 : mostColumnsOf(row.modes.join(MODES_SEPARATOR)) + MODES_GAP_COLUMNS
  const right = modes + mostColumnsOf(label) + BUTTON_FRAME_COLUMNS

  return 2 * FOOTER_PADDING_COLUMNS + left + FOOTER_GAP_COLUMNS + right <= row.columns
}

// The hint line of each surface, as measured when the surface last drew it. The engine refuses a
// write of the state while a render hook draws, so the drawing of the hint line keeps it here. A
// fresh copy of the module is drawn again from the start and measures again.
const hintColumnsBySurface = new Map<RenderSurface, number>()

/** Records `hintColumns` for `surface`, and returns whether that changed the record. */
export function recordHintColumns(surface: RenderSurface, hintColumns: number): boolean {
  const isChanged = hintColumnsBySurface.get(surface) !== hintColumns
  hintColumnsBySurface.set(surface, hintColumns)

  return isChanged
}

/** The columns of the hint line last drawn on `surface`, if it drew one. */
export function hintColumnsOn(surface: RenderSurface): number | undefined {
  return hintColumnsBySurface.get(surface)
}
