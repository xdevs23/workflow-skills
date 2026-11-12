import type { Reminder } from '../../types'
import {
  StoreCall,
  callStore,
  readEntriesUnder,
  returningStoreFailure,
  writeRetryingWhileLocked,
} from '../pluginStore'
import type { FailedStoreCall, StoreEngine, StoredEntry } from '../pluginStore'
import {
  cadenceRecordOf,
  enabledRecordOf,
  readReminders,
  reminderRecordOf,
  remindersPrefixOf,
  removalRecordOf,
  textRecordOf,
} from './reminderRecord'
import type { ReminderRecord } from './reminderRecord'
import { Outcome, Refusal, isRemoved, isSameCadence, nextNumberOf } from './reminders'
import type { Changed, CheckedDraft, RemovedRefused, Unchanged } from './reminders'

// The store does not offer compare-and-set. Every change writes only the records of the parts it
// changes, so changes made at once by several processes of a session do not overwrite each other.

/** The reminders of a session read from the store, and the keys of the records not read. */
export type ReadReminders = {
  outcome: Outcome.Read
  reminders: readonly Reminder[]
  unreadableKeys: readonly string[]
}

/** A call on the store that failed. Nothing was changed. */
export type Failed = { outcome: Outcome.Failed } & FailedStoreCall

/**
 * Reminders the store could not read, as the state holds them: plain data, with the message of the
 * error of the store in place of the error.
 */
export type RemindersNotRead = { outcome: Outcome.Failed } & Omit<FailedStoreCall, 'cause'> & {
  cause: Pick<Error, 'message'>
}

/**
 * The outcomes of a change of a reminder in the store. A change that reached the store has the
 * reminders as they are after it, read once at its start, with the records it wrote.
 */
export type ReminderChange =
  | ((Changed | Unchanged | RemovedRefused) & { read: ReadReminders })
  | Failed

/** The records a change writes for a reminder, or why it writes none. */
type RecordsToWrite =
  | { outcome: Outcome.Changed; records: readonly ReminderRecord[] }
  | RemovedRefused

export function loadReminders(
  $: StoreEngine,
  sessionId: string,
): Promise<ReadReminders | Failed> {
  return returningFailure(async () =>
    readOf(sessionId, await readEntriesUnder($, remindersPrefixOf(sessionId))),
  )
}

/**
 * Saves the card `draft` of the reminder with the id `reminderId`: adds the reminder when it is
 * not stored yet, and otherwise writes its text and its cadence where `draft` changed them. A
 * reminder added once is found stored by every later save of the same card, so no save adds it
 * twice.
 */
export function saveDraft(
  $: StoreEngine,
  sessionId: string,
  reminderId: string,
  draft: CheckedDraft,
  savedAt: number,
): Promise<ReminderChange> {
  const { text, cadence } = draft

  return changeReminder($, sessionId, reminderId, (stored, reminders) => {
    if (stored === undefined) {
      const number = nextNumberOf(reminders)
      const added = { id: reminderId, number, text, addedAt: savedAt, cadence }

      return writing([reminderRecordOf(sessionId, added)])
    }
    if (isRemoved(stored)) {
      return REMOVED
    }

    return writing([
      ...(text === stored.text ? [] : [textRecordOf(sessionId, reminderId, text, savedAt)]),
      ...(isSameCadence(cadence, stored.cadence)
        ? []
        : [cadenceRecordOf(sessionId, reminderId, cadence, savedAt)]),
    ])
  })
}

/** Switches the stored reminder with the id `reminderId` on or off. */
export function saveSwitch(
  $: StoreEngine,
  sessionId: string,
  reminderId: string,
  isEnabled: boolean,
  switchedAt: number,
): Promise<ReminderChange> {
  return changeReminder($, sessionId, reminderId, stored =>
    stored === undefined || isRemoved(stored)
      ? REMOVED
      : writing(
          stored.isEnabled === isEnabled
            ? []
            : [enabledRecordOf(sessionId, reminderId, isEnabled, switchedAt)],
        ),
  )
}

export function saveRemoval(
  $: StoreEngine,
  sessionId: string,
  reminderId: string,
  removedAt: number,
): Promise<ReminderChange> {
  return changeReminder($, sessionId, reminderId, stored =>
    stored === undefined || isRemoved(stored)
      ? REMOVED
      : writing([removalRecordOf(sessionId, reminderId, removedAt)]),
  )
}

const REMOVED: RemovedRefused = { outcome: Outcome.Refused, refusal: Refusal.Removed }

function writing(records: readonly ReminderRecord[]): RecordsToWrite {
  return { outcome: Outcome.Changed, records }
}

/**
 * Reads the reminders of the session, and writes the records that `recordsOf` returns for the
 * reminder with the id `reminderId`, which it gets as stored, or undefined when it is not stored,
 * with every reminder read. No record leaves the reminder unchanged.
 */
function changeReminder(
  $: StoreEngine,
  sessionId: string,
  reminderId: string,
  recordsOf: (stored: Reminder | undefined, reminders: readonly Reminder[]) => RecordsToWrite,
): Promise<ReminderChange> {
  return returningFailure(async () => {
    const entries = await readEntriesUnder($, remindersPrefixOf(sessionId))
    const { reminders } = readOf(sessionId, entries)
    const change = recordsOf(
      reminders.find(reminder => reminder.id === reminderId),
      reminders,
    )
    if (change.outcome === Outcome.Refused) {
      return { ...change, read: readOf(sessionId, entries) }
    }
    const { records } = change
    for (const record of records) {
      await callStore(StoreCall.Write, record.key, () =>
        writeRetryingWhileLocked($, record.key, () => $.store.set(record.key, record.value)),
      )
    }
    const read = readOf(sessionId, withRecords(entries, records))

    return records.length === 0
      ? { outcome: Outcome.Unchanged, read }
      : { outcome: Outcome.Changed, read }
  })
}

function readOf(sessionId: string, entries: readonly StoredEntry[]): ReadReminders {
  return { outcome: Outcome.Read, ...readReminders(sessionId, entries) }
}

/**
 * `entries` as the store has them after `records` were written: a record under a key set before
 * takes the place of its entry, and a record under a new key comes last.
 */
function withRecords(
  entries: readonly StoredEntry[],
  records: readonly ReminderRecord[],
): StoredEntry[] {
  const byKey = new Map<string, unknown>(entries.map(({ key, value }) => [key, value]))
  for (const { key, value } of records) {
    byKey.set(key, value)
  }

  return [...byKey].map(([key, value]) => ({ key, value }))
}

/** Runs `work`, and returns the failure of the store that stopped it. */
function returningFailure<T>(work: () => Promise<T>): Promise<T | Failed> {
  return returningStoreFailure(work, failed => ({ outcome: Outcome.Failed, ...failed }))
}
