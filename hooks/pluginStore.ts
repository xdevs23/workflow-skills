import {
  deleteRecordsFromFile,
  listRecordFiles,
  readRecordFile,
  recordFileNameOf,
  recordFilePathOf,
  setRecordsInFile,
} from './recordFiles'
import type { ReadRecordFile, RecordFilesEngine, StoredEntry } from './recordFiles'
import { RECORDS_FOLDER_TEXT, describeRecordsFolderNotFound, recordsPlaceOf } from './recordsFolder'
import type { RecordsFolderEngine } from './recordsFolder'

export type { StoredEntry } from './recordFiles'

/**
 * The kinds of record in the store used by the plugin. Every record is stored under the key
 * `<kind>:<owner>:<rest>`. The owner is the one writer of the record, such as a session, and the
 * rest is read by the module of the kind. The store does not offer compare-and-set, so no key is
 * written by two owners. The kinds of a request and of its reply use the keys `questions` and
 * `answers`, since stored records use these keys.
 */
export enum RecordKind {
  Request = 'questions',
  Reply = 'answers',
  Withdrawal = 'withdrawals',
  Delivery = 'deliveries',
  Goal = 'goals',
  Reminder = 'reminders',
  Session = 'sessions',
  IdleRoast = 'idle-roast',
  Idea = 'ideas',
  ProjectAutonomy = 'project-autonomy',
  GoalAutonomy = 'goal-autonomy',
  AutonomyRevocation = 'autonomy-revocations',
}

/**
 * Who owns a record: one session, the only writer of the file used by that session, or the
 * project, whose every session may replace or delete the file of the record.
 */
export enum RecordOwner {
  Session = 'session',
  Project = 'project',
}

/** The kind of scope written before the session in the keys of goals and reminders. */
export const SESSION_SCOPE = 'session'

/**
 * The owner of the records of a kind. The key of a record owned by a session has the parts of
 * `scope` after the kind, and the session after them.
 */
type Ownership =
  | { owner: RecordOwner.Session; scope: readonly string[] }
  | { owner: RecordOwner.Project }

const SESSION_AFTER_KIND: Ownership = { owner: RecordOwner.Session, scope: [] }
const SESSION_AFTER_SESSION_SCOPE: Ownership = {
  owner: RecordOwner.Session,
  scope: [SESSION_SCOPE],
}
const OWNED_BY_PROJECT: Ownership = { owner: RecordOwner.Project }

const OWNERSHIP_OF_KINDS: Record<RecordKind, Ownership> = {
  [RecordKind.Request]: SESSION_AFTER_KIND,
  [RecordKind.Reply]: SESSION_AFTER_KIND,
  [RecordKind.Withdrawal]: SESSION_AFTER_KIND,
  [RecordKind.Delivery]: SESSION_AFTER_KIND,
  [RecordKind.Goal]: SESSION_AFTER_SESSION_SCOPE,
  [RecordKind.Reminder]: SESSION_AFTER_SESSION_SCOPE,
  [RecordKind.Session]: SESSION_AFTER_KIND,
  [RecordKind.IdleRoast]: SESSION_AFTER_KIND,
  [RecordKind.Idea]: OWNED_BY_PROJECT,
  [RecordKind.ProjectAutonomy]: OWNED_BY_PROJECT,
  [RecordKind.GoalAutonomy]: SESSION_AFTER_KIND,
  [RecordKind.AutonomyRevocation]: OWNED_BY_PROJECT,
}

const KINDS_OWNED_BY_PROJECT = Object.values(RecordKind).filter(
  kind => OWNERSHIP_OF_KINDS[kind].owner === RecordOwner.Project,
)

const SESSIONS_FOLDER = 'sessions'
const PROJECT_FOLDER = 'project'

/** The file for a record in the records folder for a project, with the owner of the record. */
export type FileOfRecord =
  | { owner: RecordOwner.Session; sessionId: string; path: string }
  | { owner: RecordOwner.Project; path: string }

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
 * The file for the record under `key` in the records folder `folder`, or undefined for a key of no
 * kind, or for a key without the session that owns it.
 */
export function fileOfRecord(folder: string, key: string): FileOfRecord | undefined {
  const kind = kindOfKey(key)
  if (kind === undefined) {
    return undefined
  }
  const ownership = OWNERSHIP_OF_KINDS[kind]
  switch (ownership.owner) {
    case RecordOwner.Session: {
      const sessionId = sessionNamedIn(key.split(KEY_SEPARATOR), ownership.scope)

      return sessionId === undefined
        ? undefined
        : { owner: ownership.owner, sessionId, path: sessionFilePathOf(folder, sessionId) }
    }
    case RecordOwner.Project:
      return {
        owner: ownership.owner,
        path: recordFilePathOf(folderOfKind(folder, kind), key.slice(recordPrefixOf(kind).length)),
      }
  }
}

function kindOfKey(key: string): RecordKind | undefined {
  return Object.values(RecordKind).find(kind => key.startsWith(recordPrefixOf(kind)))
}

/** The session in the parts `parts` of a key, after the kind and the parts of `scope`. */
function sessionNamedIn(parts: readonly string[], scope: readonly string[]): string | undefined {
  const [, ...afterKind] = parts
  const sessionId = afterKind[scope.length]
  const isInScope = scope.every((part, index) => afterKind[index] === part)

  return isInScope && sessionId !== undefined && sessionId !== '' ? sessionId : undefined
}

