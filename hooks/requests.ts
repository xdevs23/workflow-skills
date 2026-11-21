import type { Reply, Request } from '../types'

export type DoneRequest = Request & { reply: Reply }

export function isDone(request: Request): request is DoneRequest {
  return request.reply !== undefined
}

export function isWithdrawn(request: Request): boolean {
  return request.withdrawnAt !== undefined
}

/** Whether the request waits for the user to mark it done. */
function isOpen(request: Request): boolean {
  return !isDone(request) && !isWithdrawn(request)
}

export function openRequestsOf(requests: readonly Request[]): Request[] {
  return requests.filter(isOpen)
}

/** The replies the session that sent the requests has not read yet. */
export function undeliveredRepliesOf(requests: readonly Request[]): DoneRequest[] {
  return requests.filter(isDone).filter(request => !request.reply.isDelivered)
}

/** Whether a request is open or has a reply the session that sent it has not read yet. */
export function isAwaitingReplies(requests: readonly Request[]): boolean {
  return openRequestsOf(requests).length > 0 || undeliveredRepliesOf(requests).length > 0
}

/** The number a new request of the session gets: one past the highest number in use. */
export function nextNumberOf(requests: readonly Request[]): number {
  return requests.reduce((highest, request) => Math.max(highest, request.number), 0) + 1
}

/**
 * Whether a request stored before `request` has its number. `requests` lists the requests in the
 * order their store keys were first set. Of two requests with one number, the one stored first
 * keeps it, also when it was stored and its number returned before the other one was stored.
 */
export function isNumberTaken(request: Request, requests: readonly Request[]): boolean {
  const position = requests.findIndex(other => other.id === request.id)
  const storedBefore = position === -1 ? requests : requests.slice(0, position)

  return storedBefore.some(other => other.id !== request.id && other.number === request.number)
}

export function findOpenRequest(
  requests: readonly Request[],
  number: number,
): Request | undefined {
  return openRequestsOf(requests).find(request => request.number === number)
}

/** What became of a request the model asked to withdraw. */
export enum Withdrawal {
  Withdrawn = 'withdrawn',
  NotOpen = 'not-open',
}
