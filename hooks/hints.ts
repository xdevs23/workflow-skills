import type { Hook } from 'claude-code'

import { isMainConversation } from './conversation'
import { kindsWithPhraseIn } from './hintKinds'

/** Ends the hints. The user reads only the message, where an answer to a hint reads as nonsense. */
const HINT_CLOSING = 'Act on this reminder without mentioning the reminder in your message.'

/**
 * Sends the main conversation back to work once when its turn would end on a message with a phrase
 * of a kind of hint outside quoted text, with the texts of those kinds and a closing sentence as
 * the reason. The engine marks the next end of that turn as one that follows a block, and that end
 * passes, so a turn that still finds nothing to do can end. A block asked by a hook beneath comes
 * first in the reason, and a stop of the session asked by a hook beneath is returned unchanged.
 */
export const blockStopOnHintPhrase: Hook<'classic.Stop'> = async (_$, e, next) => {
  const stopped = await next(e)
  const message = e.last_assistant_message
  const followsBlock = e.stop_hook_active
  if (
    message === undefined ||
    followsBlock ||
    stopped.preventContinuation === true ||
    !isMainConversation({ agentId: e.agent_id })
  ) {
    return stopped
  }
  const texts = kindsWithPhraseIn(message).map(kind => kind.text)
  if (texts.length === 0) {
    return stopped
  }
  const hints = [...texts, HINT_CLOSING]
  const reasons = stopped.block === undefined ? hints : [stopped.block, ...hints]

  return { ...stopped, block: reasons.join('\n\n') }
}
