import { PANE_CLOSED_BY_USER } from '../paneClose'
import { MILLISECONDS_PER_SECOND } from '../timeUnits'

export const ROAST_COMMAND = 'roast'

export const IDLE_ROAST_COMMAND = 'idle-roast'

/** The words after /idle-roast that set the idle roast of the session. */
export enum IdleRoastWord {
  On = 'on',
  Off = 'off',
}

/** Whether each word after /idle-roast sets the idle roast on. */
export const IS_ON_AFTER: Record<IdleRoastWord, boolean> = {
  [IdleRoastWord.On]: true,
  [IdleRoastWord.Off]: false,
}

const IDLE_ROAST_WORDS: readonly string[] = Object.values(IdleRoastWord)

export function isIdleRoastWord(words: string): words is IdleRoastWord {
  return IDLE_ROAST_WORDS.includes(words)
}

/**
 * How long after its last model request a conversation waits, idle, before the idle roast, and in
 * the main conversation also the roast on hints: a product choice, under the five minutes for
 * which the prompt cache of a session lasts from that request on, so the fork reads the
 * conversation from the cache.
 */
export const IDLE_WAIT_SECONDS = 290

export const IDLE_WAIT_MILLISECONDS = IDLE_WAIT_SECONDS * MILLISECONDS_PER_SECOND

export const ROAST_PANE = 'roast'

export const ROAST_PANE_SITE = { component: 'Pane', requestId: ROAST_PANE } as const

export const SEND_KEY = 'send-roast'

export const ROAST_PANE_CLOSED_BY_USER = { id: ROAST_PANE, ...PANE_CLOSED_BY_USER } as const
