import { isRecord, readEntriesUnder, writeRecord } from './pluginStore'
import { keyPartAfter, recordKeyOf, recordPrefixOf } from './recordKeys'
import type { StoreEngine } from './pluginStore'
import type { RecordKind } from './recordKeys'

export type ProjectRecord<T> = { key: string; value: T }

export type ReadProjectRecords<T> = { records: ProjectRecord<T>[]; unreadableKeys: string[] }

// Each record of a project is written once, under a new key, before any session can list it, so
// every session may delete it and a delete never races a write to the same key.
export function saveProjectRecord<Value extends object>(
  $: StoreEngine,
  saved: { kind: RecordKind; sessionId: string; value: Value },
): Promise<void> {
  const { kind, sessionId, value } = saved

  return writeRecord($, { key: recordKeyOf(kind, sessionId, crypto.randomUUID()), value })
}

export async function readProjectRecords<T>(
  $: StoreEngine,
  read: { kind: RecordKind; parse: (value: unknown) => T | undefined },
): Promise<ReadProjectRecords<T>> {
  const { kind, parse } = read
  const records: ProjectRecord<T>[] = []
  const unreadableKeys: string[] = []
  for (const { key, value } of await readEntriesUnder($, recordPrefixOf(kind))) {
    const parsed = parse(value)
    if (parsed === undefined) {
      unreadableKeys.push(key)
    } else {
      records.push({ key, value: parsed })
    }
  }

  return { records, unreadableKeys }
}

export function sessionIn(kind: RecordKind, key: string): string | undefined {
  return keyPartAfter(recordPrefixOf(kind), key)
}

/**
 * The project in the value of a record owned by a project, as an earlier version of the plugin
 * wrote it to the store of the engine, undefined for another shape.
 */
export function projectIn(value: unknown): string | undefined {
  return isRecord(value) && typeof value.project === 'string' ? value.project : undefined
}
