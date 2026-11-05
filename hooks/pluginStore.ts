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
  QuestionSkillLoad = 'questionSkillLoads',
  Goal = 'goals',
}

const KEY_SEPARATOR = ':'

export function recordKeyOf(kind: RecordKind, ...parts: readonly string[]): string {
  return [kind, ...parts].join(KEY_SEPARATOR)
}

/** The start of every key of the kind `kind` that begins with `parts`. */
export function recordPrefixOf(kind: RecordKind, ...parts: readonly string[]): string {
  return `${recordKeyOf(kind, ...parts)}${KEY_SEPARATOR}`
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

/** The next step after a read refused by the store. */
const CHECK_READABLE =
  `Check that the store file used by this plugin in ${STORE_FOLDER} can be read, ` +
  'then try again.'

export function describeRefusedRead(key: string, cause: Error): string {
  return `The store could not read the key ${key}: ${cause.message}. ${CHECK_READABLE}`
}

export function describeRefusedListing(cause: Error): string {
  return `The store could not list its keys: ${cause.message}. ${CHECK_READABLE}`
}

export function describeRefusedWrite(key: string, cause: Error): string {
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
