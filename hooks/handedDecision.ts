import { QUESTION_MARK_AT_END } from './lineMarks'
import { NO_LETTER_BEFORE } from './quotedText'
import { DECIDED_WORK_REMEDY } from './refusal'
import type { Refusal } from './refusal'

/** A closing question that leaves the user a choice between options, such as "Which way?", with any
 * emphasis or marks after its question mark. */
export const HANDED_DECISION: Refusal = {
  pattern: new RegExp(
    String.raw`${NO_LETTER_BEFORE}which\s+(?:way|one|option)\s*${QUESTION_MARK_AT_END}`,
    'iu',
  ),
  reason:
    'It ends on a question that leaves the user to pick between options, in place of work. ' +
    DECIDED_WORK_REMEDY,
}
