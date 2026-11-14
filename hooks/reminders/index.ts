import type { Hook, On } from 'claude-code'

import { EVERY_EVENT } from '../everyEvent'
import type { PromptFooter } from '../promptFooter'
import { SWITCHING_SOURCES } from '../sessionSources'
import { registerEventCadences } from './eventCadence'
import { registerPhraseCadence } from './phraseCadence'
import { REMINDERS_COMMAND, REMINDERS_PANE_SITE } from './reminderNames'
import {
  answerFailedRemindersPanePost,
  answerRemindersPanePost,
  drawRemindersPane,
  fallBackFromRemindersPaneModule,
} from './reminderScreens'
import {
  readRemindersOfSwitchedSession,
  replyWithRemindersHookFailure,
  runRemindersCommand,
  startReminders,
} from './remindersCommand'
import { REMINDERS_BUTTON, openRemindersFromButton } from './remindersButton'
import { registerTimeCadence } from './timedDelivery'

/** Starts the reminders in a session, with or without the user at the prompt. */
const startRemindersOfSession: Hook<'session.start'> = async ($, e, next) => {
  await startReminders($)

  return next(e)
}

/**
 * Registers the hooks of the reminders, and places the Reminders button on the prompt footer
 * `footer`. The hooks of each cadence kind come first, so they run around the requests for the
 * reminders here.
 */
export function registerReminders(on: On, footer: PromptFooter): void {
  registerPhraseCadence(on)
  registerTimeCadence(on)
  registerEventCadences(on)
  on('session.start', EVERY_EVENT, startRemindersOfSession)
  on('classic.SessionStart', { source: SWITCHING_SOURCES }, readRemindersOfSwitchedSession)
  on('command.run', { command: REMINDERS_COMMAND }, runRemindersCommand).catch(
    replyWithRemindersHookFailure,
  )
  on('ui.render', REMINDERS_PANE_SITE, drawRemindersPane)
  on('ui.message', REMINDERS_PANE_SITE, answerRemindersPanePost).catch(
    answerFailedRemindersPanePost,
  )
  on('ui.fault', REMINDERS_PANE_SITE, fallBackFromRemindersPaneModule)
  on('ui.press', footer.place(REMINDERS_BUTTON), openRemindersFromButton)
}
