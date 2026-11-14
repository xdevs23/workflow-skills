import { StoreCall, callStore, deleteRecord, writeRecord } from '../pluginStore'
import type { StoreEngine } from '../pluginStore'
import {
  firstPromptKeyOf,
  firstPromptValueOf,
  parseFirstPrompt,
  parseStart,
  startKeyOf,
  startValueOf,
} from './sessionRecord'
import type { SessionStart } from './sessionRecord'

/** What was read of the start of a session. */
export enum StartOutcome {
  Read = 'read',
  /** The session did not record its start, such as one begun before sessions recorded it. */
  Missing = 'missing',
  /** The start record is of another shape or of a higher version. */
  Unreadable = 'unreadable',
}

/** The start of a session, and the first prompt typed in it, once one was typed. */
export type RecordedStart = SessionStart & { firstPrompt?: string }

export type StartRead =
  | { outcome: StartOutcome.Read; start: RecordedStart }
  | { outcome: StartOutcome.Missing }
  | { outcome: StartOutcome.Unreadable; key: string }

export function saveSessionStart(
  $: StoreEngine,
  sessionId: string,
  start: SessionStart,
): Promise<void> {
  return writeRecord($, { key: startKeyOf(sessionId), value: startValueOf(start) })
}

export function saveFirstPrompt($: StoreEngine, sessionId: string, text: string): Promise<void> {
  return writeRecord($, { key: firstPromptKeyOf(sessionId), value: firstPromptValueOf(text) })
}

/**
 * The start of the session `sessionId`, with its first prompt. A first prompt record of another
 * shape reads as no first prompt, since the start alone places the session.
 */
export async function readSessionStart($: StoreEngine, sessionId: string): Promise<StartRead> {
  const key = startKeyOf(sessionId)
  const promptKey = firstPromptKeyOf(sessionId)
  const [stored, storedPrompt] = await Promise.all([
    callStore(StoreCall.Read, key, () => $.store.get(key)),
    callStore(StoreCall.Read, promptKey, () => $.store.get(promptKey)),
  ])
  if (stored === undefined) {
    return { outcome: StartOutcome.Missing }
  }
  const start = parseStart(stored)
  if (start === undefined) {
    return { outcome: StartOutcome.Unreadable, key }
  }
  const firstPrompt = parseFirstPrompt(storedPrompt)

  return {
    outcome: StartOutcome.Read,
    start: firstPrompt === undefined ? start : { ...start, firstPrompt },
  }
}

/** Deletes the start record and the first prompt record of the session `sessionId`. */
export async function deleteSessionRecords($: StoreEngine, sessionId: string): Promise<void> {
  await Promise.all([
    deleteRecord($, startKeyOf(sessionId)),
    deleteRecord($, firstPromptKeyOf(sessionId)),
  ])
}
