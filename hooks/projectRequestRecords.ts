import type { EngineInterface } from 'claude-code'

import { RecordKind, recordKeyOf } from './pluginStore'
import { idOf, parseProjectRequest, readRequestRecordKey } from './requestRecords'
import type { RequestRecord } from './requestRecords'
import { deleteRecord, readStoreKeys, readStoreValue, saveRecord } from './requestStore'

/**
 * The owner part of the keys written before the requests belonged to a session: the SHA-256
 * digest of the project root in 64 hexadecimal digits, a form that session ids do not have.
 */
const PROJECT_DIGEST = /^[0-9a-f]{64}$/

/**
 * Moves the records written under the digest of a project, before the requests belonged to a
 * session, to the keys of the session named in the `sessionId` field of their request, and
 * deletes the old keys. A record whose request is missing is deleted as well, since sessions
 * cannot reach it. The records are written again in the order of their old keys, so that order
 * still decides the numbers and the reply that counts.
 */
export async function moveProjectRecordsToSessions($: EngineInterface): Promise<void> {
  const records = (await readStoreKeys($)).flatMap(key => {
    const record = readRequestRecordKey(key)

    return record !== undefined && PROJECT_DIGEST.test(record.owner) ? [record] : []
  })
  const values = await Promise.all(records.map(record => readStoreValue($, record.key)))
  const moved = records.map((record, index) => ({ ...record, value: values[index] }))
  const sessionOfRequest = new Map<string, string>()
  const requestRecords = new Map<string, RequestRecord>()
  for (const { key, kind, owner, rest, value } of moved) {
    if (kind === RecordKind.Request && value !== undefined) {
      const { sessionId, record } = parseProjectRequest(key, rest, value)
      sessionOfRequest.set(`${owner}:${rest}`, sessionId)
      requestRecords.set(key, record)
    }
  }
  for (const { key, kind, owner, rest, value } of moved) {
    const sessionId = sessionOfRequest.get(`${owner}:${idOf(rest)}`)
    if (sessionId !== undefined && value !== undefined) {
      await saveRecord($, recordKeyOf(kind, sessionId, rest), requestRecords.get(key) ?? value)
    }
  }
  await Promise.all(records.map(record => deleteRecord($, record.key)))
}
