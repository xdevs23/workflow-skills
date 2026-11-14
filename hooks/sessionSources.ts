/**
 * The sources of the classic SessionStart hook after which another session may run: /resume, /clear
 * and a fork do not raise a start, but run that hook for the session they switched to.
 */
export const SWITCHING_SOURCES = ['resume', 'clear', 'fork'] as const

/** The sources of the classic SessionStart hook that begin a session with a new id. */
export const NEW_SESSION_SOURCES = ['startup', 'clear', 'fork'] as const
