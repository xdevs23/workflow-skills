import { HintKindName, HintRoastKept } from './hintKind'
import { QUESTION_MARKS } from './lineMarks'
import { NO_LETTER_AFTER, NO_LETTER_BEFORE } from './quotedText'
import { DECIDED_WORK_REMEDY } from './refusal'
import type { Refusal } from './refusal'
import { runWithoutWorkNeedingApproval } from './workNeedingApproval'

const CALL_LEFT_TO_USER = String.raw`your\s+(?:call|decision)|up\s+to\s+you`

/**
 * A closing sentence that leaves the decision to the user, such as "so this is your call". A call
 * about a push or a deletion passes.
 */
export const HANDED_CALL: Refusal<HintKindName.HandedCall> = {
  name: HintKindName.HandedCall,
  pattern: new RegExp(
    String.raw`${NO_LETTER_BEFORE}(?:this|that|it)(?:['’]s|\s+is)\s+(?:${CALL_LEFT_TO_USER})` +
      NO_LETTER_AFTER +
      runWithoutWorkNeedingApproval(String.raw`.,;:!${QUESTION_MARKS}\n`) +
      String.raw`[.!${QUESTION_MARKS}*_~\s]*$`,
    'iu',
  ),
  reason: [
    'Your text ends on a sentence that leaves the decision to the user.',
    ...DECIDED_WORK_REMEDY,
  ],
  roaster: {
    task:
      'The reply ends on a sentence that leaves a decision to the user. Name the decision, and ' +
      'what the rules, the records of the project and the recorded words of the user already set ' +
      'for it.',
    kept: HintRoastKept.UntilUserMessage,
  },
}
