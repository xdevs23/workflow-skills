export const ROAST_COMMAND = 'roast'

export const ROAST_PANE = 'roast'

export const ROAST_PANE_SITE = { component: 'Pane', requestId: ROAST_PANE } as const

export const SEND_KEY = 'send-roast'

export const ROAST_PANE_CLOSED_BY_USER = { id: ROAST_PANE, origin: { kind: 'person' } } as const
