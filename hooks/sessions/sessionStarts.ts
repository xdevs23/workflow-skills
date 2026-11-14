import type { EngineInterface } from 'claude-code'

import { HistoryOutcome, readStartsFromPromptHistory } from './promptHistory'
import type { PromptHistoryRead } from './promptHistory'
import { StartOutcome, readSessionStart } from './sessionStore'
import type { RecordedStart } from './sessionStore'

/** The start found for each of several sessions, and what became of each source read for them. */
export type SessionStarts = {
  starts: ReadonlyMap<string, RecordedStart>
  /** The keys of the start records in a shape that this code does not read. */
  unreadableKeys: readonly string[]
  /** The attempt to read the prompt history for the sessions that did not record their start. */
  history: PromptHistoryRead
}

/**
 * The start of each session named in `sessionIds`: the one recorded by the session, or the one
 * found in the prompt history of Claude Code for a session that did not record its start. A
 * session with a start record in another shape gets no start.
 */
export async function readSessionStarts(
  $: EngineInterface,
  sessionIds: readonly string[],
): Promise<SessionStarts> {
  const recorded = await Promise.all(
    sessionIds.map(async sessionId => ({ sessionId, read: await readSessionStart($, sessionId) })),
  )
  const history = await readStartsFromPromptHistory(
    $,
    recorded.flatMap(({ sessionId, read }) =>
      read.outcome === StartOutcome.Missing ? [sessionId] : [],
    ),
  )
  const starts = new Map(history.outcome === HistoryOutcome.Read ? history.starts : [])
  for (const { sessionId, read } of recorded) {
    if (read.outcome === StartOutcome.Read) {
      starts.set(sessionId, read.start)
    }
  }

  return {
    starts,
    unreadableKeys: recorded.flatMap(({ read }) =>
      read.outcome === StartOutcome.Unreadable ? [read.key] : [],
    ),
    history,
  }
}
