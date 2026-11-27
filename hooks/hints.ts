import type { Hook } from 'claude-code'

import { isMainConversation } from './conversation'
import { kindsWithPhraseIn } from './hintKinds'
import { claimHintKindsUnsentInTurn } from './hintState'
import { queueHintRoast } from './roast/hintRoastQueue'

/**
 * Queues the roast on the hint kinds whose phrases stand outside quoted text in the message on
 * which a turn of the main conversation ends, for the kinds not yet sent in the turn. The end of
 * the turn is not blocked: the roaster writes the note once the main conversation stayed idle
 * after the turn, where it finds a point.
 */
export const queueHintRoastOnHintPhrase: Hook<'classic.Stop'> = async ($, e, next) => {
  const stopped = await next(e)
  const message = e.last_assistant_message
  if (
    message === undefined ||
    stopped.preventContinuation === true ||
    !isMainConversation({ agentId: e.agent_id })
  ) {
    return stopped
  }
  const claimed = await claimHintKindsUnsentInTurn($, kindsWithPhraseIn(message))
  if (claimed.length > 0) {
    await queueHintRoast($, message, claimed)
  }

  return stopped
}
