import type { EngineInterface, UiPressArgument, UiPressResult } from 'claude-code'

/** Writes the failure described by `text` to the debug log, and shows it in a toast. */
export function showFailure(
  $: { ui: Pick<EngineInterface['ui'], 'log' | 'toast'> },
  text: string,
): void {
  $.ui.log(text, { to: 'debug' })
  $.ui.toast(text)
}

/** Shows each failure described by `texts` as `showFailure` does, and returns the result of `press`. */
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
