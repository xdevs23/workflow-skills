import { QUESTION_MARKS, QUESTION_MARK_AT_END } from './lineMarks'
import { NO_LETTER_AFTER, NO_LETTER_BEFORE } from './quotedText'
import { DECIDED_WORK_REMEDY } from './refusal'
import type { Refusal } from './refusal'
import { runWithoutWorkNeedingApproval } from './workNeedingApproval'

const PERMISSION_ASKERS = [
  String.raw`(?:should|shall)\s+I`,
  String.raw`(?:do\s+you\s+)?want\s+me\s+to`,
  String.raw`would\s+you\s+like\s+me\s+to`,
].join('|')

/** Verbs of work that the rules already order. */
const ORDERED_WORK_VERBS = [
  'start',
  'begin',
  'build',
  'fix',
  'implement',
  'rewrite',
  'write',
  'make',
  'continue',
  'proceed',
  String.raw`go\s+ahead`,
  String.raw`do\s+(?:it|that|this)`,
].join('|')

/**
 * A closing question that asks the user for permission to start work the rules already order, such
 * as "Should I start that rewrite?". A question about a push or a deletion passes.
 */
export const ASKED_PERMISSION: Refusal = {
  pattern: new RegExp(
    String.raw`${NO_LETTER_BEFORE}(?:${PERMISSION_ASKERS})\s+(?:${ORDERED_WORK_VERBS})` +
      NO_LETTER_AFTER +
      runWithoutWorkNeedingApproval(String.raw`${QUESTION_MARKS}\n`) +
      QUESTION_MARK_AT_END,
    'iu',
  ),
  reason:
    'It ends on a question that asks the user for permission to do work. ' + DECIDED_WORK_REMEDY,
}
