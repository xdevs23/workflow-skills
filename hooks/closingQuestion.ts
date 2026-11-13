import { EMPHASIS, LIST_MARK, QUESTION_MARKS, QUESTION_MARK_AT_END } from './lineMarks'
import { NO_LETTER_AFTER, NO_LETTER_BEFORE } from './quotedText'

/** The start of a sentence: the start of the text or of a line, or the end of a sentence before. */
export const SENTENCE_START =
  String.raw`(?<=(?:^|[\n.!:${QUESTION_MARKS}])\s*${LIST_MARK}${EMPHASIS})`

/** A run of characters that stays inside one sentence and stops before its question mark. */
export const RUN_WITHIN_SENTENCE = String.raw`(?:(?![.!](?:\s|$))[^${QUESTION_MARKS}\n])*`

/**
 * The pattern of text that ends on a question opening with the words `opening`, whose characters
 * up to the closing question mark make up the run `run`.
 */
export function closingQuestionPattern(opening: string, run: string): RegExp {
  return new RegExp(
    `${NO_LETTER_BEFORE}(?:${opening})${NO_LETTER_AFTER}${run}${QUESTION_MARK_AT_END}`,
    'iu',
  )
}
