import { BLOCKED_HINT } from './blockedHint'
import type { HintKind } from './hintKind'
import { WAITING_HINT } from './waitingHint'

/**
 * Every kind of hint by the id the state stores while the hint is due, in the order in which their
 * texts go into a prompt.
 */
export const HINT_KINDS: Readonly<Record<string, HintKind>> = {
  waiting: WAITING_HINT,
  blocked: BLOCKED_HINT,
}

/** The ids of the kinds of hint with a phrase in the message. */
export function kindIdsWithPhraseIn(message: string): string[] {
  return Object.entries(HINT_KINDS)
    .filter(([, kind]) => messageHasPhraseOf(message, kind))
    .map(([id]) => id)
}

/** The texts of the kinds of hint with the ids, each once. */
export function textsOfKinds(ids: readonly string[]): string[] {
  return Object.entries(HINT_KINDS)
    .filter(([id]) => ids.includes(id))
    .map(([, kind]) => kind.text)
}

function messageHasPhraseOf(message: string, kind: HintKind): boolean {
  return kind.phrases.some(phrase => phrase.test(message))
}
