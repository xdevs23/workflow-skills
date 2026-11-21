import { PANE_CLOSED_BY_USER } from '../paneClose'

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
 * How long the main conversation is idle after the last response before the idle roast and the
 * roast on hints: a product choice, under the five minutes for which the prompt cache of a session
 * may last, so the fork reads the conversation from the cache.
 */
export const IDLE_WAIT_SECONDS = 290

export const ROAST_PANE = 'roast'

export const ROAST_PANE_SITE = { component: 'Pane', requestId: ROAST_PANE } as const

export const SEND_KEY = 'send-roast'

export const ROAST_PANE_CLOSED_BY_USER = { id: ROAST_PANE, ...PANE_CLOSED_BY_USER } as const
