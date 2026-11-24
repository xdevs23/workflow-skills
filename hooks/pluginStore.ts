import { deleteRecordsFromFile, readRecordFile, setRecordsInFile } from './recordFiles'
import type { ReadRecordFile, RecordFilesEngine, StoredEntry } from './recordFiles'
import { entriesOf, filePathOfKey, filesOfKeys, recordFilesUnder } from './recordPlacement'
import { describeRecordsFolderNotFound, recordsPlaceOf } from './recordsFolder'
import type { RecordsFolderEngine } from './recordsFolder'
import { StoreCall, StoreCallError, callStore } from './storeFailures'

export type { StoredEntry } from './recordFiles'

/**
 * Reads every record of the project whose key starts with `prefix`, in the order the keys were
 * first set, through callStore.
 */
export async function readEntriesUnder($: StoreEngine, prefix: string): Promise<StoredEntry[]> {
  return readEntriesUnderAny($, prefix, [])
}

/**
 * Reads, for `prefix` and then for each prefix of `more`, every record of the project whose key
 * starts with it, in the order the keys were first set, each file read once, through callStore. No
 * prefix may start another.
 */
export async function readEntriesUnderAny(
  $: StoreEngine,
  prefix: string,
  more: readonly string[],
): Promise<StoredEntry[]> {
  const folder = await recordsFolderFor($, prefix)

  return callStore(StoreCall.Read, prefix, () =>
    readStoredEntriesUnderAny($, folder, [prefix, ...more]),
  )
}

/**
 * Reads the records of the project under the keys of `keys` that start with `prefix`, in their
 * order in `keys`, through callStore. A record deleted after the keys were listed is left out.
 */
export async function readEntriesIn(
  $: StoreEngine,
  prefix: string,
  keys: readonly string[],
): Promise<StoredEntry[]> {
  const read = keys.filter(key => key.startsWith(prefix))
  const files = filesOfKeys(await recordsFolderFor($, prefix), read)

  return callStore(StoreCall.Read, prefix, async () => {
    const values = await readStoredValues($, files)

    return read.flatMap(key => (values.has(key) ? [{ key, value: values.get(key) }] : []))
  })
}

/**
 * The records folder of the running session, for the call on the store made for `key`. Fails as
 * a failed lookup of the records folder when the folder is not known.
 */
async function recordsFolderFor($: StoreEngine, key: string): Promise<string> {
  const place = await recordsPlaceOf($)
  if (!place.isFound) {
    const cause = new Error(describeRecordsFolderNotFound(place.failure))
    throw new StoreCallError({ call: StoreCall.FindRecordsFolder, key, cause })
  }

  return place.folder
}

async function readStoredEntriesUnderAny(
  $: StoreEngine,
  folder: string,
  prefixes: readonly string[],
): Promise<StoredEntry[]> {
  const reads = new Map<string, Promise<ReadRecordFile>>()
  const entriesOfPrefixes = await Promise.all(
    prefixes.map(async prefix => {
      const files = await recordFilesUnder($, folder, prefix)
      const entries = await Promise.all(
        files.map(async ({ path, keyWhenUnreadable }) => {
          const read = reads.get(path) ?? readRecordFile($, path)
          reads.set(path, read)

          return entriesOf(await read, keyWhenUnreadable)
        }),
      )

      return entries.flat().filter(entry => entry.key.startsWith(prefix))
    }),
  )

  return entriesOfPrefixes.flat()
}

/** The values of the records under the keys of each file in `files`, each file read once. */
async function readStoredValues(
  $: StoreEngine,
  files: ReadonlyMap<string, readonly string[]>,
): Promise<Map<string, unknown>> {
  const entries = await Promise.all(
    [...files].map(async ([path, keys]) => {
      const read = await readRecordFile($, path)

      return read.isReadable
        ? read.records.filter(({ key }) => keys.includes(key))
        : keys.map(key => ({ key, value: read.text }))
    }),
  )

  return new Map(entries.flat().map(({ key, value }) => [key, value]))
}

export type StoreEngine = RecordFilesEngine & RecordsFolderEngine

export async function writeRecord($: StoreEngine, record: StoredEntry): Promise<void> {
  const path = filePathOfKey(await recordsFolderFor($, record.key), record.key)

  return callStore(StoreCall.Write, record.key, () => setRecordsInFile($, path, [record]))
}

export function deleteRecord($: StoreEngine, key: string): Promise<void> {
  return deleteRecords($, key, [])
}

/** Deletes the records under `key` and the keys of `more`, each file changed once. */
export async function deleteRecords(
  $: StoreEngine,
  key: string,
  more: readonly string[],
): Promise<void> {
  const files = filesOfKeys(await recordsFolderFor($, key), [key, ...more])

  return callStore(StoreCall.Write, key, async () => {
    await Promise.all([...files].map(([path, keys]) => deleteRecordsFromFile($, path, keys)))
  })
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
