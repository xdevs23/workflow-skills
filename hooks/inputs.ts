import { ANSWER_COMMAND } from './names'
import { isPositiveInteger } from './questions'

/** A text with at least one character other than white space. */
const NON_BLANK = /\S/
const MIN_CHOICES = 2

const QUESTION_RULE = 'a text that is not empty'
const CHOICES_RULE = `at least ${MIN_CHOICES} different texts that are not empty`

export const ASK_SCHEMA = {
  type: 'object',
  properties: {
    question: {
      type: 'string',
      pattern: NON_BLANK.source,
      description:
        `The question, as ${QUESTION_RULE}, complete enough to answer without this ` +
        'conversation.',
    },
    choices: {
      type: 'array',
      items: { type: 'string', pattern: NON_BLANK.source },
      minItems: MIN_CHOICES,
      uniqueItems: true,
      description:
        `The answers to pick from, as ${CHOICES_RULE}, where the question has a fixed set of ` +
        'them. The user can still answer in other words.',
    },
  },
  required: ['question'],
  additionalProperties: false,
}

export enum AskOutcome {
  Valid = 'valid',
  QuestionInvalid = 'question-invalid',
  ChoicesInvalid = 'choices-invalid',
}

type AskProblem = Exclude<AskOutcome, AskOutcome.Valid>

export type AskInput =
  | { outcome: AskOutcome.Valid; question: string; choices: readonly string[] }
  | { outcome: AskProblem }

/** What the model is told when its input to the asking tool breaks a rule. */
export const ASK_PROBLEMS: Record<AskProblem, string> = {
  [AskOutcome.QuestionInvalid]: `Give the question as ${QUESTION_RULE}.`,
  [AskOutcome.ChoicesInvalid]: `Give the choices as ${CHOICES_RULE}, or leave them out.`,
}

/** Reads the input of the model to the asking tool, which arrives unchecked, into a typed model. */
export function readAskInput(input: { readonly [argument: string]: unknown }): AskInput {
  const { question, choices } = input
  if (typeof question !== 'string' || !NON_BLANK.test(question)) {
    return { outcome: AskOutcome.QuestionInvalid }
  }
  if (choices === undefined) {
    return { outcome: AskOutcome.Valid, question: question.trim(), choices: [] }
  }
  if (!isChoiceList(choices)) {
    return { outcome: AskOutcome.ChoicesInvalid }
  }

  return { outcome: AskOutcome.Valid, question: question.trim(), choices }
}

function isChoiceList(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length >= MIN_CHOICES &&
    value.every(choice => typeof choice === 'string' && NON_BLANK.test(choice)) &&
    new Set(value).size === value.length
  )
}

const NUMBER_RULE = 'a whole number from 1 up'

export const WITHDRAW_SCHEMA = {
  type: 'object',
  properties: {
    number: {
      type: 'integer',
      minimum: 1,
      description: `The number of your question, as ${NUMBER_RULE}.`,
    },
  },
  required: ['number'],
  additionalProperties: false,
}

export const WITHDRAW_PROBLEM = `Give the number of the question as ${NUMBER_RULE}.`

/** Reads the number in the input of the model to the withdrawing tool, undefined without one. */
export function readWithdrawInput(input: {
  readonly [argument: string]: unknown
}): number | undefined {
  const { number } = input

  return isPositiveInteger(number) ? number : undefined
}

const NUMBER_ARGUMENT = '<number>'
const ANSWER_ARGUMENT = '<answer>'

export const ANSWER_ARGUMENTS = `[${NUMBER_ARGUMENT} ${ANSWER_ARGUMENT}]`

/** The command that answers the question numbered `number`, as the user types it. */
export function answerUsage(number: number | typeof NUMBER_ARGUMENT = NUMBER_ARGUMENT): string {
  return `/${ANSWER_COMMAND} ${number} ${ANSWER_ARGUMENT}`
}

export const ANSWER_USAGE_PROBLEM = `Write ${answerUsage()}, such as /${ANSWER_COMMAND} 3 yes.`

export enum AnswerRequest {
  List = 'list',
  Answer = 'answer',
  Unreadable = 'unreadable',
}

export type AnswerArguments =
  | { request: AnswerRequest.List }
  | { request: AnswerRequest.Answer; number: number; text: string }
  | { request: AnswerRequest.Unreadable }

/** Reads the arguments of the answer command: none to list the open questions, or an answer. */
export function readAnswerArguments(args: string): AnswerArguments {
  const trimmed = args.trim()
  if (trimmed === '') {
    return { request: AnswerRequest.List }
  }
  const parts = /^#?(?<number>\d+)\s+(?<text>\S[\s\S]*)$/.exec(trimmed)?.groups
  if (parts?.number === undefined || parts.text === undefined) {
    return { request: AnswerRequest.Unreadable }
  }

  return { request: AnswerRequest.Answer, number: Number(parts.number), text: parts.text }
}
