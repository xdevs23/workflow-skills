import { atom, read, update } from 'claude-code'
import type { EngineInterface, ModelApiError } from 'claude-code'

import { withEntry } from '../recordEntries'
import { ofSession, updateOfSession } from '../sessionBoundState'

/**
 * The number of forks in a row that failed with an API error that may clear on its own, the
 * `error` from the last of them, and the time in milliseconds since the epoch from which the next
 * fork may start.
 */
export type ForkRetry = { failedTries: number; error: ModelApiError; nextTryAt: number }

/** The fork owed by `retry`, with the `waitMs` left before it may start. */
export type OwedRetry = { retry: ForkRetry; waitMs: number }

// The engine lists the state a module reads and writes from the source of the module, so this file
// writes the state reference for the retries with its plugin and key as literals.
const verifierRetries = atom({ plugin: 'workflow-skills', key: 'verifierRetries' } as const, null)

/**
 * The retry owed by roast_work to each final-verification agent of the session `sessionId`, by the
 * id of the agent.
 */
export type VerifierRetries = { sessionId: string; retries: Readonly<Record<string, ForkRetry>> }

/**
 * The retry owed by roast_work to the final-verification agent `agentId` of the session
 * `sessionId`, or null without one.
 */
export async function readVerifierRetry(
  $: EngineInterface,
  sessionId: string,
  agentId: string,
): Promise<ForkRetry | null> {
  return ofSession(await read($, verifierRetries), sessionId)?.retries[agentId] ?? null
}

/**
 * Sets the retry owed by roast_work to the final-verification agent `agentId` of the session
 * `sessionId` to `retry`, or removes it without `retry`.
 */
export async function setVerifierRetry(
  $: EngineInterface,
  sessionId: string,
  agentId: string,
  retry: ForkRetry | undefined,
): Promise<void> {
  await updateOfSession<VerifierRetries>(
    $,
    sessionId,
    own => ({ sessionId, retries: withEntry(own?.retries, agentId, retry) }),
    changeInState => update($, verifierRetries, changeInState),
  )
}

/**
 * Removes the retry owed by roast_work to the final-verification agent `agentId` of the session
 * `sessionId`, and leaves the state unwritten where that agent has none.
 */
export async function forgetVerifierRetry(
  $: EngineInterface,
  sessionId: string,
  agentId: string,
): Promise<void> {
  if ((await readVerifierRetry($, sessionId, agentId)) !== null) {
    await setVerifierRetry($, sessionId, agentId, undefined)
  }
}
