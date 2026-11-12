import { LETTER_OR_DIGIT } from './quotedText'
import type { Refusal } from './refusal'

/** A closing question that leaves the user a choice between options, such as "Which way?", with any
 * emphasis or marks after its question mark. */
export const HANDED_DECISION: Refusal = {
  pattern: new RegExp(
    String.raw`(?<!${LETTER_OR_DIGIT})which\s+(?:way|one|option)\s*[?？][?？!*_~\s]*$`,
    'iu',
  ),
  reason:
    'It ends on a question that leaves the user to pick between options, in place of work. Pick ' +
    "the option decided by the rules, the records in the project and the user's recorded words, " +
    'do that work now, and say in your message what you chose. Ask the user only what ' +
    'workflow-skills:question leaves unanswered.',
}
