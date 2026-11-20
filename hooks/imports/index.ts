import type { CommandRunResult, EngineInterface, On } from 'claude-code'

import { EVERY_EVENT } from '../everyEvent'
import { replyWithFailures } from '../failureToast'
import { describePaneNotOpened } from '../paneOpening'
import { CommandRegistrar, type PluginCommand } from '../pluginCommand'
import { IMPORT_NAMES, importPaneSiteOf } from './importNames'
import { ImportKind, SessionsShown } from './importPaneMessages'
import {
  answerFailedImportPanePost,
  answerImportPanePost,
  drawImportPane,
  fallBackFromImportPaneModule,
  openImportPane,
} from './importScreens'
import { IMPORT_TARGETS } from './importPresses'
import { IMPORT_LOST_WITHOUT_COMMAND } from './importTexts'
import { deleteRecordsOfSessionWithoutImports } from './sessionEnd'

/** /goals-import and /reminders-import, which open the import pane of their kind. */
export function importCommands($: EngineInterface): PluginCommand[] {
  return Object.values(ImportKind).map(kind => ({
    spec: {
      name: IMPORT_NAMES[kind].command,
      description: IMPORT_NAMES[kind].description,
      immediate: true,
    },
    registeredBy: CommandRegistrar.CommandList,
    lostWithoutCommand: IMPORT_LOST_WITHOUT_COMMAND,
    isInteractiveOnly: false,
    run: () => runImportCommand($, kind),
    subjectOf: () => IMPORT_TARGETS[kind].subjects.command,
  }))
}

/**
 * Reads the sessions of the project again and opens the import pane of `kind`, whatever arguments
 * follow its command. Replies only where the sessions could not be listed or the pane could not
 * open.
 */
async function runImportCommand($: EngineInterface, kind: ImportKind): Promise<CommandRunResult> {
  const { loaded, opened } = await openImportPane($, kind)

  return replyWithFailures($, [
    ...(opened.isPlaced
      ? []
      : [
          describePaneNotOpened(IMPORT_NAMES[kind].title, opened.reason, {
            command: IMPORT_NAMES[kind].command,
          }),
        ]),
    ...(loaded.shown === SessionsShown.NotRead ? [loaded.failure] : []),
  ])
}

/**
 * Registers the panes that import goals and reminders of earlier sessions, and the deletion of the
 * records of a session that ends without goals and reminders.
 */
export function registerImports(on: On): void {
  on('session.end', EVERY_EVENT, async ($, e, next) => {
    await deleteRecordsOfSessionWithoutImports($, e.sessionId)

    return next(e)
  })
  for (const kind of Object.values(ImportKind)) {
    const site = importPaneSiteOf(kind)
    on('ui.render', site, ($, e) => drawImportPane($, e, kind))
    on('ui.message', site, ($, e) => answerImportPanePost($, e, kind)).catch(($, e, next) =>
      answerFailedImportPanePost($, e, next, kind),
    )
    on('ui.fault', site, async ($, e, next) => {
      await fallBackFromImportPaneModule($, e, kind)

      return next(e)
    })
  }
}
