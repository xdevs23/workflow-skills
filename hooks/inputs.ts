import type { Reply } from '../types'
import { REPLY_COMMAND } from './names'
import { isPositiveInteger } from './positiveInteger'

/** A text with at least one character other than white space. */
export const NON_BLANK = /\S/

/** `value` trimmed when it is a string that is not blank, and undefined otherwise. */
export function readNonBlank(value: unknown): string | undefined {
  return typeof value === 'string' && NON_BLANK.test(value) ? value.trim() : undefined
}

/** The arguments given to a tool by the model, which arrive unchecked. */
export type ToolArguments = { readonly [argument: string]: unknown }

export const SEND_SCHEMA = {
  type: 'object',
  properties: {
    request: {
      type: 'string',
      pattern: NON_BLANK.source,
      description:
        'An instruction complete enough to act on without this conversation, such as ' +
        '"Power-cycle lab-rpi-2. The flash test waits on it."',
    },
  },
  required: ['request'],
  additionalProperties: false,
}

export enum SendOutcome {
  Valid = 'valid',
  RequestBlank = 'request-blank',
}

export type SendInput =
  | { outcome: SendOutcome.Valid; text: string }
  | { outcome: SendOutcome.RequestBlank }

/** What the model is told when its input to the sending tool is blank. */
export const SEND_BLANK_PROBLEM = 'Give the request as a text that is not empty.'

/** Reads the unchecked input of the model to the sending tool into a typed model. */
export function readSendInput(input: ToolArguments): SendInput {
  const text = readNonBlank(input.request)

  return text === undefined
    ? { outcome: SendOutcome.RequestBlank }
    : { outcome: SendOutcome.Valid, text }
}

export const NUMBER_RULE = 'a whole number from 1 up'

/** The schema of the number of `numbered`, such as "your request", as the model gives it. */
export function numberSchema(numbered: string) {
  return {
    type: 'integer',
    minimum: 1,
    description: `The number of ${numbered}, as ${NUMBER_RULE}.`,
  }
}

export const WITHDRAW_SCHEMA = {
  type: 'object',
  properties: { number: numberSchema('your request') },
  required: ['number'],
  additionalProperties: false,
}

export const WITHDRAW_PROBLEM = `Give the number of the request as ${NUMBER_RULE}.`

/** Reads the number in the input of the model to the withdrawing tool, undefined without one. */
export function readWithdrawInput(input: ToolArguments): number | undefined {
  const { number } = input

  return isPositiveInteger(number) ? number : undefined
}

/** The number argument of a command, as its usage shows it. */
const NUMBER_ARGUMENT = '<number>'
const REPLY_ARGUMENT = '[<reply>]'

export const REPLY_ARGUMENTS = `[${NUMBER_ARGUMENT} ${REPLY_ARGUMENT}]`

/** The command that marks the request numbered `number` done, as the user types it. */
export function replyUsage(number: number | typeof NUMBER_ARGUMENT = NUMBER_ARGUMENT): string {
  return `/${REPLY_COMMAND} ${number} ${REPLY_ARGUMENT}`
}

export const REPLY_USAGE_PROBLEM = `Write ${replyUsage()}, such as /${REPLY_COMMAND} 3 rebooted.`

export enum ReplyCommand {
  List = 'list',
  Done = 'done',
  Unreadable = 'unreadable',
}

export type ReplyArguments =
  | { kind: ReplyCommand.List }
  | { kind: ReplyCommand.Done; number: number; reply: Pick<Reply, 'text'> }
  | { kind: ReplyCommand.Unreadable }

/** The reply typed as `text`, trimmed, and no reply for a blank text. */
export function replyOf(text: string | undefined): Pick<Reply, 'text'> {
  const reply = text?.trim() ?? ''

  return reply === '' ? {} : { text: reply }
}

/**
 * Reads the arguments of the reply command: none to list the open requests, or the number of a
 * request marked done, with the reply, if any.
 */
export function readReplyArguments(args: string): ReplyArguments {
  const trimmed = args.trim()
  if (trimmed === '') {
    return { kind: ReplyCommand.List }
  }
  const parts = /^#?(?<number>\d+)(?:\s+(?<text>\S[\s\S]*))?$/.exec(trimmed)?.groups
  if (parts?.number === undefined) {
    return { kind: ReplyCommand.Unreadable }
  }

  return { kind: ReplyCommand.Done, number: Number(parts.number), reply: replyOf(parts.text) }
}
