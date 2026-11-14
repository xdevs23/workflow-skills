import type { EngineInterface, On } from 'claude-code'

import type { Reminder } from '../../types'
import { registerEventCadences } from './eventCadence'
import { AFTER_BACKGROUND_TASK, AFTER_COMPACTION } from './eventKinds'
import { registerPhraseCadence } from './phraseCadence'
import { PHRASE_KIND } from './phraseKind'
import { TIME_KIND } from './timeKind'
import { followTimedReminders, registerTimeCadence } from './timedDelivery'

/**
 * The function that registers the hooks sending the reminders of each cadence kind, by the id of
 * the kind. registerReminders calls each by its name.
 */
export const KIND_REGISTRATIONS: Readonly<Record<string, (on: On) => void>> = {
  [PHRASE_KIND.id]: registerPhraseCadence,
  [TIME_KIND.id]: registerTimeCadence,
  [AFTER_BACKGROUND_TASK.id]: registerEventCadences,
  [AFTER_COMPACTION.id]: registerEventCadences,
}

/**
 * Hands `reminders`, every reminder of the session `sessionId`, to each kind that follows them,
 * each time the core reads them into the state: at the start of the session, at /reminders and
 * after every change in the pane. The engine passes `$` only to a function named at the call, so
 * each kind is called by the name of its function.
 */
export async function followReminders(
  $: EngineInterface,
  sessionId: string,
  reminders: readonly Reminder[],
): Promise<void> {
  await followTimedReminders($, sessionId, reminders)
}
