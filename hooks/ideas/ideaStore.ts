import { hexOf } from '../importedId'
import {
  RecordKind,
  deleteRecord,
  isRecord,
  keyPartAfter,
  listKeys,
  readEntriesIn,
  recordKeyOf,
  recordPrefixOf,
  writeRecord,
} from '../pluginStore'
import type { StoreEngine } from '../pluginStore'
import { isEntryAtOrUnder, readEntryNumber } from '../todoEntry'
import type { EntryNumber } from '../todoEntry'

declare const IDEA_ID_BRAND: unique symbol

/** The name of one recorded idea, which only the store reads. */
export type IdeaId = string & { readonly [IDEA_ID_BRAND]: true }

/** Words of the user recorded for the entry `entry` in TODO.md at the time `recordedAt`. */
export type Idea = { entry: EntryNumber; words: string; recordedAt: number }

/** An idea as the store has it, with the folder of the project it was recorded in. */
type StoredIdea = Idea & { project: string }

/** An idea read from the store, with the id that names it. */
export type IdentifiedIdea = Idea & { id: IdeaId }

/** The ideas read from the store, and the keys of the records in another shape. */
export type ReadIdeas = { ideas: IdentifiedIdea[]; unreadableKeys: string[] }

const IDEAS_PREFIX = recordPrefixOf(RecordKind.Idea)

// The key holds the first bytes of the SHA-256 digest of the project after its owner, so a read
// lists the keys of one project before it reads any value. A product choice: 8 bytes keep the key
// short, and another project with the same digest costs only reads, since the record holds the
// project too.
const PROJECT_DIGEST_BYTES = 8

/** Stores `idea`, recorded in `project`, under a new key owned by the session `sessionId`. */
export async function saveIdea(
  $: StoreEngine,
  recorded: { sessionId: string; project: string; idea: Idea },
): Promise<void> {
  const { sessionId, project, idea } = recorded
  const digest = await projectDigestOf(project)
  const value: StoredIdea = { ...idea, project }

  return writeRecord($, {
    key: recordKeyOf(RecordKind.Idea, sessionId, digest, crypto.randomUUID()),
    value,
  })
}

/** The ideas recorded in `project` for an entry that `includesEntry` accepts, oldest first. */
export async function readIdeasOf(
  $: StoreEngine,
  scope: { project: string; includesEntry: (entry: EntryNumber) => boolean },
): Promise<ReadIdeas> {
  const { project, includesEntry } = scope
  const digest = await projectDigestOf(project)
  const ids = (await listKeys($)).filter((key): key is IdeaId => projectDigestIn(key) === digest)
  const ideas: IdentifiedIdea[] = []
  const unreadableKeys: string[] = []
  for (const { key, value } of await readEntriesIn($, IDEAS_PREFIX, ids)) {
    const idea = parseIdea(value)
    if (idea === undefined) {
      unreadableKeys.push(key)
    } else if (idea.project === project && includesEntry(idea.entry)) {
      ideas.push({ ...idea, id: key })
    }
  }
  ideas.sort((earlier, later) => earlier.recordedAt - later.recordedAt)

  return { ideas, unreadableKeys }
}

/**
 * Deletes the ideas recorded in `project` for each entry of `entries` and for every entry under it,
 * each idea once, and returns them with the keys of the records in another shape, which stay. A
 * failed delete is thrown after every delete has ended, so a read after it finds the ideas left.
 */
export async function deleteIdeasUnder(
  $: StoreEngine,
  scope: { project: string; entries: readonly EntryNumber[] },
): Promise<ReadIdeas> {
  const { project, entries } = scope
  const deleted = await readIdeasOf($, {
    project,
    includesEntry: recorded => entries.some(entry => isEntryAtOrUnder(recorded, entry)),
  })
  const deletes = await Promise.allSettled(deleted.ideas.map(idea => deleteIdea($, idea.id)))
  const failed = deletes.find(result => result.status === 'rejected')
  if (failed !== undefined) {
    throw failed.reason
  }

  return deleted
}

// Every session deletes ideas recorded by any session in the project. The session that records an
// idea writes its key once, before any session can list the idea, so a delete never races a write
// to the same key.
export function deleteIdea($: StoreEngine, id: IdeaId): Promise<void> {
  return deleteRecord($, id)
}

async function projectDigestOf(project: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(project))

  return hexOf(new Uint8Array(digest).slice(0, PROJECT_DIGEST_BYTES))
}

/** The digest of the project in the key `key` of an idea, which follows the owner of the key. */
function projectDigestIn(key: string): string | undefined {
  const owner = keyPartAfter(IDEAS_PREFIX, key)

  return owner === undefined
    ? undefined
    : keyPartAfter(recordPrefixOf(RecordKind.Idea, owner), key)
}

function parseIdea(value: unknown): StoredIdea | undefined {
  if (!isRecord(value)) {
    return undefined
  }
  const { project, words, recordedAt } = value
  const entry = readEntryNumber(value.entry)

  return typeof project === 'string' &&
    entry !== undefined &&
    typeof words === 'string' &&
    typeof recordedAt === 'number'
    ? { project, entry, words, recordedAt }
    : undefined
}
