/**
 * The sources of the classic SessionStart hook after which another session may run: /resume, /clear
 * and a fork do not raise a start, but run that hook for the session they switched to.
 */
export const SWITCHING_SOURCES = ['resume', 'clear', 'fork'] as const

/** The sources of the classic SessionStart hook that begin a session with a new id. */
export const NEW_SESSION_SOURCES = ['startup', 'clear', 'fork'] as const

export const EMPTY_CONVERSATION_SOURCES = ['startup', 'clear'] as const

export const CONTINUED_CONVERSATION_SOURCES = ['resume', 'fork'] as const

/**
 * The sources of the classic SessionStart hook that start a conversation, each with whether the
 * conversation starts empty, so its model has read only the system prompt.
 */
export const CONVERSATION_STARTS = [
  { source: EMPTY_CONVERSATION_SOURCES, isEmpty: true },
  { source: CONTINUED_CONVERSATION_SOURCES, isEmpty: false },
] as const
