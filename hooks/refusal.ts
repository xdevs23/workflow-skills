/** A shape of text refused at the end of a turn and in an asked question, with the reason why. */
export type Refusal = {
  pattern: RegExp
  reason: string
}

/** The end of the reason of a refusal whose text leaves to the user work already decided. */
export const DECIDED_WORK_REMEDY =
  "The rules, the records in the project and the user's recorded words decide it. Do the work " +
  'they decide now, and say in your message what you chose. Ask the user only what ' +
  'workflow-skills:question leaves unanswered.'
