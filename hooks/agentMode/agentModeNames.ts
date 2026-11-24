import { PLUGIN, skillName } from '../names'

export const AGENT_MODE_COMMAND = 'agent-mode'

export const AGENT_MODE_SECTION = `${PLUGIN}:agent-mode`

export const IMPLEMENT_SKILL = skillName('implement')

export const ORCHESTRATE_SKILL = skillName('orchestrate')

/** How the main conversation of a session works, as the user set it with /agent-mode. */
export enum AgentMode {
  Single = 'single',
  Orchestrator = 'orchestrator',
  Swarm = 'swarm',
}

export const DEFAULT_AGENT_MODE = AgentMode.Orchestrator

export const AGENT_MODES: readonly AgentMode[] = Object.values(AgentMode)

export function isAgentMode(words: string): words is AgentMode {
  return Object.values<string>(AgentMode).includes(words)
}
