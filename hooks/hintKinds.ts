import { ANNOUNCED_WORK_HINT } from './announcedWorkHint'
import { BLOCKED_HINT } from './blockedHint'
import { HELD_QUESTION_HINT } from './heldQuestionHint'
import type { HintKind } from './hintKind'
import { IDLE_REPLY_HINT } from './idleReplyHint'
import { NOTHING_NEEDS_ACTION_HINT } from './nothingNeedsActionHint'
import { withoutQuotedText } from './quotedText'
import type { Refusal } from './refusal'
import { REFUSALS } from './refusals'
import { WAITING_HINT } from './waitingHint'

/** The hint that blocks the end of a turn on a message with the shape of the refusal. */
export function hintOf(refusal: Refusal): HintKind {
  return { phrases: [refusal.pattern], text: `Your message is not valid. ${refusal.reason}` }
}

/**
 * The kinds of hint whose phrase spans a whole message, in the order in which they are tried. A
 * message matched by one says nothing besides, so the first kind that matches gives its only hint,
 * even where a phrase of another kind stands in it.
 */
export const WHOLE_MESSAGE_KINDS: readonly HintKind[] = [IDLE_REPLY_HINT]

/** The kinds of hint whose phrases can stand anywhere in a message, in the order in which their
 * texts go into the reason for a block. */
export const PHRASE_KINDS: readonly HintKind[] = [
  ...REFUSALS.map(hintOf),
  WAITING_HINT,
  HELD_QUESTION_HINT,
  BLOCKED_HINT,
  NOTHING_NEEDS_ACTION_HINT,
  ANNOUNCED_WORK_HINT,
]

/** The kinds of hint with a phrase in the message outside quoted text: the first whole-message
 * kind that matches, or else every phrase kind that matches, in the order of `PHRASE_KINDS`. */
export function kindsWithPhraseIn(message: string): HintKind[] {
  const said = withoutQuotedText(message)
  const hasPhraseInSaid = (kind: HintKind): boolean => kind.phrases.some(phrase => phrase.test(said))
  const wholeMessageKind = WHOLE_MESSAGE_KINDS.find(hasPhraseInSaid)

  return wholeMessageKind === undefined ? PHRASE_KINDS.filter(hasPhraseInSaid) : [wholeMessageKind]
}
