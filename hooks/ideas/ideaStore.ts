import { RecordKind, deleteRecord, isRecord, listKeys, recordPrefixOf } from '../pluginStore'
import type { StoreEngine } from '../pluginStore'
import { readProjectRecords, saveProjectRecord } from '../projectRecords'
import { isEntryAtOrUnder, readEntryNumber } from '../todoEntry'
import type { EntryNumber } from '../todoEntry'

declare const IDEA_ID_BRAND: unique symbol

/** The name of one recorded idea, which only the store reads. */
export type IdeaId = string & { readonly [IDEA_ID_BRAND]: true }

/** Words of the user recorded for the entry `entry` in TODO.md at the time `recordedAt`. */
export type Idea = { entry: EntryNumber; words: string; recordedAt: number }

/** An idea read from the store, with the id that names it. */
export type IdentifiedIdea = Idea & { id: IdeaId }

/** The ideas read from the store, and the keys of the records in another shape. */
export type ReadIdeas = { ideas: IdentifiedIdea[]; unreadableKeys: string[] }

const IDEAS_PREFIX = recordPrefixOf(RecordKind.Idea)

/** Stores `idea`, recorded in `project`, under a new key owned by the session `sessionId`. */
export function saveIdea(
  $: StoreEngine,
  recorded: { sessionId: string; project: string; idea: Idea },
): Promise<void> {
  const { sessionId, project, idea } = recorded

  return saveProjectRecord($, { kind: RecordKind.Idea, sessionId, project, value: idea })
}

/** The ideas recorded in `project` for an entry that `includesEntry` accepts, oldest first. */
export async function readIdeasOf(
  $: StoreEngine,
  scope: { project: string; includesEntry: (entry: EntryNumber) => boolean },
): Promise<ReadIdeas> {
  const { project, includesEntry } = scope
  const { ideas, unreadableKeys } = await readIdeasUnder($, project, IDEAS_PREFIX)

  return { ideas: ideas.filter(idea => includesEntry(idea.entry)), unreadableKeys }
}

export function readIdeasRecordedBy(
  $: StoreEngine,
  scope: { project: string; sessionId: string },
): Promise<ReadIdeas> {
  return readIdeasUnder($, scope.project, recordPrefixOf(RecordKind.Idea, scope.sessionId))
}

async function readIdeasUnder(
  $: StoreEngine,
  project: string,
  keyPrefix: string,
): Promise<ReadIdeas> {
  const { records, unreadableKeys } = await readProjectRecords($, {
    kind: RecordKind.Idea,
    project,
    keysListedBefore: (await listKeys($)).filter(isIdeaId).filter(id => id.startsWith(keyPrefix)),
    parse: parseIdea,
  })
  const ideas = records.map(({ key, value }): IdentifiedIdea => ({ ...value, id: key }))
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

function isIdeaId(key: string): key is IdeaId {
  return key.startsWith(IDEAS_PREFIX)
}

function parseIdea(value: unknown): Idea | undefined {
  if (!isRecord(value)) {
    return undefined
  }
  const { words, recordedAt } = value
  const entry = readEntryNumber(value.entry)

  return entry !== undefined && typeof words === 'string' && typeof recordedAt === 'number'
    ? { entry, words, recordedAt }
    : undefined
}
