/** A goal named by G and its number, such as G18. */
const GOAL_REFERENCE = /^G(?<number>[1-9]\d*)$/u

/** How a goal is named after a command, for argument hints. */
export const GOAL_REFERENCE_PLACEHOLDER = 'G<goal>'

/** The number of the goal that `text` names as G and its number, or undefined for other text. */
export function readGoalReference(text: string): number | undefined {
  const number = GOAL_REFERENCE.exec(text)?.groups?.number

  return number === undefined ? undefined : Number(number)
}
