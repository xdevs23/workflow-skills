import type { EngineInterface } from 'claude-code'

import type { Request } from '../types'
import {
  RecordKind,
  deleteRecords,
  describeFailedStoreCall,
  readEntriesUnderAny,
  recordKeyOf,
  recordPrefixOf,
  returningStoreFailure,
  writeRecord,
} from './pluginStore'
import type { StoredEntry } from './pluginStore'
import {
  RECORD_TIMES,
  REQUEST_RECORD_KINDS,
  idOf,
  parseRecordTime,
  parseReply,
  parseRequest,
  readRequestRecordKey,
  replyRecordOf,
  requestRecordOf,
} from './requestRecords'
import type { DeliveryRecord, GivenReply, SentRequest, WithdrawalRecord } from './requestRecords'
import {
  Withdrawal,
  findOpenRequest,
  isDone,
  isNumberTaken,
  nextNumberOf,
  openRequestsOf,
} from './requests'
import type { DoneRequest } from './requests'
import { RequestNotReadError, RequestNotSavedError } from './requestStoreFailure'
import { MILLISECONDS_PER_DAY } from './timeUnits'

/**
 * A session deletes its requests at its start once the newest of their records is this old. The
 * age leaves a month for `claude --resume` to bring a session back with its requests.
 */
export const SESSION_REQUESTS_MAX_AGE_MS = 30 * MILLISECONDS_PER_DAY

function storeKeyOf(sessionId: string, id: string): string {
  return recordKeyOf(RecordKind.Request, sessionId, id)
}

/**
 * The key of one reply to the request `id`. Every reply gets a key of its own, and of two
 * replies given at the same moment the one whose key was set first is the reply.
 */
function replyKeyOf(sessionId: string, id: string): string {
  return recordKeyOf(RecordKind.Reply, sessionId, id, crypto.randomUUID())
}

/** Every record of the requests of the session `sessionId`, from one read of its file. */
function readRequestRecords($: EngineInterface, sessionId: string): Promise<StoredEntry[]> {
  const [first, ...more] = REQUEST_RECORD_KINDS
  const prefixOf = (kind: RecordKind): string => recordPrefixOf(kind, sessionId)

  return readFromStore(() => readEntriesUnderAny($, prefixOf(first), more.map(prefixOf)))
}

/** The records of one kind among `entries`, by the id of their request, in the order set. */
function readRecords<T>(
  entries: readonly StoredEntry[],
  record: RecordKind,
  sessionId: string,
  parse: (key: string, id: string, value: unknown) => T,
): Map<string, T> {
  const prefix = recordPrefixOf(record, sessionId)
  const records = new Map<string, T>()
  for (const { key, value } of entries.filter(entry => entry.key.startsWith(prefix))) {
    const id = idOf(key.slice(prefix.length))
    if (!records.has(id)) {
      records.set(id, parse(key, id, value))
    }
  }

  return records
}

/**
 * Reads every request the session `sessionId` sent from the store, in the order their keys were
 * first set. A reply wins over a withdrawal made at the same moment, so the words of the user are
 * never lost.
 */
export async function readSessionRequests(
  $: EngineInterface,
  sessionId: string,
): Promise<Request[]> {
  const stored = await readRequestRecords($, sessionId)
  const requests = readRecords(stored, RecordKind.Request, sessionId, parseRequest)
  const replies = readRecords(stored, RecordKind.Reply, sessionId, parseReply)
  const withdrawals = readRecords(
    stored,
    RecordKind.Withdrawal,
    sessionId,
    parseRecordTime(RecordKind.Withdrawal),
  )
  const deliveries = readRecords(
    stored,
    RecordKind.Delivery,
    sessionId,
    parseRecordTime(RecordKind.Delivery),
  )

  return [...requests.values()].map(request => {
    const reply = replies.get(request.id)
    if (reply !== undefined) {
      return { ...request, reply: { ...reply, isDelivered: deliveries.has(request.id) } }
    }
    const withdrawnAt = withdrawals.get(request.id)

    return withdrawnAt === undefined ? request : { ...request, withdrawnAt }
  })
}

/**
 * Stores a new request of the session `sessionId` under a number that is free in the session, and
 * returns it with the requests of the session. The store does not offer compare-and-set, so the
 * number is checked after the write: of two requests sent at once with one number, the one whose
 * key was set later gets the next free number and is written again.
 */
