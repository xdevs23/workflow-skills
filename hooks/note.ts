import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { RuleCheckerNote } from '../types'
import type { Finding } from './reply.ts'

const EMPTY_NOTE: RuleCheckerNote = { findings: [], failures: [], retrying: null }

const note = atom({ plugin: 'workflow-skills', key: 'ruleCheckerNote' } as const, EMPTY_NOTE)

export function clearNote($: EngineInterface) {
  return update($, note, () => EMPTY_NOTE)
}

export function noteFindings($: EngineInterface, findings: readonly Finding[]) {
  return update($, note, shown => ({ ...shown, findings: [...shown.findings, ...findings] }))
}

export function noteFailure($: EngineInterface, failure: string) {
  return update($, note, shown => ({ ...shown, failures: [...shown.failures, failure] }))
}

export function noteRetry($: EngineInterface, error: string | null) {
  return update($, note, shown => ({ ...shown, retrying: error }))
}

// Whether findings were sent to the agent for the current prompt.
export async function hasFindings($: EngineInterface): Promise<boolean> {
  return (await read($, note)).findings.length > 0
}

export function noteOf($: EngineInterface): Promise<RuleCheckerNote> {
  return read($, note)
}
