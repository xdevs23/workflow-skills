import type { HintText, SharedStep } from './hintText'
import { HAND_OVER_UNANSWERED } from './unansweredQuestions'

/** A shape of text refused at the end of a turn and in an asked question, with the reason why. */
export type Refusal = {
  pattern: RegExp
  reason: HintText
}

/** The step shared by refusals whose text leaves to the user work already decided. */
const DO_DECIDED_WORK: SharedStep = {
  text:
    "The rules, the records in the project and the user's recorded words already set the " +
    'answer. Do the work that answer needs now, and say in your message what you chose.',
}

/** The end of the reason of a refusal whose text leaves to the user work already decided. */
export const DECIDED_WORK_REMEDY: HintText = [DO_DECIDED_WORK, HAND_OVER_UNANSWERED]
