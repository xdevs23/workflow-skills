import type { EngineInterface } from 'claude-code'

import { isErrorWithText } from './errorMessage'

/**
 * The kinds of record in the store used by the plugin. Every record is stored under the key
 * `<kind>:<owner>:<rest>`. The owner is the one writer of the record, such as a session, and the
 * rest is read by the module of the kind. The store does not offer compare-and-set, so no key is
 * written by two owners.
 */
export enum RecordKind {
  Question = 'questions',
  Answer = 'answers',
  Withdrawal = 'withdrawals',
  Delivery = 'deliveries',
  Goal = 'goals',
  Reminder = 'reminders',
  Session = 'sessions',
}

const KEY_SEPARATOR = ':'

export function recordKeyOf(kind: RecordKind, ...parts: readonly string[]): string {
  return [kind, ...parts].join(KEY_SEPARATOR)
}

/** The start of every key of the kind `kind` that begins with `parts`. */
export function recordPrefixOf(kind: RecordKind, ...parts: readonly string[]): string {
  return `${recordKeyOf(kind, ...parts)}${KEY_SEPARATOR}`
}

/** The part of `key` that follows `prefix`, up to the next separator, when `key` starts with it. */
export function keyPartAfter(prefix: string, key: string): string | undefined {
  return key.startsWith(prefix) ? key.slice(prefix.length).split(KEY_SEPARATOR)[0] : undefined
}

/**
 * The default folder of the store file used by the plugin, named in the texts of its errors. The
 * engine types offer no accessor for the folder in use.
 */
export const STORE_FOLDER = '~/.claude/plugins/store/'

export function describeUnreadableRecord(key: string): string {
  return (
    `The stored record under the key ${key} is not in the shape this plugin writes. Restore or ` +
    `delete that entry in the store file used by this plugin in ${STORE_FOLDER}, then try again.`
  )
}

/** The calls on the store that can fail. */
export enum StoreCall {
  List = 'list',
  Read = 'read',
  Write = 'write',
}

/**
 * A call on the store that failed: the call, the key it was made for, or the start of the keys
 * listed, and the error of the store.
 */
export type FailedStoreCall = { call: StoreCall; key: string; cause: Error }

/** A record of the store under its key, as read, before it is parsed. */
export type StoredEntry = { key: string; value: unknown }

/** A failed call on the store, passed up to the read or the change that made it. */
class StoreCallError extends Error {
  readonly failed: FailedStoreCall

  constructor(failed: FailedStoreCall) {
    super(failed.cause.message, { cause: failed.cause })
    this.failed = failed
  }
}

/** Runs the call `call` on the store, made as `storeCall` for `key`, and fails with its failure. */
export async function callStore<T>(
  storeCall: StoreCall,
  key: string,
  call: () => Promise<T>,
): Promise<T> {
  try {
    return await call()
  } catch (error) {
    if (!(error instanceof Error)) {
      throw error
    }
    throw new StoreCallError({ call: storeCall, key, cause: error })
  }
}

/**
 * Runs `work`, and returns the failure of the call on the store that stopped it, as `toFailed`
 * makes it from that failure.
 */
export async function returningStoreFailure<T, Failed>(
  work: () => Promise<T>,
  toFailed: (failed: FailedStoreCall) => Failed,
): Promise<T | Failed> {
  try {
    return await work()
  } catch (error) {
    if (error instanceof StoreCallError) {
      return toFailed(error.failed)
    }
    throw error
  }
}

/** The start shared by every key, which a failed list of every key names. */
const EVERY_KEY_PREFIX = ''

/** Every key of the store, in the order the keys were first set, through callStore. */
export function listKeys($: StoreEngine): Promise<string[]> {
  return callStore(StoreCall.List, EVERY_KEY_PREFIX, () => $.store.keys())
}

/**
 * Reads every record of the store whose key starts with `prefix`, in the order the keys were first
 * set, through callStore. A record deleted after the keys were listed is left out.
 */
export async function readEntriesUnder($: StoreEngine, prefix: string): Promise<StoredEntry[]> {
  return readEntriesIn($, prefix, await callStore(StoreCall.List, prefix, () => $.store.keys()))
}

/**
 * Reads the records of the store under the keys of `keys` that start with `prefix`, in their order
 * in `keys`, through callStore. A record deleted after the keys were listed is left out.
 */
