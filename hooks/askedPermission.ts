import { closingQuestionPattern } from './closingQuestion'
import { DECISION_AS_DRAFT } from './decisionDraft'
import { HintKindName, HintRoastKept } from './hintKind'
import { QUESTION_MARKS } from './lineMarks'
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
export const ASKED_PERMISSION: Refusal<HintKindName.AskedPermission> = {
  name: HintKindName.AskedPermission,
  pattern: closingQuestionPattern(
    String.raw`(?:${PERMISSION_ASKERS})\s+(?:${ORDERED_WORK_VERBS})`,
    runWithoutWorkNeedingApproval(String.raw`${QUESTION_MARKS}\n`),
  ),
  reason: [
    'Your text ends on a question that asks the user for permission to do work. If the user ' +
      'only asked a question, delete the offer and end on the answer. If the user asked for this ' +
      'work or a rule orders the work, do the work now, and say in your message what you chose.',
    DECISION_AS_DRAFT,
  ],
  roaster: {
    task:
      'The reply ends on a question that asks the user for permission to do work. Where the user ' +
      'only asked a question, name the offer to delete. Where a message of the user or a rule ' +
      'orders the work, name the work that the assistant could do in this turn.',
    kept: HintRoastKept.UntilUserMessage,
  },
}