function sessionFilePathOf(folder: string, sessionId: string): string {
  return recordFilePathOf(`${folder}/${SESSIONS_FOLDER}`, sessionId)
}

function folderOfKind(folder: string, kind: RecordKind): string {
  return `${folder}/${PROJECT_FOLDER}/${kind}`
}

/**
 * A record file read for the keys that start with a prefix, with the key under which its text
 * reads when the file is not a record file: the key of its record, or the prefix where it names
 * the session of the file. A session file read for keys of every session has no such key.
 */
type FileInRead = { path: string; keyWhenUnreadable: string | undefined }

/**
 * The record files in the records folder `folder` that can contain a key starting with `prefix`:
 * the file used by the session that the complete parts of the prefix name, or every session file,
 * every file of the kind, or every file.
 */
async function recordFilesUnder(
  $: StoreEngine,
  folder: string,
  prefix: string,
): Promise<FileInRead[]> {
  const kind = kindOfKey(prefix)
  if (kind === undefined) {
    const files = await Promise.all([
      sessionFilesIn($, folder),
      ...KINDS_OWNED_BY_PROJECT.map(each => recordFilesOfKind($, folder, each)),
    ])

    return files.flat()
  }
  const ownership = OWNERSHIP_OF_KINDS[kind]
  if (ownership.owner === RecordOwner.Project) {
    return recordFilesOfKind($, folder, kind)
  }
  const completeParts = prefix.split(KEY_SEPARATOR).slice(0, -1)
  const sessionId = sessionNamedIn(completeParts, ownership.scope)

  return sessionId === undefined
    ? sessionFilesIn($, folder)
    : [{ path: sessionFilePathOf(folder, sessionId), keyWhenUnreadable: prefix }]
}

async function sessionFilesIn($: StoreEngine, folder: string): Promise<FileInRead[]> {
  const paths = await listRecordFiles($, `${folder}/${SESSIONS_FOLDER}`)

  return paths.map(path => ({ path, keyWhenUnreadable: undefined }))
}

async function recordFilesOfKind(
  $: StoreEngine,
  folder: string,
  kind: RecordKind,
): Promise<FileInRead[]> {
  const paths = await listRecordFiles($, folderOfKind(folder, kind))

  return paths.map(path => ({ path, keyWhenUnreadable: recordKeyOf(kind, recordFileNameOf(path)) }))
}

/** The records of the file `read`, or its text as the record under `keyWhenUnreadable`. */
function entriesOf(read: ReadRecordFile, keyWhenUnreadable: string | undefined): StoredEntry[] {
  if (read.isReadable) {
    return read.records
  }

  return keyWhenUnreadable === undefined ? [] : [{ key: keyWhenUnreadable, value: read.text }]
}

export function describeUnreadableRecord(key: string): string {
  return (
    `The stored record under the key ${key} is not in the shape that this version of the plugin ` +
    'writes. A newer version may have written it: then update the plugin. Otherwise restore or ' +
    `delete that record in its file in ${RECORDS_FOLDER_TEXT}. Then try again.`
  )
}

/** The calls on the store that can fail, and the lookup of the records folder that each makes. */
export enum StoreCall {
  FindRecordsFolder = 'find records folder',
  List = 'list',
  Read = 'read',
  Write = 'write',
}

/**
 * A call on the store that failed: the call, the key it was made for, or the start of the keys
 * listed, and the error of the store.
 */
export type FailedStoreCall = { call: StoreCall; key: string; cause: Error }

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

/** The keys of `keys` by the path of their file. */
function filesOfKeys(folder: string, keys: readonly string[]): Map<string, string[]> {
  const files = new Map<string, string[]>()
  for (const key of keys) {
    const path = filePathOfKey(folder, key)
    files.set(path, [...(files.get(path) ?? []), key])
  }

  return files
}

/** The path of the file of the record under `key`. Fails for a key of no kind of record. */
function filePathOfKey(folder: string, key: string): string {
  const file = fileOfRecord(folder, key)
  if (file === undefined) {
    throw new UnplacedKeyError(key)
  }

  return file.path
}

/** A key that matches no kind of record, or that lacks the session that owns it. */
class UnplacedKeyError extends Error {
  constructor(key: string) {
    super(
      `The key ${key} matches no kind of record of this plugin, so the plugin has no file for it`,
    )
  }
}

/** The reason and the next step for the failed call on the store `failed`. */
export function describeFailedStoreCall(failed: {
  call: StoreCall
  key: string
  cause: Pick<Error, 'message'>
}): string {
  const { key, cause } = failed
  switch (failed.call) {
    case StoreCall.FindRecordsFolder:
      return cause.message
    case StoreCall.List:
      return `The records could not list their keys: ${cause.message}. ${CHECK_READABLE}`
    case StoreCall.Read:
      return `The records could not read the key ${key}: ${cause.message}. ${CHECK_READABLE}`
    case StoreCall.Write:
      return (
        `The records did not save the change to the key ${key}: ${cause.message}. Check that ` +
        `the record files of this project in ${RECORDS_FOLDER_TEXT} can be written. If the ` +
        'file used by a session is over 4 MiB, delete the records no longer needed from that ' +
        'file. Then try again.'
      )
  }
}

const CHECK_READABLE =
  `Check that the record files of this project in ${RECORDS_FOLDER_TEXT} can be read, then try ` +
  'again.'

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
