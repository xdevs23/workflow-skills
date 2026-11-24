import type { EngineInterface } from 'claude-code'

import {
  deleteEngineStoreValue,
  readEngineStoreKeys,
  readEngineStoreEntries,
  writeEngineStoreEntry,
} from './engineStore'
import { RecordKind, recordKeyOf } from './pluginStore'
import { idOf, readProjectRequest, readRequestRecordKey } from './requestRecords'
import type { ProjectRequest, RequestRecordKey } from './requestRecords'

/**
 * The owner part of the keys written before the requests belonged to a session: the SHA-256
 * digest of the project root in 64 hexadecimal digits, a form that session ids do not have.
 */
const PROJECT_DIGEST = /^[0-9a-f]{64}$/

/**
 * Moves the records written to the store of the engine under the digest of a project, before the
 * requests belonged to a session, to the keys of the session stored in the `sessionId` field of
 * their request in that store, and deletes the old keys. The move also deletes a record whose
 * request is missing, since sessions cannot reach it, and leaves a request of another shape with
 * its records, since its session is not known. It writes the records again in the order of their
 * old keys, so that this order still sets the numbers and the reply that counts.
 */
export async function moveProjectRecordsToSessions($: EngineInterface): Promise<void> {
  const records = (await readEngineStoreKeys($)).flatMap(key => {
    const record = readRequestRecordKey(key)

    return record !== undefined && PROJECT_DIGEST.test(record.owner) ? [record] : []
  })
  const entries = await readEngineStoreEntries($, records.map(({ key }) => key))
  const values = new Map(entries.map(({ key, value }) => [key, value]))
  const stored = records.flatMap(record =>
    values.has(record.key) ? [{ ...record, value: values.get(record.key) }] : [],
  )
  const requests = new Map<string, ProjectRequest | undefined>()
  for (const { kind, owner, rest, value } of stored) {
    if (kind === RecordKind.Request) {
      requests.set(requestIdOf({ owner, rest }), readProjectRequest(rest, value))
    }
  }
  const moved = stored.filter(record => {
    const id = requestIdOf(record)

    return !requests.has(id) || requests.get(id) !== undefined
  })
  for (const { kind, owner, rest, value } of moved) {
    const request = requests.get(requestIdOf({ owner, rest }))
    if (request !== undefined) {
      const record = kind === RecordKind.Request ? request.record : value
      const key = recordKeyOf(kind, request.sessionId, rest)
      await writeEngineStoreEntry($, { key, value: record })
    }
  }
  await Promise.all(moved.map(record => deleteEngineStoreValue($, record.key)))
}

function requestIdOf({ owner, rest }: Pick<RequestRecordKey, 'owner' | 'rest'>): string {
  return `${owner}:${idOf(rest)}`
}
