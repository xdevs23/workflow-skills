import type { EngineInterface } from 'claude-code'

import { readJsonText } from './jsonText'

const RECORD_FILE_VERSION = 1

const RECORD_FILE_EXTENSION = '.json'

const TEMP_FILE_EXTENSION = '.tmp'

/** A record under its key, with its value as JSON data, as written or as read before parsing. */
export type StoredEntry = { key: string; value: unknown }

export type RecordFilesEngine = Pick<EngineInterface, 'fs' | 'process' | 'session'>

/** A record file: its records in the order their keys were first set. */
type RecordFile = { version: typeof RECORD_FILE_VERSION; records: StoredEntry[] }

/**
 * A record file as read: its records, none for a file that does not exist, or its text when the
 * text is not a record file of this version.
 */
export type ReadRecordFile =
  | { isReadable: true; records: StoredEntry[] }
  | { isReadable: false; text: string }

/** A change of the records of a file, with the result it returns to its caller. */
type RecordsChange<T> = (records: readonly StoredEntry[]) => { records: StoredEntry[]; result: T }

class UnreadableRecordFileError extends Error {
  constructor(path: string) {
    super(`the file ${path} is not in the shape that this version of the plugin writes`)
  }
}

/** A command run on a record file that exited with a code other than 0. */
class FileCommandError extends Error {
  constructor(argv: readonly string[], exitCode: number, stderr: string) {
    super(`${argv.join(' ')} exited with code ${exitCode}: ${stderr.trim()}`)
  }
}

const queuedChanges = new Map<string, Promise<void>>()

/** The record files in the folder `folder` by name, none when the folder does not exist. */
export async function listRecordFiles($: RecordFilesEngine, folder: string): Promise<string[]> {
  return (await listFilesIn($, folder))
    .filter(name => name.endsWith(RECORD_FILE_EXTENSION))
    .map(name => `${folder}/${name}`)
}

/** The path of the record file named `name` in the folder `folder`. */
export function recordFilePathOf(folder: string, name: string): string {
  return `${folder}/${encodeURIComponent(name)}${RECORD_FILE_EXTENSION}`
}

/** The name of the record file `path`, as given to recordFilePathOf. */
export function recordFileNameOf(path: string): string {
  return decodeURIComponent(path.slice(path.lastIndexOf('/') + 1, -RECORD_FILE_EXTENSION.length))
}

/**
 * Sets each record of `entries` in the file `path`. Setting a key that is already in the file
 * replaces its value in the same place among the records, and a new key comes last.
 */
export function setRecordsInFile(
  $: RecordFilesEngine,
  path: string,
  entries: readonly StoredEntry[],
): Promise<void> {
  return changeRecords($, path, records => {
    const set = new Map(records.map(({ key, value }) => [key, value]))
    for (const { key, value } of entries) {
      set.set(key, value)
    }

    return { records: [...set].map(([key, value]) => ({ key, value })), result: undefined }
  })
}

/**
 * Adds each record of `entries` whose key the file `path` does not have, after its records, and
 * returns the keys added.
 */
export function addMissingRecords(
  $: RecordFilesEngine,
  path: string,
  entries: readonly StoredEntry[],
): Promise<string[]> {
  return changeRecords($, path, records => {
    const keys = new Set(records.map(({ key }) => key))
    const added = entries.filter(({ key }) => !keys.has(key))

    return { records: [...records, ...added], result: added.map(({ key }) => key) }
  })
}

/**
 * Creates the file `path` with the records of `entries` while no file is there, and returns
 * whether it did. A file already there is left as it is.
 */
export function createRecordFile(
  $: RecordFilesEngine,
  path: string,
  entries: readonly StoredEntry[],
): Promise<boolean> {
  return changeInTurn(path, () => createFile($, path, [...entries]))
}

/** Deletes the records under the keys `keys` from the file `path`, and the file once empty. */
export function deleteRecordsFromFile(
  $: RecordFilesEngine,
  path: string,
  keys: readonly string[],
): Promise<void> {
  return changeRecords($, path, records => ({
    records: records.filter(({ key }) => !keys.includes(key)),
    result: undefined,
  }))
}

async function listFilesIn($: RecordFilesEngine, folder: string): Promise<string[]> {
  if (!(await $.fs.exists(folder))) {
    return []
  }

  return (await $.fs.list(folder))
    .filter(entry => entry.kind === 'file')
    .map(entry => entry.name)
    .sort()
}

/** Applies `change` to the records of the file `path`, once every earlier change of it settled. */
function changeRecords<T>(
  $: RecordFilesEngine,
  path: string,
  change: RecordsChange<T>,
): Promise<T> {
  return changeInTurn(path, () => applyChange($, path, change))
}

/**
 * Writes the records that `change` makes of the file `path`. A file that another process created
 * after the read is read again, and an empty file is deleted.
 */
