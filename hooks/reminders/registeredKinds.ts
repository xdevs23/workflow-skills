import type { EngineInterface } from 'claude-code'

import type { Reminder } from '../../types'
import type { CadenceKinds } from './cadenceKind'
import { EVENT_CADENCES } from './eventCadence'
import { PHRASE_CADENCE } from './phraseCadence'
import { TIME_CADENCE, followTimedReminders } from './timedDelivery'

/** The cadence kinds of the reminders, in the order of the kind dropdown of a card. */
export const CADENCE_KINDS: CadenceKinds = [
  PHRASE_CADENCE,
  TIME_CADENCE,
  ...EVENT_CADENCES,
]

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
