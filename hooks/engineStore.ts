import type { EngineInterface } from 'claude-code'

import { isErrorWithText } from './errorMessage'
import { StoreCall, callStore } from './storeFailures'
import type { StoredEntry } from './pluginStore'
import { randomWaitAfter } from './retryWait'
import type { RetryWaits } from './retryWait'

// Earlier versions of the plugin stored every record in the key-value store of the engine, one file
// shared by every project on the machine. Only the move of those records into the records of each
// project reads or changes that store, through the functions below, each through callStore.

/**
 * The text in the error of a write that the store rejects while another process writes its file.
 * The rejection is transient, so the code writes again.
 */
const LOCK_REFUSAL = 'Lock file is already being held'

// A person at the prompt waits for the write at the start of a session, so the wait before the next
// try grows from a short first wait to a limit of one second.
const STORE_RETRY_WAITS: RetryWaits = { firstMs: 50, longestMs: 1000 }

/** The start shared by every key, as the text of a failed list of every key shows it. */
const EVERY_KEY_PREFIX = ''

/** Every key of the store of the engine, in the order the keys were first set. */
export function readEngineStoreKeys($: EngineInterface): Promise<string[]> {
  return callStore(StoreCall.List, EVERY_KEY_PREFIX, () => $.store.keys())
}

/** The records of the store of the engine under the keys of `keys`, without the keys unset. */
export async function readEngineStoreEntries(
  $: EngineInterface,
  keys: readonly string[],
): Promise<StoredEntry[]> {
  const entries = await Promise.all(
    keys.map(async key => ({
      key,
      value: await callStore(StoreCall.Read, key, () => $.store.get(key)),
    })),
  )

  return entries.filter(({ value }) => value !== undefined)
}

export function writeEngineStoreEntry($: EngineInterface, entry: StoredEntry): Promise<void> {
  const { key, value } = entry

  return callStore(StoreCall.Write, key, () =>
    writeRetryingWhileLocked($, key, () => $.store.set(key, value)),
  )
}

export function deleteEngineStoreValue($: EngineInterface, key: string): Promise<void> {
  return callStore(StoreCall.Write, key, () =>
    writeRetryingWhileLocked($, key, () => $.store.delete(key)),
  )
}

/**
 * Runs the write `write` to the key `key`, and again after a random wait while another process
 * writes the store file, writing each failed try to the debug log. Rejects with the error of every
 * other refusal.
 */
async function writeRetryingWhileLocked(
  $: EngineInterface,
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
    await $.clock.sleep(randomWaitAfter(tries, STORE_RETRY_WAITS))
  }
}
