import type { EngineInterface } from 'claude-code'

import { messageOf } from './errorMessage'
import { showFailure } from './failureToast'

/**
 * Runs `work` once after `milliseconds`. The engine does not wait for the work of a timer, so a
 * failure of `work` is shown with the text made by `describeFailure` from its message.
 */
export function runAfter(
  $: EngineInterface,
  milliseconds: number,
  work: () => Promise<void>,
  describeFailure: (message: string) => string,
): void {
  $.clock.after(milliseconds, () => {
    work().catch((error: unknown) => showFailure($, describeFailure(messageOf(error))))
  })
}
