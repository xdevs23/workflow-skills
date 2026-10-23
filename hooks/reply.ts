import type { EngineInterface, ModelApiError, ModelCompleteRequest } from 'claude-code'

import type { RuleCheckerFinding, RuleCheckerFindingFields, RuleCheckerReport } from '../types'
import { isRecord } from './json.ts'

export type Finding = RuleCheckerFinding

const FINDING_FIELDS: RuleCheckerFindingFields = ['rule', 'source', 'place', 'wrong', 'instead']

export const Report = {
  NextWork: 'next-work',
  Forbidden: 'forbidden',
  Todo: 'todo',
} as const satisfies Record<string, RuleCheckerReport>
const REPORTS: readonly RuleCheckerReport[] = Object.values(Report)

type Answer =
  | { kind: 'findings'; findings: Finding[] }
  | { kind: 'failed'; reason: string }
  | { kind: 'aborted' }

// The most one reply of a completion can contain.
const REPLY_TOKEN_CEILING = 64_000

// The API errors that pass by themselves, so the request is sent again.
const TEMPORARY_ERRORS: ReadonlySet<ModelApiError> = new Set([
  'rate_limit',
  'overloaded',
  'server_error',
])

// The wait before the first new try; every further try waits twice as long.
const FIRST_RETRY_WAIT_MS = 1_000

const RETRIED = 'The next check sends this work again.'
const CHECK_SETTINGS = 'Check the rule checker model with /rule-checker.'

const failed = (reason: string): Answer => ({ kind: 'failed', reason })

const isFinding = (value: unknown): value is Finding =>
  isRecord(value) &&
  REPORTS.some(report => report === value.report) &&
  FINDING_FIELDS.every(field => typeof value[field] === 'string')

// The first finding of each report in the reply, so a check sends at most one finding per report.
const firstOfEachReport = (findings: readonly Finding[]): Finding[] =>
  findings.filter(
    (finding, index) => findings.findIndex(f => f.report === finding.report) === index,
  )

export const readReply = (text: string): Answer => {
  let reply: unknown
  try {
    reply = JSON.parse(text)
  } catch {
    return failed(`the reply is not JSON. ${RETRIED}`)
  }
  const findings = isRecord(reply) ? reply.findings : undefined
  if (!Array.isArray(findings) || !findings.every(isFinding)) {
    return failed(`the reply does not contain a list of findings. ${RETRIED}`)
  }

  return { kind: 'findings', findings: firstOfEachReport(findings) }
}

type Asking = {
  signal?: AbortSignal
  // Whether the check may wait this long before it tries again.
  canWait: (ms: number) => boolean
  // Called before each wait, with the error that is waited out.
  onRetry: (error: string) => Promise<unknown>
}

// Sends one check and decodes the reply, trying again after an error that passes by itself.
export async function ask(
  $: EngineInterface,
  request: ModelCompleteRequest,
  asking: Asking,
): Promise<Answer> {
  const { signal, canWait, onRetry } = asking
  for (let wait = FIRST_RETRY_WAIT_MS; ; wait *= 2) {
    const reply = await $.model.complete({ ...request, maxTokens: REPLY_TOKEN_CEILING }, { signal })
    if (reply.isAnswered) return readReply(reply.text)
    if (reply.reason === 'aborted') return { kind: 'aborted' }
    if (reply.reason === 'empty-reply') return failed(`the reply was empty. ${RETRIED}`)
    const error = `the API returned ${reply.error} (status ${reply.status ?? 'none'})`
    const isTemporary = reply.status === null || TEMPORARY_ERRORS.has(reply.error)
    if (!isTemporary) return failed(`${error}. ${CHECK_SETTINGS}`)
    if (!canWait(wait)) {
      return failed(`${error}, and the stop ran out of time for another try. ${RETRIED}`)
    }
    await onRetry(error)
    try {
      await $.clock.sleep(wait, { signal })
    } catch (stopped) {
      if (signal?.aborted === true) return { kind: 'aborted' }
      throw stopped
    }
  }
}

// What a check that threw is shown as: only a request the engine refuses to send throws.
export const thrownFailure = (error: unknown): string => `${String(error)}. ${CHECK_SETTINGS}`
