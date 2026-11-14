import type {
  CommandRunResult,
  EngineInterface,
  UiPressArgument,
  UiPressResult,
} from 'claude-code'

import { returningStoreFailure } from './pluginStore'
import type { FailedStoreCall } from './pluginStore'

/** Writes the failure described by `text` to the debug log, and shows it in a toast. */
export function showFailure(
  $: { ui: Pick<EngineInterface['ui'], 'log' | 'toast'> },
  text: string,
): void {
  $.ui.log(text, { to: 'debug' })
  $.ui.toast(text)
}

/**
 * Shows each failure described by `texts` as `showFailure` does, and returns the result of `press`.
 */
export function showFailuresOfPress(
  $: { ui: Pick<EngineInterface['ui'], 'log' | 'toast'> },
  press: Pick<UiPressArgument, 'element'>,
  texts: readonly string[],
): UiPressResult {
  for (const text of texts) {
    showFailure($, text)
  }

  return { element: press.element }
}

/**
 * The reply of a command to the failures described by `texts`, one to a line, which goes to the
 * debug log too. A command without failures does not reply.
 */
export function replyWithFailures(
  $: { ui: Pick<EngineInterface['ui'], 'log'> },
  texts: readonly string[],
): CommandRunResult {
  if (texts.length === 0) {
    return {}
  }
  const text = texts.join('\n')
  $.ui.log(text, { to: 'debug' })

  return { text }
}

/** Runs `work`, and shows the failure of the store that stopped it as `describe` writes it. */
export async function showingStoreFailure(
  $: { ui: Pick<EngineInterface['ui'], 'log' | 'toast'> },
  work: () => Promise<void>,
  describe: (failed: FailedStoreCall) => string,
): Promise<void> {
  const failure = await returningStoreFailure(work, describe)
  if (typeof failure === 'string') {
    showFailure($, failure)
  }
}
