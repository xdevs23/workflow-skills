import type { EngineInterface, MatchedHook, On } from 'claude-code'

import type { CompactionNoteSource } from '../afterCompaction'
import { submitWithNote } from '../sendToModel'
import { AFTER_BACKGROUND_TASK, AFTER_COMPACTION } from './eventKinds'
import { describeReminderNote, readEnabledReminders } from './reminderDelivery'

// The cadences of reminders sent after an event of the session. The engine hands the model the
// notification of a background task that ended as a prompt, and the reminders go beside it. After
// a compaction, they go with the other notes sent by hooks/afterCompaction.ts.

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

/** Registers the hooks that send the reminders of the event cadences. */
export function registerEventCadences(on: On): void {
  on('prompt.submit', TASK_NOTIFICATION, submitTaskNotificationWithReminders)
}
