import { QUESTION_MARKS } from './lineMarks'
import { NO_LETTER_AFTER, NO_LETTER_BEFORE } from './quotedText'
import { DECIDED_WORK_REMEDY } from './refusal'
import type { Refusal } from './refusal'
import { runWithoutWorkNeedingApproval } from './workNeedingApproval'

const CALL_LEFT_TO_USER = String.raw`your\s+(?:call|decision)|up\s+to\s+you`

/**
 * A closing sentence that hands the user the call, such as "so this is your call". A call about a
 * push or a deletion passes.
 */
export const HANDED_CALL: Refusal = {
  pattern: new RegExp(
    String.raw`${NO_LETTER_BEFORE}(?:this|that|it)(?:['’]s|\s+is)\s+(?:${CALL_LEFT_TO_USER})` +
      NO_LETTER_AFTER +
      runWithoutWorkNeedingApproval(String.raw`.,;:!${QUESTION_MARKS}\n`) +
      String.raw`[.!${QUESTION_MARKS}*_~\s]*$`,
    'iu',
  ),
  reason: 'It ends on a sentence that hands the user the call. ' + DECIDED_WORK_REMEDY,
}
