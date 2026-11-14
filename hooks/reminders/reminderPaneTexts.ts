// The texts of the Reminders pane, drawn by its surface module and by the hooks module.

export const PANE_TITLE = 'Reminders'
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
/** What Enter does in the field that adds an item to a list, drawn beside the field. */
export const ADD_ITEM_SUBMIT = 'add'
/** The mark on the button that removes an item of a list. */
export const REMOVE_ITEM_MARK = '×'
export const BLANK_TEXT_WARNING = 'A reminder needs a text.'
export const MISSHAPEN_VALUES =
  'This version of the plugin cannot read the values stored for this cadence. Press Edit to set ' +
  'them again.'
export const UNKNOWN_CADENCE =
  'This version of the plugin does not know this cadence. Press Edit to pick another.'
export const REMINDERS_LOADING = 'Reading the reminders of this session…'
export const SAVING = 'Saving…'
/** The line in place of the button that adds a reminder, on a surface without input fields. */
export const FIELDS_IN_TERMINAL_ONLY =
  `Add and edit reminders in the ${PANE_TITLE} pane in a terminal.`

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

/** The name of the button that removes `item` from a list, read out in place of its mark. */
export function describeRemoveItem(item: string): string {
  return `Remove "${item}"`
}

export function describeRemoveQuestion(number: number): string {
  return `Remove ${nameReminder(number)}?`
}
