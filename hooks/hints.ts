import type { Hook } from 'claude-code'

import { kindsWithPhraseIn } from './hintKinds'
import { stopWithNote } from './sendToModel'

/** Ends the hints. The user reads only the message, where an answer to a hint reads as nonsense. */
const HINT_CLOSING = 'Act on this reminder without mentioning the reminder in your message.'

/**
 * Sends the main conversation back to work once when its turn would end on a message with a phrase
 * of a kind of hint outside quoted text, with the texts of those kinds and a closing sentence as
 * the reason, as stopWithNote does.
 */
export const blockStopOnHintPhrase: Hook<'classic.Stop'> = (_$, e, next) =>
  stopWithNote(e, next, message => {
    const texts = kindsWithPhraseIn(message).map(kind => kind.text)

    return texts.length === 0 ? undefined : [...texts, HINT_CLOSING].join('\n\n')
  })
