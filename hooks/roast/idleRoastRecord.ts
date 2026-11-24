import { isRecord } from '../pluginStore'
import { RecordKind, recordKeyOf } from '../recordKeys'

// The version of the record written by this code. A record of a higher version was written by a
// newer plugin with fields this code can misread, so it reads as unreadable and is left as it is.
const RECORD_VERSION = 1

// The record exists while the idle roast is on for the session whose id is in the key. A session
// started by /clear or a fork has a new id and starts with the idle roast off. Only /idle-roast off
// deletes the record: session.end also fires when the process exits, gets a signal or resumes
// another session, and a session resumed later reads its switch from this record.
export function idleRoastKeyOf(sessionId: string): string {
  return recordKeyOf(RecordKind.IdleRoast, sessionId)
}

export const IDLE_ROAST_ON_VALUE = { version: RECORD_VERSION }

/** Whether `value` is a record of the shape and the version written by this code. */
export function isIdleRoastOnValue(value: unknown): boolean {
  return isRecord(value) && value.version === RECORD_VERSION
}
