import type { SharedStep } from './hintText'

/** The step shared by hints about questions: how to hand the user what the record leaves open. */
export const HAND_OVER_UNANSWERED: SharedStep = {
  text:
    'Open the draft page of every decision that has one for the user. Draw every other decision ' +
    'that workflow-skills:question leaves unanswered as a draft with the recommended option, and ' +
    'open that draft. Ask the user only a fact that workflow-skills:question leaves unanswered, ' +
    'one question to a message.',
}
