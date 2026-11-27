import { HintKindName, HintRoastKept } from './hintKind'
import { QUESTION_MARK_AT_END } from './lineMarks'
import { NO_LETTER_BEFORE } from './quotedText'
import { DECIDED_WORK_REMEDY } from './refusal'
import type { Refusal } from './refusal'

/** A closing question that leaves the user a choice between options, such as "Which way?", with any
 * emphasis or marks after its question mark. */
export const HANDED_DECISION: Refusal<HintKindName.HandedDecision> = {
  name: HintKindName.HandedDecision,
  pattern: new RegExp(
    String.raw`${NO_LETTER_BEFORE}which\s+(?:way|one|option)\s*${QUESTION_MARK_AT_END}`,
    'iu',
  ),
  reason: [
    'Your text ends on a question that leaves the user to pick between options, in place of work.',
    ...DECIDED_WORK_REMEDY,
  ],
  roaster: {
    task:
      'The reply ends on a question that leaves the user to pick between options. Name the ' +
      'options, and what the rules, the records of the project and the recorded words of the ' +
      'user already set for the pick.',
    kept: HintRoastKept.UntilUserMessage,
  },
}
