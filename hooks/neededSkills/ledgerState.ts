import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { SessionLoadLedgers } from '../../types'
import { ofSession, updateOfSession } from '../sessionBoundState'
import { NEW_LOOP } from './loadLedger'
import type { LoopLedger } from './loadLedger'

// The engine lists the state read and written by a module from the source of the module, so the
// state reference of the ledgers is written in this file with the plugin and the key as literals.
const loadLedgers = atom({ plugin: 'workflow-skills', key: 'loadLedgers' } as const, null, {
  shape: 'loads-pending-until-measured',
})

/**
 * Replaces the ledger for the agent `agentId`, or for the main conversation, in the session
 * `sessionId` with what `change` makes of it, unless another session runs by now. A loop without a
 * ledger starts from an empty one.
 */
export async function changeLoop(
  $: EngineInterface,
  sessionId: string,
  agentId: string | undefined,
  change: (loop: LoopLedger) => LoopLedger,
): Promise<void> {
  await updateLoadLedgers($, sessionId, own => {
    const ledgers = own ?? { sessionId, main: NEW_LOOP, agents: {} }

    return withLoop(ledgers, agentId, change(loopOf(ledgers, agentId)))
  })
}

/**
 * The ledger for the agent `agentId`, or for the main conversation, in the session `sessionId`. A
 * loop without a ledger in the state has made no load.
 */
export async function readLoop(
  $: EngineInterface,
  sessionId: string,
  agentId: string | undefined,
): Promise<LoopLedger> {
  const ledgers = ofSession(await read($, loadLedgers), sessionId)

  return ledgers === null ? NEW_LOOP : loopOf(ledgers, agentId)
}

/** Removes the ledger for the agent `agentId` in the session `sessionId`, once the agent ended. */
export async function forgetAgent(
  $: EngineInterface,
  sessionId: string,
  agentId: string,
): Promise<void> {
  await updateLoadLedgers($, sessionId, own =>
    own === null
      ? null
      : {
          ...own,
          agents: Object.fromEntries(Object.entries(own.agents).filter(([id]) => id !== agentId)),
        },
  )
}

function updateLoadLedgers(
  $: EngineInterface,
  sessionId: string,
  change: (own: SessionLoadLedgers | null) => SessionLoadLedgers | null,
): Promise<SessionLoadLedgers | null> {
  return updateOfSession($, sessionId, change, changeInState =>
    update($, loadLedgers, changeInState),
  )
}

function loopOf(ledgers: SessionLoadLedgers, agentId: string | undefined): LoopLedger {
  return agentId === undefined ? ledgers.main : (ledgers.agents[agentId] ?? NEW_LOOP)
}

function withLoop(
  ledgers: SessionLoadLedgers,
  agentId: string | undefined,
  loop: LoopLedger,
): SessionLoadLedgers {
  return agentId === undefined
    ? { ...ledgers, main: loop }
    : { ...ledgers, agents: { ...ledgers.agents, [agentId]: loop } }
}
