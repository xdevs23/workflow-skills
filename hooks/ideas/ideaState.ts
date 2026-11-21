import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import { isSessionRunning, ofRunningSession } from '../sessionBoundState'
import type { IdeaId, ReadIdeas } from './ideaStore'

// The engine lists the state a module reads and writes from the source of the module, so every
// state reference of the ideas is written in this file with its plugin and key as literals.
const sessionIdeas = atom({ plugin: 'workflow-skills', key: 'sessionIdeas' } as const, null)

export enum IdeasOutcome {
  Read = 'read',
  Failed = 'failed',
}

/** The ideas recorded in the project as the store had them, or why it could not read them. */
export type LoadedIdeas =
  | ({ outcome: IdeasOutcome.Read } & ReadIdeas)
  | { outcome: IdeasOutcome.Failed; failure: string }

/**
 * The ideas loaded by the session with the id `sessionId`, and the idea whose delete waits for the
 * user to confirm it in the Ideas pane, null while none waits.
 */
export type SessionIdeas = { sessionId: string; awaitingDelete: IdeaId | null } & LoadedIdeas

/**
 * The ideas in the state while the session that loaded them runs, and null otherwise, such as
 * before the session loaded them or after a switch to another session.
 */
export async function readIdeasInState($: EngineInterface): Promise<SessionIdeas | null> {
  return ofRunningSession($, await read($, sessionIdeas))
}

/**
 * Puts the ideas `loaded` by the session `sessionId` into the state, unless it no longer runs. A
 * delete waiting for its confirmation ends, so the pane shows the plain list again.
 */
export async function setIdeasInState(
  $: EngineInterface,
  sessionId: string,
  loaded: LoadedIdeas,
): Promise<void> {
  if (await isSessionRunning($, sessionId)) {
    await update($, sessionIdeas, () => ({ sessionId, awaitingDelete: null, ...loaded }))
  }
}

/** Lets the delete of the idea `id` wait for the user to confirm it, or ends the wait with null. */
export async function setIdeaAwaitingDelete($: EngineInterface, id: IdeaId | null): Promise<void> {
  const sessionId = await $.session.id()
  await update($, sessionIdeas, inState =>
    inState?.sessionId === sessionId ? { ...inState, awaitingDelete: id } : inState,
  )
}
