import { closingQuestionPattern } from './closingQuestion'
import { QUESTION_MARKS } from './lineMarks'
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
  pattern: closingQuestionPattern(
    String.raw`(?:${PERMISSION_ASKERS})\s+(?:${ORDERED_WORK_VERBS})`,
    runWithoutWorkNeedingApproval(String.raw`${QUESTION_MARKS}\n`),
  ),
  reason:
    'It ends on a question that asks the user for permission to do work. ' + DECIDED_WORK_REMEDY,
}