async function applyChange<T>(
  $: RecordFilesEngine,
  path: string,
  change: RecordsChange<T>,
): Promise<T> {
  const file = await readRecordFileToChange($, path)
  const { records, result } = change(file?.records ?? [])
  if (file === undefined) {
    const isWritten = records.length === 0 || (await createFile($, path, records))

    return isWritten ? result : applyChange($, path, change)
  }
  if (records.length === 0) {
    await runFileCommand($, ['rm', '-f', path])
  } else {
    await replaceFile($, path, records)
  }

  return result
}

/**
 * Runs `change` of the file `path` once every change of it queued before by this process settled,
 * so that no change of this process overwrites another.
 */
function changeInTurn<T>(path: string, change: () => Promise<T>): Promise<T> {
  const changed = (queuedChanges.get(path) ?? Promise.resolve()).then(change)
  const release = (): void => {
    if (queuedChanges.get(path) === settled) {
      queuedChanges.delete(path)
    }
  }
  const settled = changed.then(release, release)
  queuedChanges.set(path, settled)

  return changed
}

/**
 * The record file `path` as read. A file that does not exist, also one deleted while it was read,
 * has no records.
 */
export async function readRecordFile($: RecordFilesEngine, path: string): Promise<ReadRecordFile> {
  const text = await readTextOf($, path)
  if (text === undefined) {
    return { isReadable: true, records: [] }
  }
  const read = readJsonText(text, toRecordFile)

  return read.isRead
    ? { isReadable: true, records: read.model.records }
    : { isReadable: false, text }
}

/** The record file `path`, undefined when it does not exist. Fails on a file of another shape. */
async function readRecordFileToChange(
  $: RecordFilesEngine,
  path: string,
): Promise<RecordFile | undefined> {
  const text = await readTextOf($, path)
  if (text === undefined) {
    return undefined
  }
  const read = readJsonText(text, toRecordFile)
  if (!read.isRead) {
    throw new UnreadableRecordFileError(path)
  }

  return read.model
}

/** The text of the file `path`, or undefined when it does not exist. */
async function readTextOf($: RecordFilesEngine, path: string): Promise<string | undefined> {
  try {
    return await $.fs.read(path)
  } catch (error) {
    if (!(error instanceof Error) || (await $.fs.exists(path))) {
      throw error
    }

    return undefined
  }
}

/**
 * Replaces the file `path` with `records`. It writes a new file beside `path` and renames that file
 * over `path`, so a reader sees the old or the new content and never a part of it, and a crash
 * leaves one of the two.
 */
async function replaceFile(
  $: RecordFilesEngine,
  path: string,
  records: StoredEntry[],
): Promise<void> {
  const written = await writeTempFile($, path, records)
  const moved = await $.process.run(['mv', '-f', written, path])
  if (moved.exitCode !== 0) {
    await runFileCommand($, ['rm', '-f', written])
    throw new FileCommandError(['mv', '-f', written, path], moved.exitCode, moved.stderr)
  }
}

/**
 * Creates the file `path` with `records` while no file is there, and returns whether it did. It
 * writes a new file beside `path` and links it to `path`, which fails on a file already there.
 */
async function createFile(
  $: RecordFilesEngine,
  path: string,
  records: StoredEntry[],
): Promise<boolean> {
  const written = await writeTempFile($, path, records)
  const linked = await $.process.run(['ln', written, path])
  await runFileCommand($, ['rm', '-f', written])
  if (linked.exitCode === 0) {
    return true
  }
  if (await $.fs.exists(path)) {
    return false
  }
  throw new FileCommandError(['ln', written, path], linked.exitCode, linked.stderr)
}

/**
 * Writes `records` to a new file beside `path`, named after the running session, and returns its
 * path. The writes of two sessions never share one, and the next write of the session replaces a
 * file left by a crash.
 */
async function writeTempFile(
  $: RecordFilesEngine,
  path: string,
  records: StoredEntry[],
): Promise<string> {
  const written = `${path}.${await $.session.id()}${TEMP_FILE_EXTENSION}`
  const file: RecordFile = { version: RECORD_FILE_VERSION, records }
  await $.fs.write(written, JSON.stringify(file))

  return written
}

// The engine has no call that renames, links or deletes a file, so `mv`, `ln` and `rm` do it.
async function runFileCommand($: RecordFilesEngine, argv: readonly string[]): Promise<void> {
  const { exitCode, stderr } = await $.process.run(argv)
  if (exitCode !== 0) {
    throw new FileCommandError(argv, exitCode, stderr)
  }
}

function toRecordFile(value: unknown): RecordFile | undefined {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('version' in value) ||
    value.version !== RECORD_FILE_VERSION ||
    !('records' in value) ||
    !Array.isArray(value.records)
  ) {
    return undefined
  }
  const records = value.records.flatMap((each: unknown) => {
    const entry = toStoredEntry(each)

    return entry === undefined ? [] : [entry]
  })

  return records.length === value.records.length
    ? { version: RECORD_FILE_VERSION, records }
    : undefined
}

function toStoredEntry(value: unknown): StoredEntry | undefined {
  return typeof value === 'object' &&
    value !== null &&
    'key' in value &&
    typeof value.key === 'string' &&
    'value' in value
    ? { key: value.key, value: value.value }
    : undefined
}
