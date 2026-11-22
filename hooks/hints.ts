import type { Hook } from 'claude-code'

import type { HintKind } from './hintKind'
import { kindsWithPhraseIn } from './hintKinds'
import { writeHintNote } from './hintNoteDelivery'
import { claimHintKindsUnsentInTurn } from './hintState'
import { queueHintRoast } from './roast/hintRoastQueue'
import { stopWithNoteAlsoAfterBlock } from './sendToModel'
import type { TextWithLine } from './sendToModel'

/** The note on the texts of `kinds`, as the reason of a Stop block. */
function describeHintNote(kinds: readonly HintKind[]): TextWithLine {
  const text = writeHintNote(kinds.map(kind => kind.text))

  return { text, line: `Hint sent to Claude: ${text}` }
}

/**
 * Sends the main conversation back to work when its turn would end on a message with a phrase of a
 * hint kind outside quoted text, with the note on the kinds not yet sent in the turn, as
 * `stopWithNoteAlsoAfterBlock` does. The roasted kinds do not make the turn wait: `queueHintRoast`
 * has them roasted once the main conversation stayed idle after the turn. Each kind is sent at most
 * once per turn, so the turn ends.
 */
export const blockStopOnHintPhrase: Hook<'classic.Stop'> = ($, e, next) =>
  stopWithNoteAlsoAfterBlock($, e, next, async message => {
    const { roasted, note } = await claimHintKindsUnsentInTurn(
      $,
      kindsWithPhraseIn(message),
      describeHintNote,
    )
    if (roasted.length > 0) {
      await queueHintRoast($, message, roasted)
    }

    return note
  })
