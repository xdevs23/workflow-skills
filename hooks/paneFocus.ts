import type { EngineInterface } from 'claude-code'

import { describeFocusNotMoved } from './paneTexts'

/**
 * Gives the keyboard to the text field `field` of the pane `title`, drawn as `requestId`, and
 * writes why to the debug log where it did not move. A press leaves the keyboard where it was, so
 * a pane without it, such as after a press on a Button of a surface module, asks for it as it does
 * when it opens. The surface refuses that while the prompt has text or a dialog has the keyboard.
 */
export async function focusField(
  $: EngineInterface,
  { title, requestId, field }: { title: string; requestId: string; field: string },
): Promise<void> {
  if (!(await $.ui.panes()).some(({ id, isFocused }) => id === requestId && isFocused)) {
    const opened = await $.ui.open({ id: requestId, title, focus: true })
    if (!opened.isPlaced) {
      $.ui.log(describeFocusNotMoved(title, opened.reason), { to: 'debug' })

      return
    }
  }
  const focused = await $.ui.focus({ requestId, key: field })
  if (focused.deny !== undefined) {
    $.ui.log(describeFocusNotMoved(title, focused.deny), { to: 'debug' })
  }
}
