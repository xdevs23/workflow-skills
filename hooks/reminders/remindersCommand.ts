import type {
  Caught,
  CommandRunInput,
  CommandRunResult,
  EngineInterface,
  Frozen,
  MatchedHook,
} from 'claude-code'

import { registerCommandShowingRejection } from '../commandRegistration'
import { replyWithFailures } from '../failureToast'
import { replyToFailedHook } from '../hookFailure'
import type { SWITCHING_SOURCES } from '../sessionSources'
import { loadRemindersShowingFailure } from './reminderActions'
import { REMINDERS_COMMAND } from './reminderNames'
import { describeRemindersPaneFailures, openRemindersPane } from './reminderScreens'
import { readRemindersInState } from './reminderState'
import {
  REMINDERS_DESCRIPTION,
  REMINDERS_SUBJECT,
  describeNotRegistered,
} from './reminderTexts'

/**
 * Registers /reminders for the session, and reads the reminders of the session into the state. A
 * rejection of /reminders by the engine is shown in a toast, and the session start goes on.
 */
export async function startReminders($: EngineInterface): Promise<void> {
  const sessionId = await $.session.id()
  await Promise.all([
    registerCommandShowingRejection(
      $,
      { name: REMINDERS_COMMAND, description: REMINDERS_DESCRIPTION, immediate: true },
      describeNotRegistered,
    ),
    loadRemindersShowingFailure($, sessionId),
  ])
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

/**
 * Reads the reminders of the session again and opens the Reminders pane, whatever arguments follow
 * /reminders. Replies only where the reminders could not be read or the pane could not open.
 */
export const runRemindersCommand: MatchedHook<
  'command.run',
  { command: typeof REMINDERS_COMMAND }
> = async $ =>
  replyWithFailures(
    $,
    describeRemindersPaneFailures(await openRemindersPane($), { command: REMINDERS_COMMAND }),
  )

/** Returns the reply to /reminders when its hook failed, with the reason. */
export function replyWithRemindersHookFailure(
  $: EngineInterface,
  _e: Frozen<CommandRunInput>,
  next: Caught,
): CommandRunResult {
  return replyToFailedHook($, REMINDERS_SUBJECT, next.error)
}
