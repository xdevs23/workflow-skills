import type { EngineInterface, MatchedHook, On } from 'claude-code'

import type { CompactionNoteSource } from '../afterCompaction'
import { submitWithNote } from '../sendToModel'
import { listKind } from './cadenceKind'
import type { CadenceKind, ListedKind } from './cadenceKind'
import { describeReminderNote, readEnabledReminders } from './reminderDelivery'

// The cadences of reminders sent after an event of the session. The engine hands the model the
// notification of a background task that ended as a prompt, and the reminders go beside it. After
// a compaction, they go with the other notes sent by hooks/afterCompaction.ts.

/** A cadence that an event of the session brings. It has no value fields and no settings. */
type EventKind = CadenceKind<undefined, never>

function eventKindOf(id: string, label: string): EventKind {
  return { id, label, fields: [], read: () => undefined }
}

export const AFTER_BACKGROUND_TASK = eventKindOf('after-background-task', 'after a background task')

export const AFTER_COMPACTION = eventKindOf('after-compaction', 'after a compaction')

const TASK_NOTIFICATION = { origin: { kind: 'task-notification' } } as const

const submitTaskNotificationWithReminders: MatchedHook<
  'prompt.submit',
  typeof TASK_NOTIFICATION
> = async ($, e, next) => {
  const note = describeReminderNote(await readEnabledReminders($, AFTER_BACKGROUND_TASK))
  if (note === undefined) {
    return next(e)
  }
  const delivery = await submitWithNote(e, next, note.text)
  if (delivery.isAccepted) {
    $.ui.log(note.line)
  }

  return delivery.result
}

/**
 * The reminders of the cadence after a compaction, switched on, sent to the main conversation after
 * it compacts, together with the open goals.
 */
export function remindersAfterCompaction($: EngineInterface): CompactionNoteSource {
  return {
    takeNote: async () => describeReminderNote(await readEnabledReminders($, AFTER_COMPACTION)),
    describeNotSent: reason =>
      `The reminders set to come after a compaction could not be sent to Claude: ${reason}. ` +
      'Open /reminders and send their texts to Claude in a prompt.',
  }
}

/** The event cadences, in the order of the kind dropdown. */
export const EVENT_CADENCES: readonly ListedKind[] = [
  listKind(AFTER_BACKGROUND_TASK, registerEventCadences),
  listKind(AFTER_COMPACTION, registerEventCadences),
]

/** Registers the hooks that send the reminders of the event cadences. */
export function registerEventCadences(on: On): void {
  on('prompt.submit', TASK_NOTIFICATION, submitTaskNotificationWithReminders)
}
