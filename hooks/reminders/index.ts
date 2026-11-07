import type { Hook, On } from 'claude-code'

import { EVERY_EVENT } from '../everyEvent'
import { SWITCHING_SOURCES } from '../sessionSources'
import { registerEventCadences } from './eventCadence'
import { registerPhraseCadence } from './phraseCadence'
import { CADENCE_KINDS } from './registeredKinds'
import { REMINDERS_COMMAND, REMINDERS_PANE } from './reminderNames'
import { drawRemindersPane } from './reminderScreens'
import {
  readRemindersOfSwitchedSession,
  replyWithRemindersHookFailure,
  runRemindersCommand,
  startReminders,
} from './remindersCommand'
import { registerTimeCadence } from './timedDelivery'

/** Starts the reminders in a session, with or without the user at the prompt. */
const startRemindersOfSession: Hook<'session.start'> = async ($, e, next) => {
  await startReminders($)

  return next(e)
}

/**
 * Registers the hooks of the reminders, with the kinds of registeredKinds.ts in the kind dropdown
 * of a card. The hooks of each cadence kind come first, so they run around the requests for the
 * reminders here.
 */
export function registerReminders(on: On): void {
  registerPhraseCadence(on)
  registerTimeCadence(on)
  registerEventCadences(on)
  on('session.start', EVERY_EVENT, startRemindersOfSession)
  on('classic.SessionStart', { source: SWITCHING_SOURCES }, readRemindersOfSwitchedSession)
  on('command.run', { command: REMINDERS_COMMAND }, runRemindersCommand).catch(
    replyWithRemindersHookFailure,
  )
  on('ui.render', { component: 'Pane', requestId: REMINDERS_PANE }, ($, e) =>
    drawRemindersPane(CADENCE_KINDS, $, e),
  )
}