export async function readEntriesIn(
  $: StoreEngine,
  prefix: string,
  keys: readonly string[],
): Promise<StoredEntry[]> {
  const entries = await Promise.all(
    keys
      .filter(key => key.startsWith(prefix))
      .map(async key => ({
        key,
        value: await callStore(StoreCall.Read, key, () => $.store.get(key)),
      })),
  )

  return entries.filter(entry => entry.value !== undefined)
}

/** The reason and the next step for the failed call on the store `failed`. */
export function describeFailedStoreCall(failed: {
  call: StoreCall
  key: string
  cause: Pick<Error, 'message'>
}): string {
  const { key, cause } = failed
  switch (failed.call) {
    case StoreCall.List:
      return describeRefusedListing(cause)
    case StoreCall.Read:
      return describeRefusedRead(key, cause)
    case StoreCall.Write:
      return describeRefusedWrite(key, cause)
  }
}

/** The next step after a read refused by the store. */
const CHECK_READABLE =
  `Check that the store file used by this plugin in ${STORE_FOLDER} can be read, ` +
  'then try again.'

export function describeRefusedRead(key: string, cause: Pick<Error, 'message'>): string {
  return `The store could not read the key ${key}: ${cause.message}. ${CHECK_READABLE}`
}

export function describeRefusedListing(cause: Pick<Error, 'message'>): string {
  return `The store could not list its keys: ${cause.message}. ${CHECK_READABLE}`
}

export function describeRefusedWrite(key: string, cause: Pick<Error, 'message'>): string {
  return (
    `The store did not save the change to the key ${key}: ${cause.message}. Check that the ` +
    `store file used by this plugin in ${STORE_FOLDER} can be written. If the store is over ` +
    '4 MiB, delete the records of sessions no longer needed from that file. Then try again.'
  )
}

/**
 * The text in the error of a write the store rejects while another process writes its file. The
 * rejection is transient, so the write is made again.
 */
export const LOCK_REFUSAL = 'Lock file is already being held'

// A write is awaited by a pane or a tool call in front of a person, so the wait before the next try
// grows from a short first wait up to one second and goes no longer.
const FIRST_RETRY_WAIT_MS = 50
const LONGEST_RETRY_WAIT_MS = 1000

/** The calls on the engine made by a write to the store besides the write: the wait and the log. */
export type StoreWaiter = {
  clock: Pick<EngineInterface['clock'], 'sleep'>
  ui: Pick<EngineInterface['ui'], 'log'>
}

/** The calls on the engine made by reading and writing records of the store. */
export type StoreEngine = StoreWaiter & { store: EngineInterface['store'] }

/**
 * Runs the write `write` to the key `key`, and again after a random wait while another process
 * writes the store file, writing each failed try to the debug log. Rejects with the error of every
 * other refusal.
 */
export async function writeRetryingWhileLocked(
  $: StoreWaiter,
  key: string,
  write: () => Promise<void>,
): Promise<void> {
  for (let tries = 1; ; tries += 1) {
    try {
      await write()

      return
    } catch (error) {
      if (!isErrorWithText(error, LOCK_REFUSAL)) {
        throw error
      }
      const message = `The write to the key ${key} failed at try ${tries}: ${error.message}.`
      $.ui.log(`${message} Writing again.`, { to: 'debug' })
    }
    await $.clock.sleep(retryWaitAfter(tries))
  }
}

/** Runs the change `write` to the key `key` as writeRetryingWhileLocked does, through callStore. */
export function writeToStore(
  $: StoreWaiter,
  key: string,
  write: () => Promise<void>,
): Promise<void> {
  return callStore(StoreCall.Write, key, () => writeRetryingWhileLocked($, key, write))
}

/** A record written to the store: its key, and its value as the store saves it. */
export type StoreRecord = { key: string; value: unknown }

export function writeRecord($: StoreEngine, record: StoreRecord): Promise<void> {
  return writeToStore($, record.key, () => $.store.set(record.key, record.value))
}

export function deleteRecord($: StoreEngine, key: string): Promise<void> {
  return writeToStore($, key, () => $.store.delete(key))
}

/**
 * A random wait after the try numbered `tries`, up to a limit that doubles with each try until it
 * reaches the longest wait, so processes that collided do not try again at the same moment.
 */
function retryWaitAfter(tries: number): number {
  return Math.random() * Math.min(LONGEST_RETRY_WAIT_MS, FIRST_RETRY_WAIT_MS * 2 ** (tries - 1))
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** `value` as a list of strings, or undefined for anything else, such as a list with a number. */
export function readStrings(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined
  }
  const strings = value.filter(item => typeof item === 'string')

  return strings.length === value.length ? strings : undefined
}
