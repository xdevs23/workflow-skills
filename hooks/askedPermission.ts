import { closingQuestionPattern } from './closingQuestion'
import { QUESTION_MARKS } from './lineMarks'
import type { Refusal } from './refusal'
import { HAND_OVER_UNANSWERED } from './unansweredQuestions'
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
  reason: [
    'Your text ends on a question that asks the user for permission to do work. If the user ' +
      'only asked a question, delete the offer and end on the answer. If the user asked for this ' +
      'work or a rule orders the work, do the work now, and say in your message what you chose.',
    HAND_OVER_UNANSWERED,
  ],
}
