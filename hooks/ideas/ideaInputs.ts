import { NON_BLANK, NUMBER_RULE, numberSchema, readNonBlank } from '../inputs'
import type { ToolArguments } from '../inputs'
import { isPositiveInteger } from '../positiveInteger'
import { ENTRY_NUMBER_PATTERN, ENTRY_NUMBER_RULE, readEntryNumber } from '../todoEntry'
import type { EntryNumber } from '../todoEntry'
import { IdeaLinkKind } from './ideaLink'
import type { EntryLink } from './ideaLink'

// The records for the project contain a recorded word until the user deletes it, and every list of
// ideas for the project reads it, so a long paste makes every list longer. A product choice: a
// limit of 2000 characters covers the passages that shape an entry or a goal.
const WORDS_MAX_LENGTH = 2000

const ENTRY_PROPERTY = {
  type: 'string',
  pattern: ENTRY_NUMBER_PATTERN.source,
  description: `The entry in TODO.md, as ${ENTRY_NUMBER_RULE}.`,
}

const ENTRY_OR_GOAL_PROPERTIES = {
  entry: ENTRY_PROPERTY,
  goal: numberSchema('the open goal, instead of an entry'),
}

export const RECORD_IDEA_SCHEMA = {
  type: 'object',
  properties: {
    ...ENTRY_OR_GOAL_PROPERTIES,
    words: {
      type: 'string',
      pattern: NON_BLANK.source,
      maxLength: WORDS_MAX_LENGTH,
      description: 'The words of the user. Join pieces cut from one message with " … ".',
    },
  },
  required: ['words'],
  additionalProperties: false,
}

export const ENTRY_OR_GOAL_SCHEMA = {
  type: 'object',
  properties: ENTRY_OR_GOAL_PROPERTIES,
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

export const ENTRY_OR_GOAL_PROBLEM =
  `Give either the entry, as ${ENTRY_NUMBER_RULE}, or the number of an open goal, as ` +
  `${NUMBER_RULE}, not both.`

export type EntryOrGoalInput = EntryLink | { kind: IdeaLinkKind.Goal; goal: number }

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
    'not contribute to the design, and join the pieces with " … ".',
}

/** The entry number the model sends to an idea tool, or undefined when it is not valid. */
export function readEntryInput(input: ToolArguments): EntryNumber | undefined {
  return readEntryNumber(input.entry)
}

export function readEntryOrGoalInput(input: ToolArguments): EntryOrGoalInput | undefined {
  const { entry, goal } = input
  if (goal === undefined) {
    const number = readEntryNumber(entry)

    return number === undefined ? undefined : { kind: IdeaLinkKind.Entry, entry: number }
  }

  return entry === undefined && isPositiveInteger(goal)
    ? { kind: IdeaLinkKind.Goal, goal }
    : undefined
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
