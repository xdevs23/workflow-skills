import type { HookSubject } from '../hookFailure'
import { describeFailedStoreCall } from '../pluginStore'
import type { FailedStoreCall } from '../pluginStore'
import { CardFocus } from './cardFocus'
import type { FocusTarget } from './cardFocus'
import { REMINDERS_COMMAND } from './reminderNames'
import type { RemindersNotRead } from './reminderStore'

// The texts of the reminders shown to the user at the prompt.

export const PANE_TITLE = 'Reminders'
export const REMINDERS_BUTTON_LABEL = PANE_TITLE
export const ADD_LABEL = '+ Add reminder'
export const EDIT_LABEL = 'Edit'
export const REMOVE_LABEL = 'Remove'
export const YES_REMOVE_LABEL = 'Yes, remove'
export const KEEP_LABEL = 'Keep'
export const ON_LABEL = '● On'
export const OFF_LABEL = '○ Off'
export const TEXT_LABEL = 'Text'
export const CADENCE_LABEL = 'Cadence'
export const TEXT_PLACEHOLDER = 'What Claude should do'
export const BLANK_TEXT_WARNING = 'A reminder needs a text.'
export const UNKNOWN_CADENCE =
  'This version of the plugin does not know this cadence. Press Edit to pick another.'
export const REMINDERS_LOADING = 'Reading the reminders of this session…'
export const SAVING = 'Saving…'
/** The line in place of the button that adds a reminder, on a surface without input fields. */
export const FIELDS_IN_TERMINAL_ONLY =
  `Add and edit reminders in the ${PANE_TITLE} pane in a terminal.`

export const REMINDERS_DESCRIPTION = `Open the reminders of this session in the ${PANE_TITLE} pane`

/** The reminders as written in the texts about a failed hook of /reminders, which saves nothing. */
export const REMINDERS_SUBJECT: HookSubject = { name: 'reminders' }

const TIME_OF_DAY = new Intl.DateTimeFormat('en', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})
const DAY_AND_TIME = new Intl.DateTimeFormat('en', {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})
const DAY = new Intl.DateTimeFormat('en', { dateStyle: 'short' })

/**
 * When a reminder is next sent, at `at`, after the cadence line of its card: "· next 15:00", and
 * "· next Nov 8, 15:00" on a day after the day of `now`. Written in the time zone of the machine.
 */
export function describeNextSend(at: number, now: number): string {
  const format = DAY.format(at) === DAY.format(now) ? TIME_OF_DAY : DAY_AND_TIME

  return `· next ${format.format(at)}`
}

/** The name of reminder `number` in every text, such as "Reminder 2". */
export function nameReminder(number: number): string {
  return `Reminder ${number}`
}

export function describeRemoveQuestion(number: number): string {
  return `Remove ${nameReminder(number)}?`
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

/** The line in the debug log when the engine denies moving the focus to the field `target`. */
export function describeFocusNotMoved(denial: string, target: FocusTarget): string {
  const field = FOCUS_FIELD_NAMES[target.field]

  return `The focus did not move to the ${field} of ${nameReminder(target.number)}: ${denial}`
}

const FOCUS_FIELD_NAMES: Record<CardFocus, string> = {
  [CardFocus.Text]: 'text field',
}
