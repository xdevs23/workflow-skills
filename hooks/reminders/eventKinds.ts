import { listKind } from './cadenceKind'
import type { CadenceKind, ListedKind } from './cadenceKind'

// The kinds of the reminders sent after an event of the session, which eventCadence.ts sends.

/** A cadence that an event of the session brings. It has no value fields and no settings. */
type EventKind = CadenceKind<undefined, never>

function eventKindOf(id: string, label: string): EventKind {
  return { id, label, fields: [], read: () => undefined }
}

export const AFTER_BACKGROUND_TASK = eventKindOf('after-background-task', 'after a background task')

export const AFTER_COMPACTION = eventKindOf('after-compaction', 'after a compaction')

/** The event cadences, in the order of the kind dropdown. */
export const EVENT_CADENCES: readonly ListedKind[] = [
  listKind(AFTER_BACKGROUND_TASK),
  listKind(AFTER_COMPACTION),
]
