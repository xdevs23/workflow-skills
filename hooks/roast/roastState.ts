import { atom, read, update } from 'claude-code'
import type { EngineInterface, ModelApiError } from 'claude-code'

import { ofRunningSession, updateOfSession } from '../sessionBoundState'
import type { RoastFailure } from './roastFailure'

/** What became of the roast asked for by a run of /roast. */
export enum RoastShown {
  Writing = 'writing',
  WritingAgain = 'writing again',
  Written = 'written',
  Sent = 'sent',
  NotWritten = 'not written',
}

export type RoastProgress =
  | { shown: RoastShown.Writing }
  | { shown: RoastShown.WritingAgain; failedTries: number; error: ModelApiError }
  | { shown: RoastShown.Written; text: string; comment: string }
  | { shown: RoastShown.Sent }
  | { shown: RoastShown.NotWritten; failure: RoastFailure }

/** The arm of RoastProgress for `shown`. */
export type RoastProgressOf<S extends RoastShown> = Extract<RoastProgress, { shown: S }>

export type WrittenRoast = RoastProgressOf<RoastShown.Written>

/**
 * A run of /roast in the session `sessionId`, by the id `runId` made for it. The state drops a
 * roast that arrives after a later run or a switch to another session.
 */
export type RoastRun = { sessionId: string; runId: string }

/** The roast shown in the Roast pane, with the run of /roast that asked for it. */
export type SessionRoast = RoastRun & { roast: RoastProgress }

/** A roast that the user sent from the Roast pane and that has not gone to the model yet. */
export type PendingRoast = { run: RoastRun; written: WrittenRoast }

/** The pending roasts taken from the state, split by the session they were written for. */
export type TakenRoasts = {
  ofRunningSession: PendingRoast[]
  ofOtherSessions: PendingRoast[]
}

// The engine lists the state read and written by a module from the source of the module, so this
// file writes the state references of the roast with their plugin and key as literals.
const sessionRoast = atom({ plugin: 'workflow-skills', key: 'sessionRoast' } as const, null)
const pendingRoasts = atom({ plugin: 'workflow-skills', key: 'pendingRoasts' } as const, [])

/** The roast about the running session, which a drawing of the Roast pane subscribes to. */
export async function readRoastInState($: EngineInterface): Promise<SessionRoast | null> {
  return ofRunningSession($, await read($, sessionRoast))
}

/** Replaces the roast in the session of `run` with the one being written for `run`. */
export async function setRoastWriting($: EngineInterface, run: RoastRun): Promise<void> {
  await updateRoast($, run.sessionId, () => ({ ...run, roast: { shown: RoastShown.Writing } }))
}

/** Puts `roast` into the state for `run`, and returns whether it went in. */
export async function setRoastOfRun(
  $: EngineInterface,
  run: RoastRun,
  roast: RoastProgress,
): Promise<boolean> {
  const inState = await updateRoast($, run.sessionId, own =>
    own?.runId === run.runId ? { ...own, roast } : own,
  )

  return inState?.runId === run.runId
}

/** Puts `comment`, as typed so far, beside the written roast of `run`. */
export async function recordComment(
  $: EngineInterface,
  run: RoastRun,
  comment: string,
): Promise<void> {
  await updateRoast($, run.sessionId, own =>
    own?.runId === run.runId && own.roast.shown === RoastShown.Written
      ? { ...own, roast: { ...own.roast, comment } }
      : own,
  )
}

/**
 * Marks the written roast of `run` as sent, and returns it, or null where another press marked it
 * already or the state dropped `run`.
 */
export async function markRoastSent(
  $: EngineInterface,
  run: RoastRun,
): Promise<WrittenRoast | null> {
  let marked: WrittenRoast | null = null
  await updateRoast($, run.sessionId, own => {
    if (own?.runId !== run.runId || own.roast.shown !== RoastShown.Written) {
      return own
    }
    marked = own.roast

    return { ...own, roast: { shown: RoastShown.Sent } }
  })

  return marked
}

/**
 * Removes the roast from the state of the running session, so a fork that returns later finds its
 * run dropped and stops.
 */
export async function dropRoast($: EngineInterface): Promise<void> {
  await updateRoast($, await $.session.id(), () => null)
}

export async function addPendingRoast($: EngineInterface, roast: PendingRoast): Promise<void> {
  await update($, pendingRoasts, inState => [...inState, roast])
}

/**
 * Removes every pending roast from the state in one update, so only one of several parallel takes
 * returns a roast, and returns them split by session.
 */
export async function takeAllPendingRoasts($: EngineInterface): Promise<TakenRoasts> {
  let taken: TakenRoasts = { ofRunningSession: [], ofOtherSessions: [] }
  if ((await read($, pendingRoasts)).length === 0) {
    return taken
  }
  const sessionId = await $.session.id()
  const isOfRunningSession = (roast: PendingRoast) => roast.run.sessionId === sessionId
  await update($, pendingRoasts, inState => {
    taken = {
      ofRunningSession: inState.filter(isOfRunningSession),
      ofOtherSessions: inState.filter(roast => !isOfRunningSession(roast)),
    }

    return []
  })

  return taken
}

function updateRoast(
  $: EngineInterface,
  sessionId: string,
  change: (own: SessionRoast | null) => SessionRoast | null,
): Promise<SessionRoast | null> {
  return updateOfSession($, sessionId, change, changeInState =>
    update($, sessionRoast, changeInState),
  )
}
