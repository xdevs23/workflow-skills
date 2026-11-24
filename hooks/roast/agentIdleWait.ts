import type { EngineInterface, Timer } from 'claude-code'

import { runAfter } from '../timedWork'
import { IDLE_WAIT_MILLISECONDS } from './roastNames'

/** The wait of one subagent after one of its turns, until its next turn starts. */
type AgentIdleWait = { readonly timer: Timer }

// The wait of each subagent since its last turn, by agent id. A wait whose timer fired stays here
// until the subagent starts a turn, so the work of the wait can tell that the subagent is still
// idle.
const waitByAgent = new Map<string, AgentIdleWait>()

/**
 * Starts the wait of the subagent `agentId` in place of the one before it, at the end of one of its
 * turns, and runs `work` once the subagent was idle for IDLE_WAIT_SECONDS. `work` gets a function
 * that returns whether the subagent has started no turn since. `runAfter` shows a failure of
 * `work`.
 */
export function startAgentIdleWait(
  $: EngineInterface,
  agentId: string,
  work: (isStillIdle: () => boolean) => Promise<void>,
  describeFailure: (message: string) => string,
): void {
  cancelAgentIdleWait(agentId)
  const wait: AgentIdleWait = {
    timer: runAfter(
      $,
      IDLE_WAIT_MILLISECONDS,
      () => work(() => waitByAgent.get(agentId) === wait),
      describeFailure,
    ),
  }
  waitByAgent.set(agentId, wait)
}

/** Ends the wait of the subagent `agentId`, which started a turn. */
export function cancelAgentIdleWait(agentId: string): void {
  waitByAgent.get(agentId)?.timer.cancel()
  waitByAgent.delete(agentId)
}

/** Ends the wait of every subagent, once another session runs. */
export function cancelEveryAgentIdleWait(): void {
  for (const agentId of [...waitByAgent.keys()]) {
    cancelAgentIdleWait(agentId)
  }
}
