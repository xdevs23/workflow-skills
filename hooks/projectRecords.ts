import { hexOf } from './importedId'
import {
  isRecord,
  keyPartAfter,
  readEntriesIn,
  recordKeyOf,
  recordPrefixOf,
  writeRecord,
} from './pluginStore'
import type { RecordKind, StoreEngine } from './pluginStore'

// The key of a record of a project holds the first bytes of the SHA-256 digest of the project, so a
// read lists the keys of one project before it reads any value. A product choice: 8 bytes keep the
// key short, and another project with the same digest costs only reads, since the record holds the
// project too and every record has a key of its own.
const PROJECT_DIGEST_BYTES = 8

export type ProjectRecord<T, Key extends string = string> = { key: Key; value: T }

export type ReadProjectRecords<T, Key extends string = string> = {
  records: ProjectRecord<T, Key>[]
  unreadableKeys: Key[]
}

// Each record of a project is written once, under a new key, before any session can list it, so
// every session may delete it and a delete never races a write to the same key.
export async function saveProjectRecord<Value extends object>(
  $: StoreEngine,
  saved: { kind: RecordKind; sessionId: string; project: string; value: Value },
): Promise<void> {
  const { kind, sessionId, project, value } = saved
  const key = recordKeyOf(kind, sessionId, await projectDigestOf(project), crypto.randomUUID())

  return writeProjectRecord($, { key, project, value })
}

export function writeProjectRecord<Value extends object>(
  $: StoreEngine,
  written: { key: string; project: string; value: Value },
): Promise<void> {
  const { key, project, value } = written

  return writeRecord($, { key, value: { ...value, project } })
}

export async function readProjectRecords<T, Key extends string>(
  $: StoreEngine,
  read: {
    kind: RecordKind
    project: string
    keysListedBefore: readonly Key[]
    parse: (value: unknown) => T | undefined
  },
): Promise<ReadProjectRecords<T, Key>> {
  const { kind, project, keysListedBefore, parse } = read
  const digest = await projectDigestOf(project)
  const keysOfProject = keysListedBefore.filter(key => projectDigestIn(kind, key) === digest)
  const records: ProjectRecord<T, Key>[] = []
  const unreadableKeys: Key[] = []
  for (const { key, value } of await readEntriesIn($, recordPrefixOf(kind), keysOfProject)) {
    const parsed = parse(value)
    const projectOfRecord = projectIn(value)
    if (parsed === undefined || projectOfRecord === undefined) {
      unreadableKeys.push(key)
    } else if (projectOfRecord === project) {
      records.push({ key, value: parsed })
    }
  }

  return { records, unreadableKeys }
}

async function projectDigestOf(project: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(project))

  return hexOf(new Uint8Array(digest).slice(0, PROJECT_DIGEST_BYTES))
}

export function sessionIn(kind: RecordKind, key: string): string | undefined {
  return keyPartAfter(recordPrefixOf(kind), key)
}

function projectDigestIn(kind: RecordKind, key: string): string | undefined {
  const sessionId = sessionIn(kind, key)

  return sessionId === undefined ? undefined : keyPartAfter(recordPrefixOf(kind, sessionId), key)
}

function projectIn(value: unknown): string | undefined {
  return isRecord(value) && typeof value.project === 'string' ? value.project : undefined
}
