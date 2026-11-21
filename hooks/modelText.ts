import type { Request } from '../types'
import { DECISION_AS_DRAFT } from './decisionDraft'
import { PendingTextPlace } from './pendingTexts'
import type { HookSubject } from './hookFailure'
import { LIST_TOOL, SEND_TOOL } from './names'
import { NOT_A_REQUEST, REQUEST_DEFINITION } from './notRequest'
import { sortedByNumber } from './numbered'
import { Withdrawal, isDone, isWithdrawn, openRequestsOf } from './requests'
import type { DoneRequest } from './requests'
import { REQUESTS_PANE_TITLE } from './requestTexts'
import type { TextWithLine } from './sendToModel'

/** The text that the reply command returns and the pane shows while no request is open. */
export const ALL_CLOSED = 'Every request of this session is done or withdrawn.'

const REPLY_DELIVERY =
  'The reply from the user is sent to you later as a note with one of your tool results, or as a ' +
  'new message from the user.'

export const SEND_DESCRIPTION = [
  'Sends the user a request, such as to power-cycle a board, without waiting for it, so you keep',
  'working.',
  REQUEST_DEFINITION,
  `The request waits in the ${REQUESTS_PANE_TITLE} pane with this session`,
  'until the user marks it done, at any time, also after a restart that resumes this session.',
  'The call returns at once with the number of the request, counted from 1 in each session.',
  REPLY_DELIVERY,
  NOT_A_REQUEST,
  DECISION_AS_DRAFT.text,
  `Call ${LIST_TOOL} first, and never send a request again that is open or done there.`,
  'Write the request so the user can act on it days later without this conversation: name what',
  'to do and the work that waits on it.',
].join(' ')

export const LIST_DESCRIPTION = [
  `Lists the requests this session sent to the user with ${SEND_TOOL}: the open ones, the done`,
  'ones with their replies, and the withdrawn ones. Requests of other sessions are not listed. A',
  'session forked from another starts without the requests that session sent, and the forked',
  'session does not receive their replies. Check the list before you send, so that each request',
  'is sent once.',
].join(' ')

export const WITHDRAW_DESCRIPTION = [
  `Takes back an open request that you sent with ${SEND_TOOL}, once the work no longer needs it,`,
  'such as after you found another way. Give the number of the request.',
  'The user no longer sees the request among the open requests, and',
  `${LIST_TOOL} lists the request as withdrawn.`,
].join(' ')

export const REPLY_DESCRIPTION = 'Mark a request of Claude done, or list the open ones'

/** The requests, as written in the texts about a failed hook for the requests. */
export const REQUESTS_SUBJECT: HookSubject = {
  name: 'requests',
  checkBeforeRetry: 'List the requests before you try again.',
}

export function describeSent(request: Request): string {
  return (
    `Your request is #${request.number}. Keep working on what does not depend on it. ` +
    REPLY_DELIVERY
  )
}

/** What the model is told of the request numbered `number` it asked to withdraw. */
export const WITHDRAWAL_TEXTS: Record<Withdrawal, (number: number) => string> = {
  [Withdrawal.Withdrawn]: number =>
    `Request #${number} is withdrawn. The user no longer sees the request among the open ` +
    'requests.',
  [Withdrawal.NotOpen]: number =>
    `Request #${number} is not open: it is done, withdrawn or was never sent. Call ` +
    `${LIST_TOOL} to see where the request stands.`,
}

/** The requests marked done as the model reads them, each with its reply, if any. */
export function describeReplies(done: readonly DoneRequest[]): string {
  return done
    .map(request =>
      [
        `The user marked your request #${request.number} done.`,
        `Request: ${request.text}`,
        ...describeReply(request),
      ].join('\n'),
    )
    .join('\n\n')
}

const REPLIES_SENT_LINE_OPENINGS: Record<PendingTextPlace, string> = {
  [PendingTextPlace.ToolResult]: 'Requests marked done, sent to Claude with a tool result:',
  [PendingTextPlace.BesidePrompt]: 'Requests marked done, sent to Claude beside your message:',
}

/**
 * The note that sends the model `done` at `place`, with the line that shows the requests and
 * their replies in the transcript.
 */
export function describeRepliesNote(
  place: PendingTextPlace,
  done: readonly DoneRequest[],
): TextWithLine {
  return {
    text: describeReplies(done),
    line: [REPLIES_SENT_LINE_OPENINGS[place], ...done.map(describeDoneRequest)].join('\n\n'),
  }
}

/** The open, the done and the withdrawn requests as the model reads them from the list tool. */
export function describeRequests(requests: readonly Request[]): string {
  if (requests.length === 0) {
    return 'You have not sent any request in this session.'
  }
  const sorted = sortedByNumber(requests)
  const done = sorted.filter(isDone).map(describeDoneRequest)
  const withdrawn = sorted.filter(isWithdrawn).map(describeRequestLine)

  return [
    ...describeSection('Open requests:', openRequestsOf(sorted).map(describeRequestLine)),
    ...describeSection('Done requests:', done),
    ...describeSection('Withdrawn requests:', withdrawn),
  ].join('\n\n')
}

function describeDoneRequest(request: DoneRequest): string {
  return [describeRequestLine(request), ...describeReply(request)].join('\n')
}

/** The line with the reply from the user, none for a request marked done without one. */
function describeReply(request: DoneRequest): string[] {
  return request.reply.text === undefined ? [] : [`Reply: ${request.reply.text}`]
}

function describeSection(heading: string, lines: readonly string[]): string[] {
  return lines.length === 0 ? [] : [[heading, ...lines].join('\n')]
}

/** The number and the text of the request, as one line. */
export function describeRequestLine(request: Request): string {
  return `#${request.number}: ${request.text}`
}

/** The line written into the chat history when a request is sent. */
export function describeRequestInChat(request: Request): string {
  return `Request #${request.number}: ${request.text}`
}
