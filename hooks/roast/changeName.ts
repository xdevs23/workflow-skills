import { NON_BLANK } from '../inputs'

/**
 * The most characters in a message to the final-verification agent: a product choice. The message
 * only names the change, so the main conversation cannot argue the verdict through it.
 */
const MAX_CHANGE_CHARACTERS = 80

/** The rule for a message to the final-verification agent, as the texts to the model write it. */
export const CHANGE_NAME_RULE =
  `a name of at most ${MAX_CHANGE_CHARACTERS} characters for the change to verify, such as a ` +
  'TODO number, a branch, a worktree or a commit range'

/** Whether `text` is not blank and fits into MAX_CHANGE_CHARACTERS characters. */
export function isChangeName(text: string): boolean {
  return NON_BLANK.test(text) && text.trim().length <= MAX_CHANGE_CHARACTERS
}
