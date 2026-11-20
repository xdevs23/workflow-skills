import type { CommandRunResult, EngineInterface, MatchedHook } from 'claude-code'

import { replyWithFailures } from '../failureToast'
import { CommandRegistrar, type PluginCommand } from '../pluginCommand'
import type { SWITCHING_SOURCES } from '../sessionSources'
import { loadRemindersShowingFailure } from './reminderActions'
import { REMINDERS_COMMAND } from './reminderNames'
import { describeRemindersPaneFailures, openRemindersPane } from './reminderScreens'
import { readRemindersInState } from './reminderState'
import {
  REMINDERS_DESCRIPTION,
  REMINDERS_LOST_WITHOUT_COMMAND,
  REMINDERS_SUBJECT,
} from './reminderTexts'

/** Reads the reminders of the session into the state. */
export async function startReminders($: EngineInterface): Promise<void> {
  await loadRemindersShowingFailure($, await $.session.id())
}

// The session reads its reminders here unless the state already has them, including reminders that
// could not be read, since a process started with --resume runs this hook after the start read
// them.
export const readRemindersOfSwitchedSession: MatchedHook<
  'classic.SessionStart',
  { source: typeof SWITCHING_SOURCES }
> = async ($, e, next) => {
  if ((await readRemindersInState($)) === null) {
    await loadRemindersShowingFailure($, await $.session.id())
  }

  return next(e)
}

/** /reminders, which opens the Reminders pane. */
export function remindersCommand($: EngineInterface): PluginCommand {
  return {
    spec: { name: REMINDERS_COMMAND, description: REMINDERS_DESCRIPTION, immediate: true },
    registeredBy: CommandRegistrar.CommandList,
    lostWithoutCommand: REMINDERS_LOST_WITHOUT_COMMAND,
    isInteractiveOnly: false,
    run: () => runRemindersCommand($),
    subjectOf: () => REMINDERS_SUBJECT,
  }
}

/**
 * Reads the reminders of the session again and opens the Reminders pane, whatever arguments follow
 * /reminders. Replies only where the reminders could not be read or the pane could not open.
 */
async function runRemindersCommand($: EngineInterface): Promise<CommandRunResult> {
  return replyWithFailures(
    $,
    describeRemindersPaneFailures(await openRemindersPane($), { command: REMINDERS_COMMAND }),
  )
}
