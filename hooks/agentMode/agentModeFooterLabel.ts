import { drawLabelAfterModes } from '../promptFooter'
import type { DrawFooterLabel, FooterLabel } from '../promptFooter'
import { AgentMode } from './agentModeNames'
import { readAgentModeInState } from './agentModeState'

export const AGENT_MODE_LABEL: FooterLabel<AgentMode> = {
  colors: {
    [AgentMode.Swarm]: 'autoAccept',
    [AgentMode.Orchestrator]: 'ide',
    [AgentMode.Single]: 'success',
  },
}

/** Draws the agent mode of the running session. Reading it while drawing redraws it on a change. */
export const drawAgentModeLabel: DrawFooterLabel = async ($, e, next) =>
  drawLabelAfterModes($, e, next, AGENT_MODE_LABEL, await readAgentModeInState($))
