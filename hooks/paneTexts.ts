// The texts shared by the panes of the plugin, so the panes use one word for each action.

/** The label of the button that saves what was typed into a card or a row being edited. */
export const DONE_LABEL = 'Done'

/** The part of the label of the text field where the text of a goal or a reminder is typed. */
export const TEXT_LABEL = 'Text'

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

/** The line in the debug log for a text field of the pane `title` not given the keyboard. */
export function describeFocusNotMoved(title: string, denial: string): string {
  return `The keyboard did not move to a text field of the ${title} pane: ${denial}.`
}

/** The failure of a post by the surface module of the pane `title` that has `problem`. */
export function describeUnreadablePost(title: string, problem: string): string {
  return `The ${title} pane posted saves and text fields that cannot be read: ${problem}.`
}

/**
 * The label of the text field of a pane for `part` of `item`, such as "Goal 3 · Text". Where the
 * surface module draws the pane, its text fields are drawn together under it, away from their card.
 */
export function nameField({ item, part }: { item: string; part: string }): string {
  return `${item} · ${part}`
}

/** The mark after the choice shown by a dropdown of a pane while its list is closed. */
export const DROPDOWN_CLOSED_MARK = '▾'

/** The mark after the choice shown by a dropdown of a pane while its list is open. */
export const DROPDOWN_OPEN_MARK = '▴'
