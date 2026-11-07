/** What the user did to open a pane: ran the command `command`, or pressed the button `button`. */
export type PaneOpener = { command: string } | { button: string }

/**
 * The text for the pane titled `pane`, opened by `opener`, that could not open for the reason
 * `reason`. Its next step repeats what opened the pane.
 */
export function describePaneNotOpened(pane: string, reason: string, opener: PaneOpener): string {
  const retry = 'command' in opener ? `Run /${opener.command}` : `Press ${opener.button}`

  return (
    `The ${pane} pane could not open: ${reason}. ${retry} again, and look for the cause in the ` +
    'debug log if the pane still does not open.'
  )
}
