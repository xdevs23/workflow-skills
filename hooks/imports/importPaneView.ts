import type { EngineInterface } from 'claude-code'

import { ImportKind, SessionsShown } from './importPaneMessages'
import type {
  ImportPaneView,
  ListedSession,
  PaneSession,
  RowsOfKinds,
  SessionsOfKind,
} from './importPaneMessages'
import { uniqueIdLengthOf } from './importPaneTexts'
import { readImportableSessionsInState } from './importState'

/** The sessions of the project with goals or reminders of `kind`, as its import pane draws them. */
export async function readImportPaneView(
  $: EngineInterface,
  kind: ImportKind,
): Promise<ImportPaneView> {
  const inState = await readImportableSessionsInState($)
  if (inState === null) {
    return { shown: SessionsShown.NotListed, kind }
  }
  if (inState.shown === SessionsShown.NotRead) {
    return { shown: inState.shown, failure: inState.failure }
  }
  const { sessions, unreadable } = inState

  return {
    shown: inState.shown,
    unreadable,
    idLength: uniqueIdLengthOf(sessions.map(session => session.sessionId)),
    ...sessionsOfKind(sessions, kind),
  }
}

function sessionsOfKind(sessions: readonly ListedSession[], kind: ImportKind): SessionsOfKind {
  switch (kind) {
    case ImportKind.Goals:
      return { kind, sessions: sessions.flatMap(session => paneSessionsOf(session, kind)) }
    case ImportKind.Reminders:
      return { kind, sessions: sessions.flatMap(session => paneSessionsOf(session, kind)) }
  }
}

/**
 * `session` as the import pane of `kind` draws it, with its rows of that kind, or no session when
 * it has none. The pane gets the first prompt and the start time, and not the folder.
 */
function paneSessionsOf<Kind extends ImportKind>(
  { sessionId, start, rows }: ListedSession,
  kind: Kind,
): PaneSession<RowsOfKinds[Kind][number]>[] {
  const counts = {
    [ImportKind.Goals]: rows[ImportKind.Goals].length,
    [ImportKind.Reminders]: rows[ImportKind.Reminders].length,
  }
  const firstPrompt = start?.firstPrompt

  return rows[kind].length === 0
    ? []
    : [
        {
          sessionId,
          ...(start === undefined ? {} : { startedAt: start.startedAt }),
          ...(firstPrompt === undefined ? {} : { firstPrompt }),
          counts,
          rows: rows[kind],
        },
      ]
}
