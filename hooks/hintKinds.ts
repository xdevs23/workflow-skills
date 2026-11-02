import { ANNOUNCED_WORK_HINT } from './announcedWorkHint'
import { BLOCKED_HINT } from './blockedHint'
import { HELD_QUESTION_HINT } from './heldQuestionHint'
import type { HintKind } from './hintKind'
import { withoutQuotedText } from './quotedText'
import { WAITING_HINT } from './waitingHint'

/** Every kind of hint, in the order in which their texts go into the reason for a block. */
export const HINT_KINDS: readonly HintKind[] = [
  WAITING_HINT,
  HELD_QUESTION_HINT,
  BLOCKED_HINT,
  ANNOUNCED_WORK_HINT,
]

/** The kinds of hint with a phrase in the message outside quoted text, in the order of
 * `HINT_KINDS`. */
export function kindsWithPhraseIn(message: string): HintKind[] {
  const said = withoutQuotedText(message)

  return HINT_KINDS.filter(kind => kind.phrases.some(phrase => phrase.test(said)))
}
