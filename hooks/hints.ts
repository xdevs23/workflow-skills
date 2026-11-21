import type { EngineInterface, Hook } from 'claude-code'

import { isRoastedHintKind } from './hintKind'
import type { HintKind } from './hintKind'
import { kindsWithPhraseIn } from './hintKinds'
import { offerNoteOnKindsUnsentInTurn } from './hintState'
import { writeHintTextsWithEachStepOnce } from './hintText'
import type { HintText } from './hintText'
import { roastHints } from './roast/hintRoast'
import { describeHintRoastMissing } from './roast/roastTexts'
import { stopWithNoteAlsoAfterBlock } from './sendToModel'
import type { TextWithLine } from './sendToModel'

/** Ends the hints. The user reads only the message, where an answer to a hint reads as nonsense. */
const HINT_CLOSING = 'Act on this reminder without mentioning the reminder in your message.'

/** The note on `texts`, the texts of the hints, with the closing sentence. */
function describeHintNote(texts: readonly HintText[]): TextWithLine {
  const text = [...writeHintTextsWithEachStepOnce(texts), HINT_CLOSING].join('\n\n')

  return { text, line: `Hint sent to Claude: ${text}` }
}

/**
 * The texts of `kinds` in their order, with `roast` in place of the texts of the roasted kinds, at
 * the place of the first of them. The roast contains no shared step, so a later text keeps each of
 * its shared steps.
 */
function placeRoastAmongTexts(kinds: readonly HintKind[], roast: string): HintText[] {
  const roastAt = kinds.findIndex(isRoastedHintKind)

  return kinds.flatMap((kind, index) => {
    if (index === roastAt) {
      return [[roast]]
    }

    return isRoastedHintKind(kind) ? [] : [kind.text]
  })
}

/**
 * The texts of the hints of `kinds` for the end of a turn: the roast on the hints of the roasted
 * kinds as placeRoastAmongTexts places it, where roastHints wrote one, or else the text of each
 * kind. The debug log gets why no roast came.
 */
async function writeHintTexts(
  $: EngineInterface,
  kinds: readonly HintKind[],
): Promise<readonly HintText[]> {
  const roasted = kinds.filter(isRoastedHintKind)
  const texts = kinds.map(kind => kind.text)
  if (roasted.length === 0) {
    return texts
  }
  const roast = await roastHints($, roasted)
  if (!roast.isWritten) {
    $.ui.log(describeHintRoastMissing(roast.missing), { to: 'debug' })

    return texts
  }

  return placeRoastAmongTexts(kinds, roast.roast)
}

/**
 * Sends the main conversation back to work when its turn would end on a message with a phrase of a
 * hint kind outside quoted text, with the note on the kinds not yet sent in the turn, as
 * stopWithNoteAlsoAfterBlock does. Each kind is sent at most once per turn, so the turn ends.
 */
export const blockStopOnHintPhrase: Hook<'classic.Stop'> = ($, e, next) =>
  stopWithNoteAlsoAfterBlock($, e, next, message =>
    offerNoteOnKindsUnsentInTurn($, kindsWithPhraseIn(message), async unsent =>
      unsent.length === 0 ? undefined : describeHintNote(await writeHintTexts($, unsent)),
    ),
  )
