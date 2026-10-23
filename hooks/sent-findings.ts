import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { Finding } from './reply.ts'

// The findings the last successful check sent to the agent, which the next check gets so it can
// tell an answer to them from the rest of the final message.
const sentFindings = atom(
  { plugin: 'workflow-skills', key: 'ruleCheckerSentFindings' } as const,
  [],
)

export function lastSent($: EngineInterface): Promise<readonly Finding[]> {
  return read($, sentFindings)
}

export function recordSent($: EngineInterface, findings: readonly Finding[]) {
  return update($, sentFindings, () => [...findings])
}

export function clearSent($: EngineInterface) {
  return update($, sentFindings, () => [])
}
