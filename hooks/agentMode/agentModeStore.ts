import { writeRecord } from '../pluginStore'
import type { StoreEngine } from '../pluginStore'
import { RecordKind, recordKeyOf } from '../recordKeys'
import { readSessionRecord } from '../sessionRecord'
import type { RecordRead, SessionRecordFormat } from '../sessionRecord'
import { DEFAULT_AGENT_MODE, isAgentMode } from './agentModeNames'
import type { AgentMode } from './agentModeNames'

const RECORD_VERSION = 1

const AGENT_MODE_FORMAT: SessionRecordFormat<AgentMode> = {
  version: RECORD_VERSION,
  whenAbsent: DEFAULT_AGENT_MODE,
  parse: ({ mode }) => (typeof mode === 'string' && isAgentMode(mode) ? mode : undefined),
}

// The record of the session whose id is in the key contains the mode set by /agent-mode, and a
// set overwrites it, also a record of a higher version. A session started by /clear or a fork has
// a new id and starts in the default mode, and a session resumed later reads its mode from this
// record.
function agentModeKeyOf(sessionId: string): string {
  return recordKeyOf(RecordKind.AgentMode, sessionId)
}

/** The agent mode set for the session `sessionId`, the default while the session has no record. */
export function readAgentMode($: StoreEngine, sessionId: string): Promise<RecordRead<AgentMode>> {
  return readSessionRecord($, agentModeKeyOf(sessionId), AGENT_MODE_FORMAT)
}

export function saveAgentMode($: StoreEngine, sessionId: string, mode: AgentMode): Promise<void> {
  const value = { version: RECORD_VERSION, mode }

  return writeRecord($, { key: agentModeKeyOf(sessionId), value })
}
