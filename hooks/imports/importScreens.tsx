import type {
  Caught,
  EngineInterface,
  Frozen,
  RenderElement,
  ResolveInput,
  UiFaultInput,
  UiMessageArgument,
  UiMessageResult,
  UiOpenResult,
} from 'claude-code'

import {
  answerFailedPanePost,
  answerPanePost,
  drawPane,
  recordModuleFault,
  storeOpenedPane,
} from '../paneWorker'
import type { PaneSite } from '../paneWorker'
import { loadImportableSessions } from './importableSessions'
import { IMPORT_NAMES } from './importNames'
import { IMPORT_PANE_MACHINE } from './importPane'
import type {
  ImportAction,
  ImportInPane,
  ImportKind,
  ImportPaneView,
  ImportResult,
  ImportableSessions,
} from './importPaneMessages'
import { readImportAction } from './importPaneReader'
import { readImportPaneView } from './importPaneView'
import { FAILED_IMPORT, IMPORT_TARGETS, saveImport } from './importPresses'
import { setImportableSessions, storedImportPane } from './importState'

/** The sessions of the project read again from the store, and the import pane opened on them. */
type PaneOnFreshSessions = { loaded: ImportableSessions; opened: UiOpenResult }

/**
 * Reads the sessions of the project again into the state, and opens the import pane of `kind`,
 * which lists them. The pane opens on the list of sessions where the hooks module draws it, as a
 * surface module does, and tries its surface module again on every surface.
 */
export async function openImportPane(
  $: EngineInterface,
  kind: ImportKind,
): Promise<PaneOnFreshSessions> {
  await storeOpenedPane(storedImportPane($, kind))
  const loaded = await loadImportableSessions($)
  await setImportableSessions($, await $.session.id(), loaded)
  const { pane, title } = IMPORT_NAMES[kind]
  const opened = await $.ui.open({ id: pane, title, focus: true })

  return { loaded, opened }
}

function importPaneOf(
  $: EngineInterface,
  kind: ImportKind,
): PaneSite<ImportPaneView, ImportInPane | null, ImportAction, ImportResult> {
  return {
    title: IMPORT_NAMES[kind].title,
    machine: IMPORT_PANE_MACHINE,
    readView: () => readImportPaneView($, kind),
    readAction: readImportAction,
    save: action => saveImport($, kind, action),
    failed: FAILED_IMPORT,
    subject: IMPORT_TARGETS[kind].subjects.save,
    stored: storedImportPane($, kind),
  }
}

/**
 * Draws the import pane of `kind` as a surface module where the surface draws one, so its presses
 * do not wait for the worker. Elsewhere the hooks module draws it.
 */
export function drawImportPane(
  $: EngineInterface,
  e: ResolveInput<'Pane'>,
  kind: ImportKind,
): Promise<RenderElement> {
  return drawPane($, e, importPaneOf($, kind), (Client, props) => (
    <Client
      key={IMPORT_NAMES[kind].paneModule}
      module="./importPane.tsx"
      props={props}
      width="100%"
    />
  ))
}

/** Runs the import posted by the surface module of the import pane of `kind`. */
export function answerImportPanePost(
  $: EngineInterface,
  e: Frozen<UiMessageArgument>,
  kind: ImportKind,
): Promise<UiMessageResult> {
  return answerPanePost($, e, importPaneOf($, kind))
}

/** Shows the failure of the hook that ran the import of the pane of `kind`. */
export function answerFailedImportPanePost(
  $: EngineInterface,
  e: Frozen<UiMessageArgument>,
  next: Caught,
  kind: ImportKind,
): Promise<UiMessageResult> {
  return answerFailedPanePost($, e, next, importPaneOf($, kind))
}

/** Draws the import pane of `kind` by the hooks module on a surface where its module failed. */
export function fallBackFromImportPaneModule(
  $: EngineInterface,
  e: Frozen<UiFaultInput>,
  kind: ImportKind,
): Promise<void> {
  return recordModuleFault($, importPaneOf($, kind), e)
}
