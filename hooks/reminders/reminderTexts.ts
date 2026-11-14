import type { HookSubject } from '../hookFailure'
import { describeFailedStoreCall } from '../pluginStore'
import type { FailedStoreCall } from '../pluginStore'
import { REMINDERS_COMMAND } from './reminderNames'
import { PANE_TITLE, nameReminder } from './reminderPaneTexts'
import type { RemindersNotRead } from './reminderStore'

// The texts of the reminders shown to the user at the prompt.

export const REMINDERS_BUTTON_LABEL = PANE_TITLE

export const REMINDERS_DESCRIPTION = `Open the reminders of this session in the ${PANE_TITLE} pane`

/** The reminders as written in the texts about a failed hook of /reminders. */
export const REMINDERS_SUBJECT: HookSubject = { name: 'reminders' }

/**
 * The reminders as written in the texts about a failed hook that saves a change made in the pane.
 */
export const REMINDERS_PANE_SUBJECT: HookSubject = {
  name: 'reminders',
  checkBeforeRetry: `Check the reminders in the ${PANE_TITLE} pane before you try again.`,
}

/** What a press shows for a reminder removed since the pane drew it. */
export function describeRemovedMeanwhile(number: number): string {
  return `${nameReminder(number)} was removed.`
}

export function describeNotRegistered(reason: string): string {
  return (
    `/${REMINDERS_COMMAND} could not be registered, so the reminders of this session cannot be ` +
    `opened or changed: ${reason}. If another plugin uses the name /${REMINDERS_COMMAND}, turn ` +
    'that plugin off and start a new session. The debug log has this too.'
  )
}

/** The text for reminders that could not be read, with the reason and the next step. */
export function describeNotRead(failed: RemindersNotRead): string {
  return `The reminders of this session could not be read. ${describeFailedStoreCall(failed)}`
}

export function describeNotSaved(failed: FailedStoreCall): string {
  return `The reminder was not saved. ${describeFailedStoreCall(failed)}`
}

export function describeNotSwitched(failed: FailedStoreCall): string {
  return `The reminder was not switched. ${describeFailedStoreCall(failed)}`
}

export function describeNotRemoved(failed: FailedStoreCall): string {
  return `The reminder was not removed. ${describeFailedStoreCall(failed)}`
}
