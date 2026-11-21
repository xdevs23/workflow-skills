import type { SharedStep } from './hintText'
import { VISUAL_DECISIONS_SKILL } from './names'

/** The step shared by hints and refusals on what to do with a decision left to the user. */
export const DECISION_AS_DRAFT: SharedStep = {
  text:
    'Draw every decision that the rules and the records leave open as a draft with the ' +
    `recommended option, as ${VISUAL_DECISIONS_SKILL} describes, and open that draft for the ` +
    'user. In a discussion with the user, keep talking in your message, and draw the draft once ' +
    'you agree.',
}
