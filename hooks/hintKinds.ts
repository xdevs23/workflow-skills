import { BLOCKED_HINT } from './blockedHint'
import type { HintKind } from './hintKind'
import { WAITING_HINT } from './waitingHint'

/** Every kind of hint, in the order in which their texts go into the reason for a block. */
export const HINT_KINDS: readonly HintKind[] = [WAITING_HINT, BLOCKED_HINT]

/** The kinds of hint with a phrase in the message, in the order of `HINT_KINDS`. */
export function kindsWithPhraseIn(message: string): HintKind[] {
  return HINT_KINDS.filter(kind => kind.phrases.some(phrase => phrase.test(message)))
}
