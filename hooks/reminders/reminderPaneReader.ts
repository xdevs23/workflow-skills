import type { CardDraft } from '../../types'
import { isRecord } from '../pluginStore'
import { isPositiveInteger } from '../positiveInteger'
import { UnreadablePost, unreadableField } from '../unreadablePost'
import { ReminderPaneActionKind } from './reminderPaneMessages'
import type { ReminderPaneAction } from './reminderPaneMessages'
import { parseCadence } from './reminderRecord'

/** Reads the action posted by the surface module of the Reminders pane, which arrives unchecked. */
export function readReminderPaneAction(action: unknown): ReminderPaneAction | UnreadablePost {
  if (!isRecord(action)) {
    return new UnreadablePost('an action is not an object')
  }
  const { reminderId, number, isEnabled } = action
  const kind = Object.values(ReminderPaneActionKind).find(each => each === action.kind)
  if (kind === undefined) {
    return unreadableField('kind')
  }
  if (typeof reminderId !== 'string') {
    return unreadableField('reminderId')
  }
  if (!isPositiveInteger(number)) {
    return unreadableField('number')
  }
  const draft = readDraft(action.draft)
  switch (kind) {
    case ReminderPaneActionKind.Save:
      return draft === undefined ? unreadableField('draft') : { kind, reminderId, number, draft }
    case ReminderPaneActionKind.SaveAndSwitch:
      if (draft === undefined) {
        return unreadableField('draft')
      }

      return typeof isEnabled === 'boolean'
        ? { kind, reminderId, number, draft, isEnabled }
        : unreadableField('isEnabled')
    case ReminderPaneActionKind.Switch:
      return typeof isEnabled === 'boolean'
        ? { kind, reminderId, number, isEnabled }
        : unreadableField('isEnabled')
    case ReminderPaneActionKind.Remove:
      return { kind, reminderId, number }
  }
}

/** The draft in `draft`, or undefined when `draft` is not one. */
function readDraft(draft: unknown): CardDraft | undefined {
  if (!isRecord(draft) || typeof draft.text !== 'string' || !isRecord(draft.nextItems)) {
    return undefined
  }
  const cadence = parseCadence(draft.cadence)
  const nextItems = Object.entries(draft.nextItems).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string',
  )

  return cadence !== undefined && nextItems.length === Object.keys(draft.nextItems).length
    ? { text: draft.text, cadence, nextItems: Object.fromEntries(nextItems) }
    : undefined
}
