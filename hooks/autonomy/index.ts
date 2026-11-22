import type { EngineInterface, MatchedHook, On, PromptComposeSection } from 'claude-code'

import { isMainConversation } from '../conversation'
import { EVERY_EVENT } from '../everyEvent'
import type { EveryEvent } from '../everyEvent'
import { CONTINUED_CONVERSATION_SOURCES, EMPTY_CONVERSATION_SOURCES } from '../sessionSources'
import { loadGrantsShowingFailures } from './autonomyActions'
import type { Grant } from './autonomyGrants'
import { submitWithAutonomyNote } from './autonomyNotes'
import { AUTONOMY_MODE_SECTION } from './autonomyNames'
import { startConversationState } from './autonomyState'
import { AUTONOMY_MODE } from './autonomyTexts'

export function registerAutonomy(on: On): void {
  on('turn.start', EVERY_EVENT, loadGrantsAtTurnStart)
  on('prompt.compose', EVERY_EVENT, appendAutonomyMode)
  on('classic.SessionStart', { source: EMPTY_CONVERSATION_SOURCES }, async ($, e, next) => {
    await startConversation($, [])

    return next(e)
  })
  on('classic.SessionStart', { source: CONTINUED_CONVERSATION_SOURCES }, async ($, e, next) => {
    await startConversation($, null)

    return next(e)
  })
  on('prompt.submit', EVERY_EVENT, submitWithAutonomyNote)
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
