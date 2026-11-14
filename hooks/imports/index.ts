import type { CommandRunResult, EngineInterface, On } from 'claude-code'

import { registerCommandShowingRejection } from '../commandRegistration'
import { EVERY_EVENT } from '../everyEvent'
import { replyWithFailures } from '../failureToast'
import { replyToFailedHook } from '../hookFailure'
import { describePaneNotOpened } from '../paneOpening'
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
import { describeNotRegistered } from './importTexts'
import { deleteRecordsOfSessionWithoutImports } from './sessionEnd'

/**
 * Registers /goals-import and /reminders-import for the session. A rejection by the engine is shown
 * in a toast, and the session start goes on.
 */
async function registerImportCommands($: EngineInterface): Promise<void> {
  await Promise.all(
    Object.values(ImportKind).map(kind => {
      const { command, description } = IMPORT_NAMES[kind]

      return registerCommandShowingRejection(
        $,
        { name: command, description, immediate: true },
        reason => describeNotRegistered(command, reason),
      )
    }),
  )
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
 * Registers the commands and the panes that import goals and reminders of earlier sessions, and
 * the deletion of the records of a session that ends without goals and reminders.
 */
export function registerImports(on: On): void {
  on('session.start', EVERY_EVENT, async ($, e, next) => {
    await registerImportCommands($)

    return next(e)
  })
  on('session.end', EVERY_EVENT, async ($, e, next) => {
    await deleteRecordsOfSessionWithoutImports($, e.sessionId)

    return next(e)
  })
  for (const kind of Object.values(ImportKind)) {
    const site = importPaneSiteOf(kind)
    const { subjects } = IMPORT_TARGETS[kind]
    on('command.run', { command: IMPORT_NAMES[kind].command }, $ =>
      runImportCommand($, kind),
    ).catch(($, _e, next) => replyToFailedHook($, subjects.command, next.error))
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
