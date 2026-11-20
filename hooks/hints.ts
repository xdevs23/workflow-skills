import type { Hook } from 'claude-code'

import type { HintKind } from './hintKind'
import { kindsWithPhraseIn } from './hintKinds'
import { offerNoteOnKindsUnsentInTurn } from './hintState'
import { writeHintTextsWithEachStepOnce } from './hintText'
import { stopWithNoteAlsoAfterBlock } from './sendToModel'
import type { TextWithLine } from './sendToModel'

/** Ends the hints. The user reads only the message, where an answer to a hint reads as nonsense. */
const HINT_CLOSING = 'Act on this reminder without mentioning the reminder in your message.'

/** The note on the hints of `kinds` with the closing sentence, or undefined without a kind. */
function describeHintNote(kinds: readonly HintKind[]): TextWithLine | undefined {
  if (kinds.length === 0) {
    return undefined
  }
  const text = [...writeHintTextsWithEachStepOnce(kinds.map(kind => kind.text)), HINT_CLOSING].join(
    '\n\n',
  )

  return { text, line: `Hint sent to Claude: ${text}` }
}

/**
 * Sends the main conversation back to work when its turn would end on a message with a phrase of a
 * hint kind outside quoted text, with the note on the kinds not yet sent in the turn, as
 * stopWithNoteAlsoAfterBlock does. Each kind is sent at most once per turn, so the turn ends.
 */
export const blockStopOnHintPhrase: Hook<'classic.Stop'> = ($, e, next) =>
  stopWithNoteAlsoAfterBlock($, e, next, message =>
    offerNoteOnKindsUnsentInTurn($, kindsWithPhraseIn(message), describeHintNote),
  )
