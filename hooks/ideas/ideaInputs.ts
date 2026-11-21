import { NON_BLANK, readNonBlank } from '../inputs'
import type { ToolArguments } from '../inputs'
import { ENTRY_NUMBER_PATTERN, ENTRY_NUMBER_RULE, readEntryNumber } from '../todoEntry'
import type { EntryNumber } from '../todoEntry'

// The store has records for every project in one file capped at 4 MiB. A recorded word is in the
// store until the entry it is for is finished, so a long paste would leave less room for other
// records. A product choice: 2000 characters hold the passages that shape an entry.
const WORDS_MAX_LENGTH = 2000

const ENTRY_PROPERTY = {
  type: 'string',
  pattern: ENTRY_NUMBER_PATTERN.source,
  description: `The entry in TODO.md, as ${ENTRY_NUMBER_RULE}.`,
}

export const RECORD_IDEA_SCHEMA = {
  type: 'object',
  properties: {
    entry: ENTRY_PROPERTY,
    words: {
      type: 'string',
      pattern: NON_BLANK.source,
      maxLength: WORDS_MAX_LENGTH,
      description: 'The words of the user. Join pieces cut from one message with " … ".',
    },
  },
  required: ['entry', 'words'],
  additionalProperties: false,
}

/** The input schema for an idea tool that needs only an entry. */
export const ENTRY_SCHEMA = {
  type: 'object',
  properties: { entry: ENTRY_PROPERTY },
  required: ['entry'],
  additionalProperties: false,
}

export const ENTRY_PROBLEM = `Give the entry as ${ENTRY_NUMBER_RULE}.`

export enum WordsOutcome {
  Valid = 'valid',
  Blank = 'blank',
  TooLong = 'too-long',
}

export type WordsInput =
  | { outcome: WordsOutcome.Valid; text: string }
  | { outcome: WordsOutcome.Blank }
  | { outcome: WordsOutcome.TooLong }

/** What the model is told when the words it sends to the recording tool are refused. */
export const WORDS_PROBLEMS: Record<Exclude<WordsOutcome, WordsOutcome.Valid>, string> = {
  [WordsOutcome.Blank]: 'Give the words of the user as text that is not blank.',
  [WordsOutcome.TooLong]:
    `Give at most ${WORDS_MAX_LENGTH} characters of words of the user. Cut the words that do ` +
    'not contribute to the design for the entry, and join the pieces with " … ".',
}

/** The entry number the model sends to an idea tool, or undefined when it is not valid. */
export function readEntryInput(input: ToolArguments): EntryNumber | undefined {
  return readEntryNumber(input.entry)
}

/** Reads the words the model sends to the recording tool into a typed model. */
export function readWordsInput(input: ToolArguments): WordsInput {
  const text = readNonBlank(input.words)
  if (text === undefined) {
    return { outcome: WordsOutcome.Blank }
  }

  return [...text].length > WORDS_MAX_LENGTH
    ? { outcome: WordsOutcome.TooLong }
    : { outcome: WordsOutcome.Valid, text }
}
