import type { EngineInterface } from 'claude-code'

/** Writes the failure described by `text` to the debug log, and shows it in a toast. */
export function showFailure(
  $: { ui: Pick<EngineInterface['ui'], 'log' | 'toast'> },
  text: string,
): void {
  $.ui.log(text, { to: 'debug' })
  $.ui.toast(text)
}
