import type { EngineInterface } from 'claude-code'

import { describeUnreadableRecord } from '../pluginStore'
import { RemindersShown } from './reminderPaneMessages'
import type { RemindersPaneView } from './reminderPaneMessages'
import { Outcome } from './reminders'
import { readNextSends, readRemindersInState } from './reminderState'
import { describeNotRead } from './reminderTexts'

/** The reminders of the session as the Reminders pane draws them. */
export async function readRemindersPaneView($: EngineInterface): Promise<RemindersPaneView> {
  const [inState, nextSends, now] = await Promise.all([
    readRemindersInState($),
    readNextSends($),
    $.clock.now(),
  ])
  if (inState === null) {
    return { shown: RemindersShown.Loading }
  }
  if (inState.outcome === Outcome.Failed) {
    return { shown: RemindersShown.NotRead, failure: describeNotRead(inState) }
  }
  const { reminders, unreadableKeys } = inState

  return {
    shown: RemindersShown.Read,
    reminders,
    unreadable: unreadableKeys.map(describeUnreadableRecord),
    nextSends,
    now,
  }
}
