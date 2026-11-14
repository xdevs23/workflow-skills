import type { Cadence, CadenceValue, Reminder } from '../../types'
import { RecordKind, isRecord, keyPartAfter, readStrings, recordPrefixOf } from '../pluginStore'
import { isPositiveInteger } from '../positiveInteger'
import type { StoredEntry } from '../pluginStore'

// The version of the records written by this code. A record of a higher version was written by a
// newer plugin with fields this code can misread, so it is unreadable and left as it is.
const RECORD_VERSION = 1

/** The kind of scope named in the keys of the reminders after the kind of record. */
const SESSION_SCOPE = 'session'

/**
 * The parts of a reminder, each stored under a key of its own, so that a change writes one key and
 * changes made at once by several processes do not overwrite each other.
 */
enum RecordPart {
  Reminder = 'reminder',
  Text = 'text',
  Cadence = 'cadence',
  Enabled = 'enabled',
  Removal = 'removal',
}

type StoredRecord = { version: typeof RECORD_VERSION } & (
  | {
      part: RecordPart.Reminder
      id: string
      number: number
      text: string
      addedAt: number
      cadence: Cadence
    }
  | { part: RecordPart.Text; reminderId: string; text: string; editedAt: number }
  | { part: RecordPart.Cadence; reminderId: string; cadence: Cadence; editedAt: number }
  | { part: RecordPart.Enabled; reminderId: string; isEnabled: boolean; switchedAt: number }
  | { part: RecordPart.Removal; reminderId: string; removedAt: number }
)

type PartRecord = Exclude<StoredRecord, { part: RecordPart.Reminder }>

/** A record of a reminder in the form written to the store, under its key. */
export type ReminderRecord = { key: string; value: StoredRecord }

/** The reminders read from the records of a session, and the keys of the records not read. */
export type ReadRecords = { reminders: Reminder[]; unreadableKeys: string[] }

/**
 * The start of the key of every record of the reminders of the session `sessionId`. A session id
 * contains no `:`, so the start of the keys of one session is never the start of those of another.
 */
export function remindersPrefixOf(sessionId: string): string {
  return recordPrefixOf(RecordKind.Reminder, SESSION_SCOPE, sessionId)
}

/** The id of the session whose reminders have the record under `key`, when it is such a record. */
export function sessionOfReminderKey(key: string): string | undefined {
  return keyPartAfter(recordPrefixOf(RecordKind.Reminder, SESSION_SCOPE), key)
}

/** The record that adds a reminder. Its key is the first of the reminder set in the store. */
export function reminderRecordOf(
  sessionId: string,
  reminder: Pick<Reminder, 'id' | 'number' | 'text' | 'addedAt' | 'cadence'>,
): ReminderRecord {
  const { id, number, text, addedAt, cadence } = reminder

  return recordOf(sessionId, {
    version: RECORD_VERSION,
    part: RecordPart.Reminder,
    id,
    number,
    text,
    addedAt,
    cadence,
  })
}

/** The record of the text given to a reminder by an edit, read in place of its first text. */
export function textRecordOf(
  sessionId: string,
  reminderId: string,
  text: string,
  editedAt: number,
): ReminderRecord {
  return recordOf(sessionId, {
    version: RECORD_VERSION,
    part: RecordPart.Text,
    reminderId,
    text,
    editedAt,
  })
}

/** The record of the cadence given to a reminder by an edit, read in place of its first cadence. */
export function cadenceRecordOf(
  sessionId: string,
  reminderId: string,
  cadence: Cadence,
  editedAt: number,
): ReminderRecord {
  return recordOf(sessionId, {
    version: RECORD_VERSION,
    part: RecordPart.Cadence,
    reminderId,
    cadence,
    editedAt,
  })
}

/** The record of the switch of a reminder. A reminder without this record is off. */
export function enabledRecordOf(
  sessionId: string,
  reminderId: string,
  isEnabled: boolean,
  switchedAt: number,
): ReminderRecord {
  return recordOf(sessionId, {
    version: RECORD_VERSION,
    part: RecordPart.Enabled,
    reminderId,
    isEnabled,
    switchedAt,
  })
}

export function removalRecordOf(
  sessionId: string,
  reminderId: string,
  removedAt: number,
): ReminderRecord {
  return recordOf(sessionId, {
    version: RECORD_VERSION,
    part: RecordPart.Removal,
    reminderId,
    removedAt,
  })
}

/**
 * Reads the records of the reminders of the session `sessionId` into the reminders. A record of
 * another shape or a higher
 * version, a record under a key other than the key built from it, and the record of a part whose
 * reminder is missing are left out, and their keys returned.
 */
