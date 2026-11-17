import type { Hook } from 'claude-code'

import type { HintKind } from './hintKind'
import { kindsWithPhraseIn } from './hintKinds'
import { writeHintTextsWithEachStepOnce } from './hintText'
import { stopWithNote } from './sendToModel'
import type { TextWithLine } from './sendToModel'

/** Ends the hints. The user reads only the message, where an answer to a hint reads as nonsense. */
const HINT_CLOSING = 'Act on this reminder without mentioning the reminder in your message.'

/**
 * The note on the hints of `kinds` with the closing sentence, or undefined without a kind. The
 * terminal draws a line of the transcript without its line breaks, so the line joins the paragraphs
 * with spaces.
 */
function describeHintNote(kinds: readonly HintKind[]): TextWithLine | undefined {
  if (kinds.length === 0) {
    return undefined
  }
  const paragraphs = [
    ...writeHintTextsWithEachStepOnce(kinds.map(kind => kind.text)),
    HINT_CLOSING,
  ]

  return { text: paragraphs.join('\n\n'), line: `Hint sent to Claude: ${paragraphs.join(' ')}` }
}

/**
 * Sends the main conversation back to work once when its turn would end on a message with a phrase
 * of a kind of hint outside quoted text, with the note on those kinds, as stopWithNote does.
 */
export const blockStopOnHintPhrase: Hook<'classic.Stop'> = ($, e, next) =>
  stopWithNote($, e, next, message => describeHintNote(kindsWithPhraseIn(message)))
