import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { RuleCheckerNote } from '../types'
import type { Finding } from './reply.ts'

const EMPTY_NOTE: RuleCheckerNote = { findings: [], failures: [], retrying: null }

const note = atom({ plugin: 'workflow-skills', key: 'ruleCheckerNote' } as const, EMPTY_NOTE)

const clip = (text: string, columns: number): string =>
  text.length <= columns ? text : `${text.slice(0, columns - 1)}…`

const counted = (count: number, noun: string): string => `${count} ${noun}${count === 1 ? '' : 's'}`

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

const PREFIX = 'Rule checker · '

// The rows of the note, each cut to `columns`, and none while there is nothing to show: a row
// that counts the findings and a row for each of them, then the retry and the failed checks. The
// band scrolls rows that do not fit.
export function rowsOf({ findings, failures, retrying }: RuleCheckerNote, columns: number): string[] {
  const reported =
    findings.length === 0
      ? []
      : [
          `${PREFIX}${counted(findings.length, 'break')} reported to the agent`,
          ...findings.map(finding => `  ${finding.wrong} (${finding.place})`),
        ]
  const retried = retrying === null ? [] : [`${PREFIX}trying again after ${retrying}`]
  const failed =
    failures.length === 0
      ? []
      : [`${PREFIX}${counted(failures.length, 'check')} failed: ${failures.at(-1)}`]

  return [...reported, ...retried, ...failed].map(row => clip(row, columns))
}

export async function noteRows($: EngineInterface, columns: number): Promise<string[]> {
  return rowsOf(await read($, note), columns)
}
