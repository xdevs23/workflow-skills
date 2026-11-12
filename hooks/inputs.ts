import { ANSWER_COMMAND } from './names'
import { isPositiveInteger } from './positiveInteger'
import type { Refusal } from './refusal'
import { refusalsIn } from './refusals'

/** A text with at least one character other than white space. */
export const NON_BLANK = /\S/
/** The question mark of Latin, of Chinese and Japanese, and of Arabic script. */
const QUESTION_MARK = /[?？؟]/
const MIN_CHOICES = 2

/** The arguments given to a tool by the model, which arrive unchecked. */
export type ToolArguments = { readonly [argument: string]: unknown }

const QUESTION_RULE = 'a text with a question mark'
const CHOICES_RULE = `at least ${MIN_CHOICES} different texts that are not empty`

export const ASK_SCHEMA = {
  type: 'object',
  properties: {
    question: {
      type: 'string',
      pattern: QUESTION_MARK.source,
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
  Refused = 'refused',
  ChoicesInvalid = 'choices-invalid',
}

type FixedAskProblem = AskOutcome.QuestionInvalid | AskOutcome.ChoicesInvalid

export type AskFailure =
  | { outcome: FixedAskProblem }
  | { outcome: AskOutcome.Refused; refusal: Refusal }

export type AskInput =
  | { outcome: AskOutcome.Valid; question: string; choices: readonly string[] }
  | AskFailure

const ASK_PROBLEMS: Record<FixedAskProblem, string> = {
  [AskOutcome.QuestionInvalid]: `Give the question as ${QUESTION_RULE}.`,
  [AskOutcome.ChoicesInvalid]: `Give the choices as ${CHOICES_RULE}, or leave them out.`,
}

/** What the model is told when its input to the asking tool breaks a rule. */
export function askProblemOf(failure: AskFailure): string {
  return failure.outcome === AskOutcome.Refused
    ? `The question is refused. ${failure.refusal.reason}`
    : ASK_PROBLEMS[failure.outcome]
}

/** Reads the input of the model to the asking tool, which arrives unchecked, into a typed model. */
export function readAskInput(input: ToolArguments): AskInput {
  const { question, choices } = input
  if (typeof question !== 'string' || !QUESTION_MARK.test(question)) {
    return { outcome: AskOutcome.QuestionInvalid }
  }
  const [refusal] = refusalsIn(question)
  if (refusal !== undefined) {
    return { outcome: AskOutcome.Refused, refusal }
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

export const NUMBER_RULE = 'a whole number from 1 up'

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
export function readWithdrawInput(input: ToolArguments): number | undefined {
  const { number } = input

  return isPositiveInteger(number) ? number : undefined
}

/** The number argument of a command, as its usage shows it. */
export const NUMBER_ARGUMENT = '<number>'
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
