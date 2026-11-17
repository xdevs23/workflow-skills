import type { EngineInterface } from 'claude-code'

import { describeFocusNotMoved } from './paneTexts'

/** An element of the pane `title`, drawn as `requestId`, by the key `key` given to it. */
export type PaneElementAt = { title: string; requestId: string; key: string }

/**
 * Gives the keyboard to the text field `key`, and writes why to the debug log where it did not
 * move. A pane without the keyboard asks for it as it does when it opens. The surface refuses that
 * while the prompt has text or a dialog has the keyboard.
 */
export async function focusField($: EngineInterface, field: PaneElementAt): Promise<void> {
  const { title, requestId } = field
  if (!(await $.ui.panes()).some(({ id, isFocused }) => id === requestId && isFocused)) {
    const opened = await $.ui.open({ id: requestId, title, focus: true })
    if (!opened.isPlaced) {
      $.ui.log(describeFocusNotMoved(field, opened.reason), { to: 'debug' })

      return
    }
  }
  await moveKeyboardTo($, field)
}

/**
 * Moves the keyboard within its pane to `element`, and writes why to the debug log where it did not
 * move, such as in a pane without the keyboard.
 */
export async function moveKeyboardTo($: EngineInterface, element: PaneElementAt): Promise<void> {
  const focused = await $.ui.focus({ requestId: element.requestId, key: element.key })
  if (focused.deny !== undefined) {
    $.ui.log(describeFocusNotMoved(element, focused.deny), { to: 'debug' })
  }
}
