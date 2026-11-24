import type { Reply, Request } from '../types'
import { RecordKind, isRecord, readStrings, recordPrefixOf } from './pluginStore'
import { isPositiveInteger } from './positiveInteger'
import { UnreadableRequestError } from './requestStoreFailure'

/**
 * The kinds of record stored for a request. Every record of a request is written by the session
 * that sent it, under a key that includes the id of the session.
 */
export const REQUEST_RECORD_KINDS = [
  RecordKind.Request,
  RecordKind.Reply,
  RecordKind.Withdrawal,
  RecordKind.Delivery,
] as const

export type RequestRecordKind = (typeof REQUEST_RECORD_KINDS)[number]

/**
 * A key of a record of a request, read into its parts. The owner is the id of a session, or the
 * digest of a project root in a key written before the requests belonged to a session. The rest
 * begins with the id of the request.
 */
export type RequestRecordKey = { key: string; kind: RequestRecordKind; owner: string; rest: string }

/**
 * A request as its record stores it. `choices` holds the options of a question stored by an older
 * version of the plugin, which `parseRequest` appends to the text. A new request stores it empty,
 * since older versions read only records that have it.
 */
export type RequestRecord = {
  id: string
  number: number
  text: string
  askedAt: number
  choices: readonly string[]
}

/**
 * A reply as its record stores it. A reply given without text stores an empty text, since older
 * versions of the plugin read only records that have one.
 */
type ReplyRecord = { text: string; answeredAt: number }

export type WithdrawalRecord = { withdrawnAt: number }

export type DeliveryRecord = { deliveredAt: number }

/** A request as sent by the model, without its reply and its withdrawal. */
export type SentRequest = Omit<Request, 'reply' | 'withdrawnAt'>

/** A reply as given by the user, before the session that sent the request reads it. */
export type GivenReply = Omit<Reply, 'isDelivered'>

export function readRequestRecordKey(key: string): RequestRecordKey | undefined {
  const kind = REQUEST_RECORD_KINDS.find(each => key.startsWith(recordPrefixOf(each)))
  if (kind === undefined) {
    return undefined
  }
  const ownerAndRest = key.slice(recordPrefixOf(kind).length)
  const separator = ownerAndRest.indexOf(':')

  return separator === -1
    ? undefined
    : {
        key,
        kind,
        owner: ownerAndRest.slice(0, separator),
        rest: ownerAndRest.slice(separator + 1),
      }
}

/** The id of the request in the rest of a key, which a reply key follows with its own id. */
export function idOf(rest: string): string {
  const separator = rest.indexOf(':')

  return separator === -1 ? rest : rest.slice(0, separator)
}

/**
 * Reads a stored value into a request, and fails on anything of another shape. The choices of a
 * question stored by an older version follow its text, so the user still sees them.
 */
export function parseRequest(key: string, id: string, value: unknown): SentRequest {
  if (!isRequestRecord(value) || value.id !== id) {
    throw new UnreadableRequestError(key)
  }
  const { number, text, choices, askedAt } = value

  return {
    id,
    number,
    text: choices.length === 0 ? text : `${text} (choices: ${choices.join(' / ')})`,
    sentAt: askedAt,
  }
}

/**
 * A request written under the digest of a project: the session that sent it, and the record to
 * write under that session.
 */
export type ProjectRequest = { sessionId: string; record: RequestRecord }

/**
 * Reads a request written under the digest of a project into the session that sent it and the
 * stored value without its `sessionId`, or undefined for a value of another shape.
 */
export function readProjectRequest(id: string, value: unknown): ProjectRequest | undefined {
  if (!isRecord(value)) {
    return undefined
  }
  const { sessionId, ...record } = value

  return typeof sessionId === 'string' && isRequestRecord(record) && record.id === id
    ? { sessionId, record }
    : undefined
}

export function requestRecordOf({ sentAt, ...request }: SentRequest): RequestRecord {
  return { ...request, askedAt: sentAt, choices: [] }
}

export function parseReply(key: string, _id: string, value: unknown): GivenReply {
  if (!isReplyRecord(value)) {
    throw new UnreadableRequestError(key)
  }
  const { text, answeredAt } = value

  return { ...(text === '' ? {} : { text }), repliedAt: answeredAt }
}

export function replyRecordOf({ text = '', repliedAt }: GivenReply): ReplyRecord {
  return { text, answeredAt: repliedAt }
}

/** The time at which a record of each kind was made, undefined for a record of another shape. */
export const RECORD_TIMES: Record<RequestRecordKind, (value: unknown) => number | undefined> = {
  [RecordKind.Request]: value => (isRequestRecord(value) ? value.askedAt : undefined),
  [RecordKind.Reply]: value => (isReplyRecord(value) ? value.answeredAt : undefined),
  [RecordKind.Withdrawal]: value => (isWithdrawalRecord(value) ? value.withdrawnAt : undefined),
  [RecordKind.Delivery]: value => (isDeliveryRecord(value) ? value.deliveredAt : undefined),
}

/** Reads a stored value of `kind` into the time it was made at, and fails on another shape. */
export function parseRecordTime(kind: RequestRecordKind) {
  return (key: string, _id: string, value: unknown): number => {
    const time = RECORD_TIMES[kind](value)
    if (time === undefined) {
      throw new UnreadableRequestError(key)
    }

    return time
  }
}

function isRequestRecord(value: unknown): value is RequestRecord {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    isPositiveInteger(value.number) &&
    typeof value.text === 'string' &&
    typeof value.askedAt === 'number' &&
    readStrings(value.choices) !== undefined
  )
}

function isReplyRecord(value: unknown): value is ReplyRecord {
  return isRecord(value) && typeof value.text === 'string' && typeof value.answeredAt === 'number'
}

function isWithdrawalRecord(value: unknown): value is WithdrawalRecord {
  return isRecord(value) && typeof value.withdrawnAt === 'number'
}

function isDeliveryRecord(value: unknown): value is DeliveryRecord {
  return isRecord(value) && typeof value.deliveredAt === 'number'
}
