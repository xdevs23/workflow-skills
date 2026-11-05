import type { EngineInterface } from 'claude-code'

import { messageOf } from './errorMessage'

/** Runs the work of a press or an entry on the screen, and shows its failure as a toast. */
export function runOnScreen($: EngineInterface, work: () => Promise<void>): void {
  work().catch((error: unknown) => showFailure($, messageOf(error)))
}

/** Writes the failure described by `text` to the debug log, and shows it in a toast. */
export function showFailure($: EngineInterface, text: string): void {
  $.ui.log(text, { to: 'debug' })
  $.ui.toast(text)
}
