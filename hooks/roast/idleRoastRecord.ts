import { RecordKind, recordKeyOf } from '../recordKeys'
import type { SessionRecordFormat } from '../sessionRecord'

const RECORD_VERSION = 1

// The record exists while the idle roast is on for the session whose id is in the key. A session
// started by /clear or a fork has a new id and starts with the idle roast off. Only /idle-roast off
// deletes the record: session.end also fires when the process exits, gets a signal or resumes
// another session, and a session resumed later reads its switch from this record.
export function idleRoastKeyOf(sessionId: string): string {
  return recordKeyOf(RecordKind.IdleRoast, sessionId)
}

export const IDLE_ROAST_ON_VALUE = { version: RECORD_VERSION }

export const IDLE_ROAST_FORMAT: SessionRecordFormat<boolean> = {
  version: RECORD_VERSION,
  whenAbsent: false,
  parse: () => true,
}
