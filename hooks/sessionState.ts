import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { Request, SessionRequests } from '../types'
import type { DoneRequest } from './requests'
import { readSessionRequests } from './requestStore'
import { isSessionRunning, ofRunningSession } from './sessionBoundState'

// The engine lists the state a module reads and writes from the source of the module, so every
// state reference of the requests is written in this file with its plugin and key as literals,
// and the other modules read and write that state through the functions below.
const sessionActivity = atom(
  { plugin: 'workflow-skills', key: 'sessionActivity' } as const,
  null,
)
const sessionRequests = atom(
  { plugin: 'workflow-skills', key: 'sessionRequests' } as const,
  null,
)
const deliveringReplies = atom(
  { plugin: 'workflow-skills', key: 'deliveringReplies' } as const,
  [],
)

// Whether a person is at the prompt, as the start of the session tells. The module and not the
// state of the host has it: a session that /resume or /clear switched to raises no start, and the
// host may have no state for it. A fresh copy of the module raises the start again.
let isPersonAtPrompt = false

export function recordPersonAtPrompt(isInteractive: boolean): void {
  isPersonAtPrompt = isInteractive
}

export function hasPersonAtPrompt(): boolean {
  return isPersonAtPrompt
}

// The session whose requests the start of the process read, also when the read failed. The
// classic SessionStart hook that follows the start then leaves that read out, so a failure shows
// once. Before the start, the classic hook reads nothing, since no person is known to be at the
// prompt yet.
let sessionReadAtStart: string | undefined

export function recordReadAtStart(sessionId: string): void {
  sessionReadAtStart = sessionId
}

/** Whether the start of the process read the requests of `sessionId`, true once. */
export function takeReadAtStart(sessionId: string): boolean {
  const wasRead = sessionReadAtStart === sessionId
  sessionReadAtStart = undefined

  return wasRead
}

/**
 * Reads the requests of the session `sessionId` from the store into the state that the screens
 * draw, and returns them.
 */
export async function loadRequestsFromStore(
  $: EngineInterface,
  sessionId: string,
): Promise<readonly Request[]> {
  const requests = await readSessionRequests($, sessionId)
  await setRequestsInState($, sessionId, requests)

  return requests
}

/**
 * Loads the requests of the session `sessionId` from the store into the state, unless the state
 * contains them already.
 */
export async function loadRequestsUnlessInState(
  $: EngineInterface,
  sessionId: string,
): Promise<void> {
  if ((await readRequestsInState($))?.sessionId !== sessionId) {
    await loadRequestsFromStore($, sessionId)
  }
}

/**
 * The requests in the state with the id of their session while that session runs, and null
 * otherwise, such as before the session read them or after a switch to another session.
 */
export async function readRequestsInState($: EngineInterface): Promise<SessionRequests | null> {
  return ofRunningSession($, await read($, sessionRequests))
}

/**
 * Puts the requests of the session `sessionId`, as the store has them, into the state, unless
 * another session runs by now.
 */
export async function setRequestsInState(
  $: EngineInterface,
  sessionId: string,
  requests: readonly Request[],
): Promise<void> {
  if (await isSessionRunning($, sessionId)) {
    await update($, sessionRequests, () => ({ sessionId, requests }))
  }
}

/**
 * Changes the requests in the state, once a session has read them, and keeps the session they
 * belong to. `change` finds the requests by their ids, which differ across sessions, so a change
 * for one session leaves the requests of another as they are.
 */
export async function updateRequests(
  $: EngineInterface,
  change: (requests: readonly Request[]) => readonly Request[],
): Promise<void> {
  await update($, sessionRequests, inState =>
    inState === null ? null : { ...inState, requests: change(inState.requests) },
  )
}

/** What the main conversation of a session does, as set by the start and the end of its turns. */
export enum SessionActivity {
  Idle = 'idle',
  TurnRunning = 'turn running',
  /**
   * The user stopped the last turn. The session drops a prompt submitted by a plugin until the
   * user sends a message or runs a slash command.
   */
  StoppedByUser = 'stopped by user',
}

const ACCEPTS_PLUGIN_PROMPTS: Record<SessionActivity, boolean> = {
  [SessionActivity.Idle]: true,
  [SessionActivity.TurnRunning]: false,
  [SessionActivity.StoppedByUser]: false,
}

/** The activity of the main conversation of the session with the id `sessionId`. */
export type ActivityOfSession = { sessionId: string; activity: SessionActivity }

/** The activity of the main conversation of the running session, idle before its first turn. */
export async function readSessionActivity($: EngineInterface): Promise<SessionActivity> {
  const recorded = await ofRunningSession($, await read($, sessionActivity))

  return recorded?.activity ?? SessionActivity.Idle
}

/** Whether the running session accepts a prompt submitted by the plugin, or drops it. */
export async function readSessionAcceptsPluginPrompts($: EngineInterface): Promise<boolean> {
  return acceptsPluginPrompts(await readSessionActivity($))
}

/** Whether a session doing `activity` accepts a prompt submitted by the plugin, or drops it. */
export function acceptsPluginPrompts(activity: SessionActivity): boolean {
  return ACCEPTS_PLUGIN_PROMPTS[activity]
}

export async function setSessionActivity(
  $: EngineInterface,
  activity: SessionActivity,
): Promise<void> {
  const sessionId = await $.session.id()
  await update($, sessionActivity, () => ({ sessionId, activity }))
}

/**
 * Marks the running session as doing `to` when it does `from`, and returns whether it did `from`.
 * A session before its first turn is idle.
 */
export async function changeSessionActivity(
  $: EngineInterface,
  from: SessionActivity,
  to: SessionActivity,
): Promise<boolean> {
  const sessionId = await $.session.id()
  let didFrom = false
  await update($, sessionActivity, inState => {
    const activity =
      inState?.sessionId === sessionId ? inState.activity : SessionActivity.Idle
    didFrom = activity === from

    return didFrom ? { sessionId, activity: to } : inState
  })

  return didFrom
}

/**
 * Marks the replies as being delivered by this session, and returns the ones another delivery of
 * the session was not delivering already.
 */
export async function claimReplies(
  $: EngineInterface,
  undelivered: readonly DoneRequest[],
): Promise<DoneRequest[]> {
  let claimed: DoneRequest[] = []
  await update($, deliveringReplies, delivering => {
    claimed = undelivered.filter(request => !delivering.includes(request.id))

    return [...delivering, ...claimed.map(request => request.id)]
  })

  return claimed
}

export async function releaseReplies(
  $: EngineInterface,
  claimed: readonly DoneRequest[],
): Promise<void> {
  await update($, deliveringReplies, delivering =>
    delivering.filter(id => !claimed.some(request => request.id === id)),
  )
}
