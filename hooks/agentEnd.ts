import type { EngineInterface } from 'claude-code'

import { hasStatusEnded } from './agentStatus'
import { findListedAgent } from './listedAgent'

// The engine raises no end of an agent beyond the end of a turn. A subagent and a workflow agent
// end with their run, which is one turn. A teammate runs many turns under one agent id, so it ended
// only when the list of agents contains the teammate as ended, or no longer contains it.

/** Whether the agent `agentId`, at the end of one of its turns, takes no more turns. */
export async function hasAgentEnded($: EngineInterface, agentId: string): Promise<boolean> {
  const agent = await findListedAgent($, agentId)

  return agent?.teammateId === undefined || hasStatusEnded(agent.status)
}
