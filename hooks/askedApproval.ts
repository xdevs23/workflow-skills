import { RUN_WITHIN_SENTENCE, SENTENCE_START, closingQuestionPattern } from './closingQuestion'
import type { Refusal } from './refusal'

const WORDS_BEFORE_VERB = String.raw`(?:\s+(?:please|just|quickly|kindly|also|now)){0,2}`

const APPROVAL_ASKERS = [
  String.raw`(?:can|could|would|will)\s+you${WORDS_BEFORE_VERB}`,
  String.raw`(?:would\s+you\s+like|do\s+you\s+want)\s+to`,
].join('|')

const APPROVAL_VERBS = [
  'approve',
  'review',
  String.raw`sign[\s-]+off`,
  'okay',
  'ok',
  String.raw`green[\s-]?light`,
].join('|')

const DOES_IT_LOOK_RIGHT =
  String.raw`(?:does|do)\s+(?:\S+\s+){1,3}?look\s+(?:right|good|okay|ok|fine|correct)`

const APPROVAL_QUESTION_OPENINGS = [
  String.raw`(?:${APPROVAL_ASKERS})\s+(?:${APPROVAL_VERBS})`,
  String.raw`do\s+you\s+approve`,
  DOES_IT_LOOK_RIGHT,
].join('|')

/**
 * A closing question that asks the user to approve or review work, such as "Can you approve or
 * correct the draft at .cache/specs/plan.html?" or "Does the layout look right?", whatever the
 * work.
 */
export const ASKED_APPROVAL: Refusal = {
  pattern: closingQuestionPattern(
    `${SENTENCE_START}(?:${APPROVAL_QUESTION_OPENINGS})`,
    RUN_WITHIN_SENTENCE,
  ),
  reason:
    'It ends on a question that asks the user to approve or review work. Open the draft page or ' +
    'name the work in the message, and leave it waiting for the user, who looks at it when there ' +
    'is time and says what should be different. Go on with work that does not depend on it.',
}
