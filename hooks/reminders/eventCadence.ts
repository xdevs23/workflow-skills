import type { MatchedHook, On } from 'claude-code'

import { isMainConversation } from '../conversation'
import { submitWithNote } from '../sendToModel'
import { COMPACTION_SOURCE } from '../sessionSources'
import { listKind } from './cadenceKind'
import type { CadenceKind, ListedKind } from './cadenceKind'
import { describeReminderNote, readEnabledReminders } from './reminderDelivery'

// The cadences of reminders sent after an event of the session. The engine hands the model the
// notification of a background task that ended as a prompt, and the reminders go beside it. After
// a compaction, the reminders go into the context block that follows the summary.

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

const addRemindersAfterCompaction: MatchedHook<
  'classic.SessionStart',
  { source: typeof COMPACTION_SOURCE }
> = async ($, e, next) => {
  const ran = await next(e)
  if (!isMainConversation({ agentId: e.agent_id })) {
    return ran
  }
  const note = describeReminderNote(await readEnabledReminders($, AFTER_COMPACTION))
  if (note === undefined) {
    return ran
  }
  $.ui.log(note.line)

  return { ...ran, additionalContext: [...(ran.additionalContext ?? []), note.text] }
}

/** The event cadences, in the order of the kind dropdown. */
export const EVENT_CADENCES: readonly ListedKind[] = [
  listKind(AFTER_BACKGROUND_TASK, registerEventCadences),
  listKind(AFTER_COMPACTION, registerEventCadences),
]

/** Registers the hooks that send the reminders of the event cadences. */
export function registerEventCadences(on: On): void {
  on('prompt.submit', TASK_NOTIFICATION, submitTaskNotificationWithReminders)
  on('classic.SessionStart', { source: COMPACTION_SOURCE }, addRemindersAfterCompaction)
}
