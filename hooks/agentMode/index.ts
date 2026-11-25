import type { EngineInterface, MatchedHook, On, PromptComposeSection } from 'claude-code'

import { isMainConversation } from '../conversation'
import { EVERY_EVENT } from '../everyEvent'
import type { EveryEvent } from '../everyEvent'
import { showFailure } from '../failureToast'
import type { PromptFooter } from '../promptFooter'
import { CONVERSATION_STARTS } from '../sessionSources'
import { AGENT_MODE_LABEL, drawAgentModeLabel } from './agentModeFooterLabel'
import { AGENT_MODE_SECTION, DEFAULT_AGENT_MODE } from './agentModeNames'
import type { AgentMode } from './agentModeNames'
import { loadAgentModeIntoState, startConversationState } from './agentModeState'
import { AGENT_MODE, describeAgentModeNotRead } from './agentModeTexts'

const AGENT_MODE_RULE: PromptComposeSection = {
  id: AGENT_MODE_SECTION,
  text: AGENT_MODE,
  scope: 'session',
}

export function registerAgentMode(on: On, footer: PromptFooter): void {
  on('turn.start', EVERY_EVENT, loadAgentModeAtTurnStart)
  on('ui.render', footer.placeLabel(AGENT_MODE_LABEL), drawAgentModeLabel)
  on('prompt.compose', EVERY_EVENT, appendAgentMode)
  // The system prompt contains the default mode for a conversation without a note on the mode.
  for (const { source, isEmpty } of CONVERSATION_STARTS) {
    on('classic.SessionStart', { source }, async ($, e, next) => {
      await startConversation($, isEmpty ? DEFAULT_AGENT_MODE : null)

      return next(e)
    })
  }
}

async function startConversation(
  $: EngineInterface,
  modeReadByModel: AgentMode | null,
): Promise<void> {
  await startConversationState($, modeReadByModel)
  await loadAgentModeShowingFailure($)
}

const loadAgentModeAtTurnStart: MatchedHook<'turn.start', EveryEvent> = async ($, e, next) => {
  if (isMainConversation(e)) {
    await loadAgentModeShowingFailure($)
  }

  return next(e)
}

async function loadAgentModeShowingFailure($: EngineInterface): Promise<void> {
  const failed = await loadAgentModeIntoState($)
  if (failed !== undefined) {
    showFailure($, describeAgentModeNotRead(failed))
  }
}

// A teammate renders the system prompt of the main conversation, and the agent mode belongs to the
// main conversation.
const appendAgentMode: MatchedHook<'prompt.compose', EveryEvent> = async (_$, e, next) => {
  const composed = await next(e)

  return e.traits.includes('teammate')
    ? composed
    : { sections: [...composed.sections, AGENT_MODE_RULE] }
}
