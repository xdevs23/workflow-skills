import type { EngineInterface, MatchedHook, On, PromptComposeSection } from 'claude-code'

import { isMainConversation } from '../conversation'
import { EVERY_EVENT } from '../everyEvent'
import type { EveryEvent } from '../everyEvent'
import { CONVERSATION_STARTS } from '../sessionSources'
import { loadGrantsShowingFailures } from './autonomyActions'
import type { Grant } from './autonomyGrants'
import { AUTONOMY_MODE_SECTION } from './autonomyNames'
import { startConversationState } from './autonomyState'
import { AUTONOMY_MODE } from './autonomyTexts'

export function registerAutonomy(on: On): void {
  on('turn.start', EVERY_EVENT, loadGrantsAtTurnStart)
  on('prompt.compose', EVERY_EVENT, appendAutonomyMode)
  for (const { source, isEmpty } of CONVERSATION_STARTS) {
    on('classic.SessionStart', { source }, async ($, e, next) => {
      await startConversation($, isEmpty ? [] : null)

      return next(e)
    })
  }
}

async function startConversation(
  $: EngineInterface,
  grantsReadByModel: readonly Grant[] | null,
): Promise<void> {
  await startConversationState($, grantsReadByModel)
  await loadGrantsShowingFailures($)
}

const loadGrantsAtTurnStart: MatchedHook<'turn.start', EveryEvent> = async ($, e, next) => {
  if (isMainConversation(e)) {
    await loadGrantsShowingFailures($)
  }

  return next(e)
}

const appendAutonomyMode: MatchedHook<'prompt.compose', EveryEvent> = async (_$, e, next) => {
  const { sections } = await next(e)
  const autonomyMode: PromptComposeSection = {
    id: AUTONOMY_MODE_SECTION,
    text: AUTONOMY_MODE,
    scope: 'session',
  }

  return { sections: [...sections, autonomyMode] }
}
