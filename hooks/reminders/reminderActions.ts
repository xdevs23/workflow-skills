import type { EngineInterface } from 'claude-code'

import { showFailure } from '../failureToast'
import { followReminders } from './registeredKinds'
import { Outcome } from './reminders'
import type { CheckedDraft } from './reminders'
import { setLoadedReminders } from './reminderState'
import {
  loadReminders,
  saveDraft,
  saveImportedReminders,
  saveRemoval,
  saveSwitch,
} from './reminderStore'
import type { Failed, ReadReminders, ReminderChange, RemindersImported } from './reminderStore'
import { describeNotRead } from './reminderTexts'

// After every change of a reminder, the state gets the reminders as the change left them in the
// store, through the same path as the request at the start of a session, so the pane shows what the
// store has. The cadence kinds that follow the reminders get them on that path too.

/** Reads the reminders of the session `sessionId` from the store into the state. */
export async function loadRemindersIntoState(
  $: EngineInterface,
  sessionId: string,
): Promise<ReadReminders | Failed> {
  const loaded = await loadReminders($, sessionId)
  await putIntoState($, sessionId, loaded)

  return loaded
}

/** Reads the reminders as loadRemindersIntoState does, and shows a failed read in a toast. */
export async function loadRemindersShowingFailure(
  $: EngineInterface,
  sessionId: string,
): Promise<void> {
  const loaded = await loadRemindersIntoState($, sessionId)
  if (loaded.outcome === Outcome.Failed) {
    showFailure($, describeNotRead(loaded))
  }
}

/** Saves the card `draft` of the reminder with the id `reminderId`, as saveDraft does. */
export async function saveDraftOfSession(
  $: EngineInterface,
  sessionId: string,
  reminderId: string,
  draft: CheckedDraft,
): Promise<ReminderChange> {
  const saved = await saveDraft($, sessionId, reminderId, draft, await $.clock.now())

  return loadAfterChange($, sessionId, saved)
}

export async function switchReminderOfSession(
  $: EngineInterface,
  sessionId: string,
  reminderId: string,
  isEnabled: boolean,
): Promise<ReminderChange> {
  const switched = await saveSwitch($, sessionId, reminderId, isEnabled, await $.clock.now())

  return loadAfterChange($, sessionId, switched)
}

export async function removeReminderOfSession(
  $: EngineInterface,
  sessionId: string,
  reminderId: string,
): Promise<ReminderChange> {
  const removed = await saveRemoval($, sessionId, reminderId, await $.clock.now())

  return loadAfterChange($, sessionId, removed)
}

/**
 * Imports the reminders with the ids `picked` of the session `from` into the session `into` as new
 * reminders, as saveImportedReminders stores them. The reminders of `from` are left as they are. A
 * failed import may have stored some of the reminders, so they are read into the state again.
 */
export async function importRemindersIntoSession(
  $: EngineInterface,
  { into, from, picked }: { into: string; from: string; picked: ReadonlySet<string> },
): Promise<RemindersImported | Failed> {
  const source = await loadReminders($, from)
  if (source.outcome === Outcome.Failed) {
    return source
  }
  const reminderImport = { into, from: source.reminders, picked }
  const imported = await saveImportedReminders($, reminderImport, await $.clock.now())
  await putIntoState(
    $,
    into,
    imported.outcome === Outcome.Failed ? await loadReminders($, into) : imported.read,
  )

  return imported
}

/**
 * Puts the reminders as `change` left them into the state, unless the store failed. A refused
 * change found a reminder removed by another process, which the state then shows too.
 */
async function loadAfterChange(
  $: EngineInterface,
  sessionId: string,
  change: ReminderChange,
): Promise<ReminderChange> {
  if (change.outcome !== Outcome.Failed) {
    await putIntoState($, sessionId, change.read)
  }

  return change
}

/**
 * Puts `loaded` into the state, and hands the reminders read that the state then has to the kinds
 * that follow them.
 */
async function putIntoState(
  $: EngineInterface,
  sessionId: string,
  loaded: ReadReminders | Failed,
): Promise<void> {
  const reminders = await setLoadedReminders($, sessionId, loaded)
  if (reminders !== undefined) {
    await followReminders($, sessionId, reminders)
  }
}
