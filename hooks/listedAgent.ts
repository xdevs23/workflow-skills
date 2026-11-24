import type { AgentInfo, EngineInterface } from 'claude-code'

/** The agent `agentId` as `$.agent.list()` lists it, or undefined where the list lacks it. */
export async function findListedAgent(
  $: EngineInterface,
  agentId: string,
): Promise<AgentInfo | undefined> {
  return (await $.agent.list()).find(listed => listed.id === agentId)
}
