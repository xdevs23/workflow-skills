import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

import { PLUGIN } from '../names'
import { sendModelRequest, startSession } from '../testSupport'
import type { Session } from '../testSupport'
import type { SessionLoadLedgers } from '../../types'

// The session without a load of the question skill, shared by the tests for the ledger and for
// the denial.

/** The engine beneath the plugin: the session and the ledgers last written into the state. */
export type LedgerSession = {
  session: Session
  written: { ledgers: SessionLoadLedgers | null }
}

export async function startLedgerSession($: Engine, on: On): Promise<LedgerSession> {
  const written: LedgerSession['written'] = { ledgers: null }
  on('state.set', { plugin: PLUGIN, key: 'loadLedgers' }, ($, e, next) => {
    written.ledgers = e.value

    return next(e)
  })

  return { session: await startSession($, on, { loadsQuestionSkill: false }), written }
}

/**
 * Sends a request of the loop of `agentId`, or of the main conversation, at `contextTokens`, or
 * without usage for null.
 */
export async function requestModel(
  $: Engine,
  { session }: LedgerSession,
  contextTokens: number | null,
  agentId?: string,
) {
  session.contextTokens = contextTokens
  await sendModelRequest($, agentId)
}
