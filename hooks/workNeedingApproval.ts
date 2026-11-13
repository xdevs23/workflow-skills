import { NO_LETTER_AFTER, NO_LETTER_BEFORE } from './quotedText'

/**
 * The words for work that waits for the user's yes, such as a push or a deletion, in their verb
 * and noun forms. A longer word that starts the same, such as "dropdown" or "merger", names no such
 * work.
 */
const WORK_NEEDING_APPROVAL = [
  'push(?:es|ed|ing)?',
  'delet(?:e|es|ed|ing|ion)',
  'remov(?:e|es|ed|ing|al)',
  'drop(?:s|ped|ping)?',
  'reset(?:s|ting)?',
  'merg(?:e|es|ed|ing)',
  'publish(?:es|ed|ing)?',
  'deploy(?:s|ed|ing|ment)?',
  'releas(?:e|es|ed|ing)',
].join('|')

/**
 * The source of a run of characters outside the character class body `excluded`, in which no word
 * for work that waits for the user's yes stands.
 */
export function runWithoutWorkNeedingApproval(excluded: string): string {
  const word = `${NO_LETTER_BEFORE}(?:${WORK_NEEDING_APPROVAL})${NO_LETTER_AFTER}`

  return String.raw`(?:(?!${word})[^${excluded}])*`
}
