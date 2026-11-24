import { RecordKind, deleteRecord, isRecord, recordPrefixOf, writeRecord } from '../pluginStore'
import type { StoreEngine } from '../pluginStore'
import { isPositiveInteger } from '../positiveInteger'
import { readProjectRecords, saveProjectRecord, sessionIn } from '../projectRecords'
import { readEntryNumber } from '../todoEntry'
import { IdeaLinkKind, isProjectLink } from './ideaLink'
import type { EntryLink, FormerLink, GoalLink, IdeaLink } from './ideaLink'

declare const IDEA_ID_BRAND: unique symbol

/** The name of one recorded idea, which only the store reads. */
export type IdeaId = string & { readonly [IDEA_ID_BRAND]: true }

export type Idea = { link: IdeaLink; words: string; recordedAt: number }

/** An idea read from the store, with the id that names it. */
export type IdentifiedIdea = Idea & { id: IdeaId }

/** The ideas read from the store, and the keys of the records in another shape. */
export type ReadIdeas = { ideas: IdentifiedIdea[]; unreadableKeys: string[] }

export type RelinkedIdeas<Relinked extends IdeaLink> = {
  links: Relinked[]
  unreadableKeys: string[]
}

const IDEAS_PREFIX = recordPrefixOf(RecordKind.Idea)

/** Stores `idea` under a new key owned by the session `sessionId`. */
export function saveIdea(
  $: StoreEngine,
  recorded: { sessionId: string; idea: Idea },
): Promise<void> {
  const { sessionId, idea } = recorded

  return saveProjectRecord($, { kind: RecordKind.Idea, sessionId, value: idea })
}

export async function readIdeasOf(
  $: StoreEngine,
  includesLink: (link: IdeaLink) => boolean,
): Promise<ReadIdeas> {
  const { ideas, unreadableKeys } = await readIdeas($)

  return { ideas: ideas.filter(idea => includesLink(idea.link)), unreadableKeys }
}

export async function readProjectIdeasAndIdeasRecordedBy(
  $: StoreEngine,
  sessionId: string,
): Promise<ReadIdeas> {
  const { ideas, unreadableKeys } = await readIdeas($)
  const isRecordedBySession = (key: string) => sessionIn(RecordKind.Idea, key) === sessionId

  return {
    ideas: ideas.filter(idea => isProjectLink(idea.link) || isRecordedBySession(idea.id)),
    unreadableKeys: unreadableKeys.filter(isRecordedBySession),
  }
}

async function readIdeas($: StoreEngine): Promise<ReadIdeas> {
  const read = await readProjectRecords($, { kind: RecordKind.Idea, parse: parseIdea })
  const ideas: IdentifiedIdea[] = []
  const unreadableKeys = [...read.unreadableKeys]
  for (const { key, value } of read.records) {
    if (isIdeaId(key)) {
      ideas.push({ ...value, id: key })
    } else {
      unreadableKeys.push(key)
    }
  }
  ideas.sort((earlier, later) => earlier.recordedAt - later.recordedAt)

  return { ideas, unreadableKeys }
}

export async function relinkIdeasOf<Relinked extends IdeaLink>(
  $: StoreEngine,
  relink: (link: IdeaLink) => Relinked | undefined,
): Promise<RelinkedIdeas<Relinked>> {
  const { ideas, unreadableKeys } = await readIdeas($)
  const relinked = ideas.flatMap(({ id, link, words, recordedAt }) => {
    const newLink = relink(link)

    return newLink === undefined ? [] : [{ id, idea: { link: newLink, words, recordedAt } }]
  })
  const writes = await Promise.allSettled(
    relinked.map(({ id, idea }) => writeRecord($, { key: id, value: idea })),
  )
  const failed = writes.find(result => result.status === 'rejected')
  if (failed !== undefined) {
    throw failed.reason
  }

  return { links: relinked.map(({ idea }) => idea.link), unreadableKeys }
}

// Every session deletes ideas recorded by any session in the project. The session that records an
// idea writes its key once, before any session can list the idea. A relink writes the idea again
// under the same key, and the store cannot write on condition that the key is still there, so a
// delete in the Ideas pane during a relink can leave the idea in the store.
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
  const isLegacyIdea = value.link === undefined
  const link = isLegacyIdea ? parseEntryLink(value) : parseLink(value.link)

  return link !== undefined && typeof words === 'string' && typeof recordedAt === 'number'
    ? { link, words, recordedAt }
    : undefined
}

function parseLink(value: unknown): IdeaLink | undefined {
  if (!isRecord(value)) {
    return undefined
  }
  switch (readLinkKind(value.kind)) {
    case IdeaLinkKind.Entry:
      return parseEntryLink(value)
    case IdeaLinkKind.Goal:
      return parseGoalLink(value.goal)
    case IdeaLinkKind.Project: {
      const wasFor = parseFormerLink(value.wasFor)

      return wasFor === undefined ? undefined : { kind: IdeaLinkKind.Project, wasFor }
    }
    case undefined:
      return undefined
  }
}

function parseFormerLink(value: unknown): FormerLink | undefined {
  const link = parseLink(value)
  switch (link?.kind) {
    case IdeaLinkKind.Entry: {
      const title = isRecord(value) ? value.title : undefined

      return typeof title === 'string' ? { ...link, title } : link
    }
    case IdeaLinkKind.Goal:
      return link
    case IdeaLinkKind.Project:
    case undefined:
      return undefined
  }
}

function readLinkKind(kind: unknown): IdeaLinkKind | undefined {
  return Object.values(IdeaLinkKind).find(each => each === kind)
}

function parseEntryLink(fields: Record<string, unknown>): EntryLink | undefined {
  const entry = readEntryNumber(fields.entry)

  return entry === undefined ? undefined : { kind: IdeaLinkKind.Entry, entry }
}

function parseGoalLink(value: unknown): GoalLink | undefined {
  if (!isRecord(value)) {
    return undefined
  }
  const { id, number, text } = value

  return typeof id === 'string' && isPositiveInteger(number) && typeof text === 'string'
    ? { kind: IdeaLinkKind.Goal, goal: { id, number, text } }
    : undefined
}