export async function saveNewRequest(
  $: EngineInterface,
  sessionId: string,
  sent: Pick<Request, 'text' | 'sentAt'>,
): Promise<{ request: Request; requests: Request[] }> {
  let request: SentRequest = {
    id: crypto.randomUUID(),
    ...sent,
    number: nextNumberOf(await readSessionRequests($, sessionId)),
  }
  for (;;) {
    await saveRecord($, storeKeyOf(sessionId, request.id), requestRecordOf(request))
    const requests = await readSessionRequests($, sessionId)
    if (!isNumberTaken(request, requests)) {
      return { request, requests }
    }
    request = { ...request, number: nextNumberOf(requests) }
  }
}

/**
 * Stores the reply to the open request of the session `sessionId` that `which` selects, and
 * returns the done request, as the store has it after the write, with the requests of the
 * session. The done request is undefined unless an open request is selected.
 */
export async function saveReply(
  $: EngineInterface,
  sessionId: string,
  which: (request: Request) => boolean,
  reply: GivenReply,
): Promise<{ done: DoneRequest | undefined; requests: Request[] }> {
  const request = openRequestsOf(await readSessionRequests($, sessionId)).find(which)
  if (request === undefined) {
    return { done: undefined, requests: await readSessionRequests($, sessionId) }
  }
  await saveRecord($, replyKeyOf(sessionId, request.id), replyRecordOf(reply))
  const requests = await readSessionRequests($, sessionId)

  return { done: requests.filter(isDone).find(each => each.id === request.id), requests }
}

/**
 * Closes the open request numbered `number` of the session `sessionId` without a reply, and
 * returns what became of the request with the requests of the session.
 */
export async function saveWithdrawal(
  $: EngineInterface,
  sessionId: string,
  number: number,
): Promise<{ withdrawal: Withdrawal; requests: Request[] }> {
  const requests = await readSessionRequests($, sessionId)
  const request = findOpenRequest(requests, number)
  if (request === undefined) {
    return { withdrawal: Withdrawal.NotOpen, requests }
  }
  const withdrawnAt = await $.clock.now()
  const withdrawalKey = recordKeyOf(RecordKind.Withdrawal, sessionId, request.id)
  await saveRecord($, withdrawalKey, { withdrawnAt } satisfies WithdrawalRecord)
  const after = await readSessionRequests($, sessionId)
  const isWithdrawn = after.some(each => each.id === request.id && !isDone(each))

  return { withdrawal: isWithdrawn ? Withdrawal.Withdrawn : Withdrawal.NotOpen, requests: after }
}

/** Stores the replies as read by the session `sessionId`, and returns them as stored. */
export async function saveDelivery(
  $: EngineInterface,
  sessionId: string,
  done: readonly DoneRequest[],
): Promise<DoneRequest[]> {
  const deliveredAt = await $.clock.now()
  await Promise.all(
    done.map(request =>
      saveRecord(
        $,
        recordKeyOf(RecordKind.Delivery, sessionId, request.id),
        { deliveredAt } satisfies DeliveryRecord,
      ),
    ),
  )

  return done.map(request => ({
    ...request,
    reply: { ...request.reply, isDelivered: true },
  }))
}

/**
 * Deletes every record of the requests of the session `sessionId` once the newest of them was made
 * before `requestsMadeBefore`. A record of another shape keeps the requests, since its age is not
 * known.
 */
export async function deleteOldRequests(
  $: EngineInterface,
  { sessionId, requestsMadeBefore }: { sessionId: string; requestsMadeBefore: number },
): Promise<void> {
  const records = await readRequestRecords($, sessionId)
  const madeAt = records.map(({ key, value }) => {
    const kind = readRequestRecordKey(key)?.kind

    return (kind === undefined ? undefined : RECORD_TIMES[kind](value)) ?? Number.POSITIVE_INFINITY
  })
  const [first, ...more] = records.map(({ key }) => key)
  if (first !== undefined && Math.max(...madeAt) < requestsMadeBefore) {
    await writeToStore(() => deleteRecords($, first, more))
  }
}

/** Runs the read `read` of the records, and fails with its refusal as a RequestNotReadError. */
function readFromStore<T>(read: () => Promise<T>): Promise<T> {
  return returningStoreFailure(read, failed => {
    throw new RequestNotReadError(describeFailedStoreCall(failed), failed.cause)
  })
}

function saveRecord($: EngineInterface, key: string, value: unknown): Promise<void> {
  return writeToStore(() => writeRecord($, { key, value }))
}

/** Runs the change `write` of the records, and fails with its refusal as a RequestNotSavedError. */
function writeToStore(write: () => Promise<void>): Promise<void> {
  return returningStoreFailure(write, failed => {
    throw new RequestNotSavedError(failed)
  })
}
