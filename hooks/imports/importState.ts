import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import { NEW_PANE_RECORD } from '../paneWorker'
import type { StoredPane } from '../paneWorker'
import { ofRunningSession, updateOfSession } from '../sessionBoundState'
import { ImportKind } from './importPaneMessages'
import type {
  ImportAction,
  ImportInPane,
  ImportResult,
  ImportableSessions,
} from './importPaneMessages'

// The engine lists the state a module reads and writes from the source of the module, so every
// state reference of the imports is written in this file with its plugin and key as literals.
const importableSessions = atom(
  { plugin: 'workflow-skills', key: 'importableSessions' } as const,
  null,
)
const goalsImportPane = atom(
  { plugin: 'workflow-skills', key: 'goalsImportPane' } as const,
  NEW_PANE_RECORD,
  { shape: 'saves-by-action-id' },
)
const remindersImportPane = atom(
  { plugin: 'workflow-skills', key: 'remindersImportPane' } as const,
  NEW_PANE_RECORD,
  { shape: 'saves-by-action-id' },
)

/**
 * The sessions of the project as the import panes last read them, while the session that read them
 * runs, and null otherwise.
 */
export async function readImportableSessionsInState(
  $: EngineInterface,
): Promise<ImportableSessions | null> {
  return ofRunningSession($, await read($, importableSessions))
}

/** Puts `loaded`, read for the session `sessionId`, into the state, unless another session runs. */
export async function setImportableSessions(
  $: EngineInterface,
  sessionId: string,
  loaded: ImportableSessions,
): Promise<void> {
  await updateOfSession(
    $,
    sessionId,
    () => ({ sessionId, ...loaded }),
    changeInState => update($, importableSessions, changeInState),
  )
}

/** The import pane of `kind` as the hooks module stores it. */
export function storedImportPane(
  $: EngineInterface,
  kind: ImportKind,
): StoredPane<ImportInPane | null, ImportAction, ImportResult> {
  // The scan of the engine reads each state reference at the call site, so each pane names its
  // atom there.
  switch (kind) {
    case ImportKind.Goals:
      return {
        read: () => read($, goalsImportPane),
        update: change => update($, goalsImportPane, change),
      }
    case ImportKind.Reminders:
      return {
        read: () => read($, remindersImportPane),
        update: change => update($, remindersImportPane, change),
      }
  }
}
