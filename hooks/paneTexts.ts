// The texts shared by the panes of the plugin, so the panes use one word for each action.

/** The label of the button that saves what was typed into a card or a row being edited. */
export const DONE_LABEL = 'Done'

/**
 * The line in the debug log for the surface module of the pane `title` that failed on `surface`
 * for `reason`, as the surface wrote it.
 */
export function describeModuleFault(title: string, surface: string, reason: string): string {
  return (
    `The ${title} pane failed in its surface module on ${surface}: ${reason}. The pane is drawn ` +
    'without the surface module there until it is opened again.'
  )
}

/** The failure of a post by the surface module of the pane `title` that has `problem`. */
export function describeUnreadablePost(title: string, problem: string): string {
  return `The ${title} pane posted saves that cannot be read: ${problem}.`
}

/** What Enter does in the focused text field of a pane: `submitLabel`, after the Enter mark. */
export function describeEnterHint(submitLabel: string): string {
  return `⏎ ${submitLabel}`
}

/** The mark after the choice shown by a dropdown of a pane while its list is closed. */
export const DROPDOWN_CLOSED_MARK = '▾'

/** The mark after the choice shown by a dropdown of a pane while its list is open. */
export const DROPDOWN_OPEN_MARK = '▴'