export function readReminders(sessionId: string, entries: readonly StoredEntry[]): ReadRecords {
  const unreadableKeys: string[] = []
  const reminders = new Map<string, Reminder>()
  const parts: { key: string; record: PartRecord }[] = []
  for (const { key, value } of entries) {
    const record = parseRecord(value)
    if (record === undefined || keyOf(sessionId, record) !== key) {
      unreadableKeys.push(key)
    } else if (record.part === RecordPart.Reminder) {
      const { id, text, addedAt, cadence } = record
      reminders.set(id, {
        id,
        number: freeNumberOf(record.number, reminders.values()),
        text,
        addedAt,
        cadence,
        isEnabled: false,
      })
    } else {
      parts.push({ key, record })
    }
  }
  for (const { key, record } of parts) {
    const reminder = reminders.get(record.reminderId)
    if (reminder === undefined) {
      unreadableKeys.push(key)
    } else {
      reminders.set(reminder.id, withPart(reminder, record))
    }
  }

  return { reminders: [...reminders.values()], unreadableKeys }
}

/**
 * `number`, or the number after the highest of `earlier` when one of them has `number` already. Two
 * processes that add a reminder at the same moment store the same number, and the reminder stored
 * second then reads as the next one.
 */
function freeNumberOf(number: number, earlier: Iterable<Reminder>): number {
  const numbers = [...earlier].map(reminder => reminder.number)

  return numbers.includes(number) ? Math.max(...numbers) + 1 : number
}

/** `reminder` with the part stored in `record`. */
function withPart(reminder: Reminder, record: PartRecord): Reminder {
  switch (record.part) {
    case RecordPart.Text:
      return { ...reminder, text: record.text }
    case RecordPart.Cadence:
      return { ...reminder, cadence: record.cadence }
    case RecordPart.Enabled:
      return { ...reminder, isEnabled: record.isEnabled }
    case RecordPart.Removal:
      return { ...reminder, removedAt: record.removedAt }
  }
}

function recordOf(sessionId: string, value: StoredRecord): ReminderRecord {
  return { key: keyOf(sessionId, value), value }
}

function keyOf(sessionId: string, record: StoredRecord): string {
  const prefix = remindersPrefixOf(sessionId)

  return record.part === RecordPart.Reminder
    ? `${prefix}${record.id}`
    : `${prefix}${record.reminderId}:${record.part}`
}

function parseRecord(value: unknown): StoredRecord | undefined {
  if (!isRecord(value) || value.version !== RECORD_VERSION) {
    return undefined
  }
  const part = Object.values(RecordPart).find(each => each === value.part)

  return part === undefined ? undefined : PARSERS[part](value)
}

const PARSERS: Record<RecordPart, (value: Record<string, unknown>) => StoredRecord | undefined> = {
  [RecordPart.Reminder]: ({ id, number, text, addedAt, cadence }) => {
    const read = parseCadence(cadence)

    return typeof id === 'string' &&
      isPositiveInteger(number) &&
      typeof text === 'string' &&
      typeof addedAt === 'number' &&
      read !== undefined
      ? {
          version: RECORD_VERSION,
          part: RecordPart.Reminder,
          id,
          number,
          text,
          addedAt,
          cadence: read,
        }
      : undefined
  },
  [RecordPart.Text]: ({ reminderId, text, editedAt }) =>
    typeof reminderId === 'string' && typeof text === 'string' && typeof editedAt === 'number'
      ? { version: RECORD_VERSION, part: RecordPart.Text, reminderId, text, editedAt }
      : undefined,
  [RecordPart.Cadence]: ({ reminderId, cadence, editedAt }) => {
    const read = parseCadence(cadence)

    return typeof reminderId === 'string' && read !== undefined && typeof editedAt === 'number'
      ? { version: RECORD_VERSION, part: RecordPart.Cadence, reminderId, cadence: read, editedAt }
      : undefined
  },
  [RecordPart.Enabled]: ({ reminderId, isEnabled, switchedAt }) =>
    typeof reminderId === 'string' &&
    typeof isEnabled === 'boolean' &&
    typeof switchedAt === 'number'
      ? { version: RECORD_VERSION, part: RecordPart.Enabled, reminderId, isEnabled, switchedAt }
      : undefined,
  [RecordPart.Removal]: ({ reminderId, removedAt }) =>
    typeof reminderId === 'string' && typeof removedAt === 'number'
      ? { version: RECORD_VERSION, part: RecordPart.Removal, reminderId, removedAt }
      : undefined,
}

/**
 * Reads a cadence, stored or posted by the Reminders pane: the id of the kind, and a text or a list
 * of texts for each value.
 */
export function parseCadence(value: unknown): Cadence | undefined {
  if (!isRecord(value) || typeof value.kind !== 'string' || !isRecord(value.values)) {
    return undefined
  }
  const values = Object.entries(value.values).flatMap(([key, each]) => {
    const read = parseCadenceValue(each)

    return read === undefined ? [] : [[key, read] as const]
  })

  return values.length === Object.keys(value.values).length
    ? { kind: value.kind, values: Object.fromEntries(values) }
    : undefined
}

function parseCadenceValue(value: unknown): CadenceValue | undefined {
  return typeof value === 'string' ? value : readStrings(value)
}
