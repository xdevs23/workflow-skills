import type { AgentInfo, EngineInterface } from 'claude-code'

import { isRunningStatus } from './agentStatus'
import { messageOf } from './errorMessage'

/**
 * A background agent of the session as the engine lists it: id, agent type, task description and,
 * where given, name. The task description tells the roaster what the agent works on once the
 * Agent call that started it has left the transcript, such as after a compaction.
 */
export type RunningAgent = Readonly<Pick<AgentInfo, 'id' | 'type' | 'description' | 'name'>>

/** The running background agents that the assistant can stop, or why they are unknown. */
export type RunningAgents =
  | { readonly isKnown: true; readonly agents: readonly RunningAgent[] }
  | { readonly isKnown: false; readonly cause: string }

/**
 * The background agents that the main conversation started and that still run, or the error of
 * the engine where it did not list them.
 */
export function listRunningAgents($: EngineInterface): Promise<RunningAgents> {
  return $.agent.list().then(
    (agents): RunningAgents => ({
      isKnown: true,
      agents: agents.filter(isRunningAgentOfAssistant).map(readAsRunningAgent),
    }),
    (error: unknown): RunningAgents => ({ isKnown: false, cause: messageOf(error) }),
  )
}

/**
 * Whether `agent` runs, and the model or the person started it from the main conversation, so the
 * assistant can stop it with TaskStop. An agent spawned by another agent stays out, since the
 * agent that spawned it decides when its result is no longer needed. An agent that a plugin
 * started for its own work, such as the goal checker, stays out as well. A teammate stays out
 * too: a message stops it, and one in a pane of its own keeps its last status after the pane dies.
 */
function isRunningAgentOfAssistant(agent: AgentInfo): boolean {
  return (
    agent.parentId === undefined &&
    agent.spawnedBy === undefined &&
    agent.teammateId === undefined &&
    isRunningStatus(agent.status)
  )
}

function readAsRunningAgent({ id, type, description, name }: AgentInfo): RunningAgent {
  return { id, type, description, ...(name === undefined ? {} : { name }) }
}
