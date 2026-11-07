/**
 * The sources of the classic SessionStart hook after which another session may run: /resume, /clear
 * and a fork do not raise a start, but run that hook for the session they switched to.
 */
export const SWITCHING_SOURCES = ['resume', 'clear', 'fork'] as const

/** The source of the classic SessionStart hook after a compaction. */
export const COMPACTION_SOURCE = 'compact'
