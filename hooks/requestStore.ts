import type { EngineInterface } from 'claude-code'

import type { Request } from '../types'
import {
  RecordKind,
  describeRefusedListing,
  describeRefusedRead,
  recordKeyOf,
  recordPrefixOf,
  writeRetryingWhileLocked,
} from './pluginStore'
import {
  RECORD_TIMES,
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
import { MILLISECONDS_PER_HOUR } from './timeUnits'

/**
 * The requests of another session are deleted at the start of a process once the newest of their
 * records is this old, so the store contains no requests of sessions ended long ago. The age
 * leaves a month for `claude --resume` to bring a session back with its requests.
 */
export const SESSION_REQUESTS_MAX_AGE_MS = 30 * 24 * MILLISECONDS_PER_HOUR

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

/** The records of one kind in the session, by the id of their request, in the order set. */
async function readRecords<T>(
  $: EngineInterface,
  keys: readonly string[],
  record: RecordKind,
  sessionId: string,
  parse: (key: string, id: string, value: unknown) => T,
): Promise<Map<string, T>> {
  const prefix = recordPrefixOf(record, sessionId)
  const stored = await Promise.all(
    keys
      .filter(key => key.startsWith(prefix))
      .map(async key => ({
        key,
        id: idOf(key.slice(prefix.length)),
        value: await readStoreValue($, key),
      })),
  )
  const records = new Map<string, T>()
  for (const { key, id, value } of stored) {
    if (value !== undefined && !records.has(id)) {
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
  const keys = await readStoreKeys($)
  const [requests, replies, withdrawals, deliveries] = await Promise.all([
    readRecords($, keys, RecordKind.Request, sessionId, parseRequest),
    readRecords($, keys, RecordKind.Reply, sessionId, parseReply),
    readRecords($, keys, RecordKind.Withdrawal, sessionId, parseRecordTime(RecordKind.Withdrawal)),
    readRecords($, keys, RecordKind.Delivery, sessionId, parseRecordTime(RecordKind.Delivery)),
  ])

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
 * Deletes the records of the requests of every session other than `old.sessionId` whose newest
 * record was made before `old.requestsMadeBefore`. A record of another shape, or one deleted since
 * the keys were listed, protects the session from deletion, since the age of the record is unknown.
 */
export async function deleteOldRecords(
  $: EngineInterface,
  { sessionId, requestsMadeBefore }: { sessionId: string; requestsMadeBefore: number },
): Promise<void> {
  const records = (await readStoreKeys($)).flatMap(key => {
    const record = readRequestRecordKey(key)

    return record === undefined || record.owner === sessionId ? [] : [record]
  })
  const made = await Promise.all(
    records.map(async ({ key, kind, owner }) => ({
      key,
      owner,
      madeAt: RECORD_TIMES[kind](await readStoreValue($, key)) ?? Number.POSITIVE_INFINITY,
    })),
  )
  const newest = new Map<string, number>()
  for (const { owner, madeAt } of made) {
    newest.set(owner, Math.max(newest.get(owner) ?? madeAt, madeAt))
  }
  const idle = new Set(
    [...newest].filter(([, madeAt]) => madeAt < requestsMadeBefore).map(([owner]) => owner),
  )
  await Promise.all(
    made.filter(({ owner }) => idle.has(owner)).map(({ key }) => deleteRecord($, key)),
  )
}

export function readStoreKeys($: EngineInterface): Promise<string[]> {
  return readFromStore(() => $.store.keys(), describeRefusedListing)
}

export function readStoreValue($: EngineInterface, key: string): Promise<unknown> {
  return readFromStore(() => $.store.get(key), cause => describeRefusedRead(key, cause))
}

/** Runs the read `read` of the store, and fails with its refusal as `describe` describes it. */
async function readFromStore<T>(
  read: () => Promise<T>,
  describe: (cause: Error) => string,
): Promise<T> {
  try {
    return await read()
  } catch (error) {
    if (!(error instanceof Error)) {
      throw error
    }
    throw new RequestNotReadError(describe(error), error)
  }
}

export function saveRecord($: EngineInterface, key: string, value: unknown): Promise<void> {
  return writeRecord($, key, () => $.store.set(key, value))
}

export function deleteRecord($: EngineInterface, key: string): Promise<void> {
  return writeRecord($, key, () => $.store.delete(key))
}

/** Runs the change `write` to the key `key`, and fails with the refusal of the store. */
async function writeRecord($: EngineInterface, key: string, write: () => Promise<void>) {
  try {
    await writeRetryingWhileLocked($, key, write)
  } catch (error) {
    if (!(error instanceof Error)) {
      throw error
    }
    throw new RequestNotSavedError(key, error)
  }
}
