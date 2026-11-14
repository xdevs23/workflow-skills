export const REMINDERS_COMMAND = 'reminders'

export const REMINDERS_PANE = 'reminders'

/** The site of the Reminders pane, which its hooks match. */
export const REMINDERS_PANE_SITE = { component: 'Pane', requestId: REMINDERS_PANE } as const

/** The key of the region the surface module of the Reminders pane draws. */
export const REMINDERS_PANE_MODULE = 'reminders-pane'
