import { isRecord, readEntriesIn } from './pluginStore'
import type { StoreEngine } from './pluginStore'
import {
  describeFailedStoreCall,
  describeUnreadableRecord,
  returningStoreFailure,
} from './storeFailures'
import type { FailedStoreCall } from './storeFailures'

/** What was read of the record of a session. */
export enum RecordOutcome {
  Read = 'read',
  /** The record is of another shape or of a higher version. */
  Unreadable = 'unreadable',
  /** The store failed to read the record. */
  NotRead = 'not read',
}

export type RecordRead<T> =
  | { outcome: RecordOutcome.Read; value: T }
  | { outcome: RecordOutcome.Unreadable; key: string }
  | { outcome: RecordOutcome.NotRead; failed: FailedStoreCall }

/** A read that failed or found an unreadable record, with the reason. */
export type FailedRecordRead = Exclude<RecordRead<never>, { outcome: RecordOutcome.Read }>

/** How a kind of record of a session is written, and what it reads as. */
export type SessionRecordFormat<T> = {
  /** The version written by this code. */
  version: number
  /** The value of a session without a record. */
  whenAbsent: T
  /** The value of the fields of a record of `version`, or undefined for fields of another shape. */
  parse: (fields: Record<string, unknown>) => T | undefined
}

/**
 * The value of the record under `key`, read in `format`. A record of a higher version was written
 * by a newer plugin with fields this code can misread, so it reads as unreadable.
 */
export function readSessionRecord<T>(
  $: StoreEngine,
  key: string,
  format: SessionRecordFormat<T>,
): Promise<RecordRead<T>> {
  return returningStoreFailure(
    async (): Promise<RecordRead<T>> => {
      const [stored] = await readEntriesIn($, key, [key])
      if (stored === undefined) {
        return { outcome: RecordOutcome.Read, value: format.whenAbsent }
      }
      const value =
        isRecord(stored.value) && stored.value.version === format.version
          ? format.parse(stored.value)
          : undefined

      return value === undefined
        ? { outcome: RecordOutcome.Unreadable, key }
        : { outcome: RecordOutcome.Read, value }
    },
    (failed): RecordRead<T> => ({ outcome: RecordOutcome.NotRead, failed }),
  )
}

/** Why the record could not be read, for the person. */
export function describeFailedRecordRead(read: FailedRecordRead): string {
  return read.outcome === RecordOutcome.Unreadable
    ? describeUnreadableRecord(read.key)
    : describeFailedStoreCall(read.failed)
}
